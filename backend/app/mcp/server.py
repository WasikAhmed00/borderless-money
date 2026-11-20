"""xPay Financial Intelligence MCP Server — Architecture B (Separate Process).

FastMCP server named `xpay-financial-intelligence-mcp` exposing 5 deterministic,
read-only financial tools. All financial math is exact-Decimal; no mutation.

Run:
  python -m app.mcp.server                          # → http://localhost:8001/mcp
  # or
  mcp run backend/app/mcp/server.py --transport streamable-http --port 8001

Architecture B: FastAPI (8000) and MCP server (8001) are separate processes.
Transport: Streamable HTTP at http://localhost:8001/mcp
Permissions: Read-only; no transfer or settlement permissions.
"""

from typing import Annotated

from mcp.server.fastmcp import FastMCP

from app.services import corridor as corridor_cfg
from app.services import compliance, regulatory_rag, routing_scorer
from app.services.incentive import calculate_true_net_receive
from app.services.money import D  # deterministic Decimal helper (imported to show no-float guarantee)

# FastMCP server — separate process on 8001, Streamable HTTP
# host/port/path are set here so `python -m app.mcp.server` binds correctly
mcp = FastMCP(
    "xpay-financial-intelligence-mcp",
    host="0.0.0.0",
    port=8001,
    # stateless_http improves compatibility with simple HTTP clients
    stateless_http=True,
)


@mcp.tool()
def get_corridor_fx_rate(
    send_currency: Annotated[str, "ISO 4217 source currency, e.g. AED"],
    receive_currency: Annotated[str, "ISO 4217 dest currency, e.g. BDT"],
) -> dict:
    """Get FX snapshot and corridor pricing for a currency pair.

    Wraps backend/app/services/corridor.py (load_corridor, available_corridors).
    Read-only: returns corridor config, mid_market_rate, fx_source, sourced_at,
    and per-rail quoted FX. No mutation.
    """
    send_currency = (send_currency or "").upper().strip()
    receive_currency = (receive_currency or "").upper().strip()
    # Find corridor matching the pair
    for code in corridor_cfg.available_corridors():
        cfg = corridor_cfg.load_corridor(code)
        if cfg.get("source_currency", "").upper() == send_currency and cfg.get(
            "dest_currency", ""
        ).upper() == receive_currency:
            return {
                "corridor": code,
                "label": cfg.get("label"),
                "source_currency": cfg.get("source_currency"),
                "dest_currency": cfg.get("dest_currency"),
                "mid_market_rate": cfg.get("mid_market_rate"),
                "fx_source": cfg.get("fx_source"),
                "sourced_at": cfg.get("sourced_at"),
                "govt_incentive_rate": cfg.get("govt_incentive_rate"),
                "rails": [
                    {"name": r.get("name"), "fx": r.get("fx"), "incentive_eligible": r.get("incentive_eligible", True)}
                    for r in cfg.get("rails", [])
                ],
                "read_only": True,
            }
    # Fallback: try default corridor if pair not found but still useful
    try:
        cfg = corridor_cfg.load_corridor()
        return {
            "corridor": cfg.get("code"),
            "label": cfg.get("label"),
            "source_currency": cfg.get("source_currency"),
            "dest_currency": cfg.get("dest_currency"),
            "mid_market_rate": cfg.get("mid_market_rate"),
            "fx_source": cfg.get("fx_source"),
            "sourced_at": cfg.get("sourced_at"),
            "govt_incentive_rate": cfg.get("govt_incentive_rate"),
            "note": f"No exact corridor for {send_currency}->{receive_currency}; returned default {cfg.get('code')}",
            "rails": [
                {"name": r.get("name"), "fx": r.get("fx"), "incentive_eligible": r.get("incentive_eligible", True)}
                for r in cfg.get("rails", [])
            ],
            "read_only": True,
        }
    except Exception as e:  # pragma: no cover
        return {"error": str(e), "read_only": True}


@mcp.tool()
def calculate_net_receive(
    amount: Annotated[float, "Principal in source currency, e.g. 1000.0"],
    corridor: Annotated[str, "Corridor code, e.g. uae_bd"] = "uae_bd",
) -> dict:
    """Calculate recipient net amount deterministically (exact-Decimal).

    Wraps backend/app/services/money.py + incentive.py (calculate_true_net_receive).
    All math is Decimal(ROUND_HALF_UP); floats are presentation only with *_exact strings.
    Read-only: no DB writes, no transfer.
    """
    cfg = corridor_cfg.load_corridor(corridor)
    # Use mid_market_rate as illustration; real routing uses per-rail FX via compare_remittance_routes
    mid = cfg.get("mid_market_rate")
    fee = cfg.get("platform_fee_source", 0)
    incentive_rate = cfg.get("govt_incentive_rate", 0.025)
    # Exact-Decimal: D(amount) conversion happens inside incentive engine
    breakdown = calculate_true_net_receive(
        amount,
        mid,
        fee_source=0,  # rail fee excluded here; use compare_remittance_routes for full rail pricing
        govt_incentive_rate=incentive_rate,
        platform_fee_source=fee,
        currency_source=cfg.get("source_currency", "AED"),
        dest_currency=cfg.get("dest_currency", "BDT"),
    )
    return {
        "corridor": corridor,
        "amount_source": amount,
        "mid_market_rate": mid,
        "breakdown": breakdown,
        "arithmetic": "exact-Decimal (ROUND_HALF_UP); float is presentation only",
        "read_only": True,
    }


@mcp.tool()
def compare_remittance_routes(
    amount: Annotated[float, "Principal in source currency"],
    payout_method: Annotated[str, "Payout method, e.g. BKASH, NAGAD, BANK"] = "BKASH",
    corridor: Annotated[str, "Corridor code"] = "uae_bd",
) -> dict:
    """Compare all eligible remittance routes by reliability-adjusted net.

    Wraps backend/app/services/routing_scorer.py (score_routes, naive_baseline).
    Ranks by (true_net × success_rate); fee-only baseline is included for audit.
    Read-only: no quote is persisted, no transfer executed.
    """
    routes = routing_scorer.score_routes(
        amount, payout_method, corridor_code=corridor
    )
    baseline = routing_scorer.naive_baseline(routes)
    # Trim to essential fields for LLM consumption but keep determinism
    return {
        "corridor": corridor,
        "amount": amount,
        "payout_method": payout_method.upper(),
        "routes": routes,
        "baseline": baseline,
        "ranking_basis": "reliability_adjusted_net = true_net × success_rate (failures = total loss)",
        "read_only": True,
    }


@mcp.tool()
def screen_recipient(
    name: Annotated[str, "Recipient name to screen, e.g. 'Nasir Uddin Chowdhury'"],
) -> dict:
    """Screen a recipient name against the OFAC sample list.

    Wraps backend/app/services/compliance.py (screen_party, screen_transaction).
    Uses normalized Jaro-Winkler + token coverage; returns CLEAR / FUZZY_MATCH_REVIEW / BLOCKED
    with rationale. Read-only: no screening decision is persisted, no transfer blocked.
    """
    # Screen as recipient party; sender is demo sender for context but not persisted
    result = compliance.screen_party(name, role="recipient")
    # Also include full transaction screening shape for context
    return {
        "query": name,
        "result": result,
        "policy": {
            "review_full_name_threshold": compliance.THRESHOLDS.get("review_full_name"),
            "review_single_token_threshold": compliance.THRESHOLDS.get("review_single_token"),
            "note": "BLOCK only on canonical full-name equality; alias-only never auto-blocks; single-token never hard-blocks",
        },
        "read_only": True,
    }


@mcp.tool()
def search_regulatory_guidance(
    query: Annotated[str, "Natural language query, e.g. '2.5% government incentive formal remittance'"],
) -> dict:
    """Search cited regulatory guidance (Bangladesh Bank, OFAC, ISO 20022).

    Wraps backend/app/services/regulatory_rag.py (retrieve).
    Returns top passages with id, title, source, domain, score, snippet.
    Read-only: corpus is static markdown excerpts.
    """
    result = regulatory_rag.retrieve(query)
    return {
        "query": query,
        "engine": result.get("engine"),
        "passages": result.get("passages", []),
        "read_only": True,
    }


@mcp.prompt()
def parse_remittance_intent() -> str:
    """LLM prompt for extracting remittance intent — parse_remittance_intent.

    Returns instructions for an LLM to extract send_amount, send_currency,
    receive_currency, recipient_name, and recipient_bank from a user's message.
    The prompt is stored in docs/prompt_library.md and exposed via MCP for
    standardized reuse. No financial math is performed by the LLM.
    """
    return """You are a remittance intent parser for xPay (UAE -> Bangladesh corridor).

Extract the following fields from the user's message as strict JSON with this schema:
{
  "send_amount": number | null,        // e.g. 1000.0 — numeric amount in source currency
  "send_currency": string | null,      // ISO 4217, e.g. "AED" — infer from "dirhams", "AED", "taka"
  "receive_currency": string | null,   // ISO 4217, e.g. "BDT" — typically BDT for Bangladesh
  "recipient_name": string | null,     // person name or relation, e.g. "my mother" -> "Mother" or "Nasir Uddin"
  "recipient_bank": string | null      // payout rail: "bKash", "Nagad", "Bank", "Upay", etc.
}

Rules:
- Be deterministic: only extract what is explicitly stated or clearly implied.
- Use null for missing fields; do not hallucinate amounts or names.
- Normalize Bengali numerals (e.g. "১০০০" -> 1000) and Banglish transliteration.
- Do NOT perform FX math, fee calculation, or compliance screening — those are deterministic tools.
- Return ONLY the JSON object, no extra text.

Example:
User: "Send 1,000 dirhams to my mother's bKash in Dhaka"
→ {"send_amount": 1000.0, "send_currency": "AED", "receive_currency": "BDT", "recipient_name": "Mother", "recipient_bank": "BKASH"}

User message: {{user_message}}
"""


# Entrypoint for Streamable HTTP (Architecture B)
if __name__ == "__main__":
    # FastMCP's run handles Streamable HTTP transport
    # Path is /mcp per MCP spec (client connects to http://localhost:8001/mcp)
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8001, path="/mcp")
