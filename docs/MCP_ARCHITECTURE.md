# xPay MCP Architecture — Architecture B (Separate Process)

**Status:** Implemented (Nov 2026) — FastAPI on `8000`, MCP server on `8001` via Streamable HTTP

---

## 1. Overview — Architecture B

xPay uses **Architecture B (Separate Process)** for Model Context Protocol integration:

- **FastAPI app** (`backend/app/main.py`) — port `8000` — remittance API, quote lifecycle, compliance gate, simulated settlement
- **MCP server** (`backend/app/mcp/server.py`) — port `8001` — `xpay-financial-intelligence-mcp` via **Streamable HTTP** at `http://localhost:8001/mcp`
- **MCP client** (`backend/app/mcp/client.py`) — custom Python adapter using `mcp.ClientSession` + `streamablehttp_client`
- **Host:** LangGraph agent (`backend/app/agent/orchestrator.py`) discovers MCP tools dynamically

```
User → Frontend (3000) → FastAPI (8000) → LangGraph Orchestrator
                                      ↕ (Streamable HTTP, read-only)
                                   MCP Server (8001)
                                   ├─ deterministic services
                                   └─ prompt: parse_remittance_intent
```

Docker Compose runs both services side-by-side (`backend` + `mcp-server` + `frontend`). The MCP server is stateless; the FastAPI app remains the system of record.

---

## 2. Server — `xpay-financial-intelligence-mcp`

**Framework:** `mcp[cli]` — `FastMCP("xpay-financial-intelligence-mcp", host="0.0.0.0", port=8001, stateless_http=True)`  
**Transport:** **Streamable HTTP** (`transport="streamable-http", path="/mcp"`)  
**Started via:** `python -m app.mcp.server` (or `mcp run backend/app/mcp/server.py --transport streamable-http --port 8001`)

### Read-only tools (5)

All tools wrap existing deterministic services in `backend/app/services/` — no DB mutation, no transfer execution.

| # | MCP tool | Wraps | Args | Read-only guarantee |
|---|----------|-------|------|---------------------|
| 1 | `get_corridor_fx_rate` | `services/corridor.py` (`load_corridor`, `available_corridors`) | `send_currency: str, receive_currency: str` | Returns corridor `mid_market_rate`, `fx_source`, `sourced_at`, per-rail `fx` — config JSON only |
| 2 | `calculate_net_receive` | `services/money.py` (`D`, `quantize`) + `services/incentive.py` (`calculate_true_net_receive`) | `amount: float, corridor: str = "uae_bd"` | Exact-Decimal (`ROUND_HALF_UP`), quantized display + `*_exact` strings — no store write |
| 3 | `compare_remittance_routes` | `services/routing_scorer.py` (`score_routes`, `naive_baseline`) | `amount: float, payout_method: str = "BKASH", corridor: str = "uae_bd"` | Ranks by `reliability_adjusted_net`; includes baseline — scoring only |
| 4 | `screen_recipient` | `services/compliance.py` (`screen_party`) | `name: str` | Normalized Jaro-Winkler + token coverage → `CLEAR`/`FUZZY_MATCH_REVIEW`/`BLOCKED` with rationale — screening only |
| 5 | `search_regulatory_guidance` | `services/regulatory_rag.py` (`retrieve`) | `query: str` | Lexical/MiniLM retrieval over `backend/rag/corpus/*.md` — corpus read only |

**Permissions:** `Read-only; no transfer or settlement permissions.` The MCP server imports no `store` or `stellar` write paths; `get_corridor_fx_rate` and `search_regulatory_guidance` are corpus/config reads, `screen_recipient` is a pure function, and routing/money tools are stateless arithmetic.

### Prompt (1)

| MCP prompt | Source | Output |
|------------|--------|--------|
| `parse_remittance_intent` | `docs/prompt_library.md` §1 | Instructions for LLM to extract `send_amount`, `send_currency`, `receive_currency`, `recipient_name`, `recipient_bank` as strict JSON — no math |

The prompt is exposed via `@mcp.prompt()` and versioned in `docs/prompt_library.md`.

---

## 3. Client — LangGraph adapter

**File:** `backend/app/mcp/client.py`

- `initialize(mcp.ClientSession)` over `streamablehttp_client("http://localhost:8001/mcp")`
- `list_tools()` — returns `[{name, description, inputSchema}]` for discovery
- `call_tool(name, arguments)` — sync helper (async `ClientSession.call_tool` wrapped via `asyncio.run` / thread-pool fallback) returning JSON

**Orchestrator integration** (`backend/app/agent/orchestrator.py`):

```python
from app.mcp import client as mcp_client  # Architecture B

def _mcp_call_or_fallback(tool, args, fallback):
    if mcp_client.MCP_AVAILABLE:
        try: return mcp_client.call_tool(tool, args)
        except: pass
    return fallback()

def get_mcp_langgraph_tools():
    # Converts MCP definitions → LangChain StructuredTool for LangGraph
    definitions = mcp_client.list_tools()
    return [StructuredTool.from_function(func=..., name=..., description=...) for ...]
```

- `score_routes_node` → `compare_remittance_routes` via MCP, fallback to `routing_scorer.score_routes`
- `check_compliance_node` → `screen_recipient` + `search_regulatory_guidance` via MCP
- `parse_intent_node` remains deterministic parser (LLM fallback still schema-validated, off by default)
- `MCP_LANGCHAIN_TOOLS = get_mcp_langgraph_tools()` is exposed for the LangGraph graph

If the MCP server is down, the orchestrator transparently falls back to direct imports — identical behavior.

---

## 4. Determinism & Security

- **All financial math is deterministic:** `app.services.money.D()` (exact Decimal) and `incentive.calculate_true_net_receive` (exact net, no floats) are the only paths to `true_net_receive_bdt`. MCP tools are thin wrappers; the LLM never computes money.
- **Read-only:** No MCP tool calls `store.save_*`, `quotes.create_quote`, `stellar.simulate_settlement`, or `users.json` writes. Transfer execution stays in `orchestrator.execute_node`, never exposed via MCP.
- **Separation:** AI decision-making (LangGraph + MCP discovery) is isolated from financial execution (Python services). The agent can **query** intelligence, not **mutate** state.

---

## 5. Docker Compose (Architecture B)

```yaml
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
  mcp-server:
    build: ./backend
    command: python -m app.mcp.server
    ports: ["8001:8001"]
    environment: [PYTHONUNBUFFERED=1]
  frontend:
    image: node:20-slim
    ports: ["3000:3000"]
    depends_on: [backend, mcp-server]
```

Run locally: `docker compose up --build` — FastAPI, MCP, and frontend are reachable at `:8000`, `:8001/mcp`, and `:3000` respectively.

---

## 6. Hackathon provenance

- MCP servers built: **1** (`xpay-financial-intelligence-mcp`)
- MCP servers used: **0** (custom server; no external servers consumed)
- Transports used: **Streamable HTTP**
- Reuse notes: Custom MCP server wraps existing xPay financial and compliance services; LangGraph client discovers tools dynamically, ensuring the AI cannot execute transfers, only query data.
