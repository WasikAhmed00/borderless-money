"""xPay MCP Client — connects LangGraph agent to the read-only MCP server.

Connects to http://localhost:8001/mcp via Streamable HTTP.
- Initializes mcp.ClientSession
- Lists available tools
- Helper to call a tool and return JSON result

Used by backend/app/agent/orchestrator.py to discover tools dynamically.
"""

import asyncio
import json
from typing import Any, Optional

# MCP client imports (from mcp[cli])
try:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    MCP_AVAILABLE = True
except ImportError:  # pragma: no cover
    MCP_AVAILABLE = False
    ClientSession = None  # type: ignore
    streamablehttp_client = None  # type: ignore

MCP_URL = "http://localhost:8001/mcp"


async def _list_tools_async(url: str = MCP_URL) -> list[dict]:
    """List tools from the MCP server (async)."""
    if not MCP_AVAILABLE:
        return []
    try:
        async with streamablehttp_client(url) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.list_tools()
                tools = getattr(result, "tools", []) or []
                return [
                    {
                        "name": t.name,
                        "description": getattr(t, "description", ""),
                        "inputSchema": getattr(t, "inputSchema", {}),
                    }
                    for t in tools
                ]
    except Exception:
        # MCP server not running or unreachable — caller should fallback to direct services
        return []


def list_tools(url: str = MCP_URL) -> list[dict]:
    """Sync wrapper to list tools (for non-async callers)."""
    try:
        return asyncio.run(_list_tools_async(url))
    except RuntimeError:
        # If already in an event loop, create new loop in thread
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, _list_tools_async(url))
            return future.result(timeout=5)
    except Exception:
        return []


async def _call_tool_async(tool_name: str, arguments: dict, url: str = MCP_URL) -> Any:
    """Call a tool on the MCP server (async)."""
    if not MCP_AVAILABLE:
        return {"error": "mcp not installed"}
    async with streamablehttp_client(url) as (read, write, _):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool(tool_name, arguments=arguments)
            # result.content is list of TextContent / Json
            # Normalize to JSON-serializable
            if hasattr(result, "content"):
                # FastMCP returns content blocks; extract text/json
                out = []
                for block in result.content:
                    if hasattr(block, "text"):
                        try:
                            out.append(json.loads(block.text))
                        except Exception:
                            out.append(block.text)
                    elif isinstance(block, dict):
                        out.append(block)
                    else:
                        out.append(str(block))
                # If single JSON block, return it directly
                if len(out) == 1 and isinstance(out[0], dict):
                    return out[0]
                return out
            # Fallback: if result has structuredContent
            if hasattr(result, "structuredContent") and result.structuredContent:
                return result.structuredContent
            return {"result": str(result)}


def call_tool(tool_name: str, arguments: dict, url: str = MCP_URL, timeout: int = 10) -> Any:
    """Sync helper to call a tool and return JSON result.

    Example:
        call_tool("get_corridor_fx_rate", {"send_currency": "AED", "receive_currency": "BDT"})
        call_tool("compare_remittance_routes", {"amount": 1000.0, "payout_method": "BKASH"})
    """
    if not MCP_AVAILABLE:
        return {"error": "mcp not installed; fallback to direct services", "tool": tool_name}

    async def _run():
        return await _call_tool_async(tool_name, arguments, url)

    try:
        return asyncio.run(_run())
    except RuntimeError:
        # Already in event loop — run in thread
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, _run())
            return future.result(timeout=timeout)
    except Exception as e:  # pragma: no cover
        return {"error": str(e), "tool": tool_name}


# Convenience sync helpers for each of the 5 tools (optional)

def get_corridor_fx_rate(send_currency: str, receive_currency: str) -> Any:
    return call_tool("get_corridor_fx_rate", {"send_currency": send_currency, "receive_currency": receive_currency})


def calculate_net_receive(amount: float, corridor: str = "uae_bd") -> Any:
    return call_tool("calculate_net_receive", {"amount": amount, "corridor": corridor})


def compare_remittance_routes(amount: float, payout_method: str = "BKASH", corridor: str = "uae_bd") -> Any:
    return call_tool(
        "compare_remittance_routes", {"amount": amount, "payout_method": payout_method, "corridor": corridor}
    )


def screen_recipient(name: str) -> Any:
    return call_tool("screen_recipient", {"name": name})


def search_regulatory_guidance(query: str) -> Any:
    return call_tool("search_regulatory_guidance", {"query": query})


if __name__ == "__main__":
    # Simple demo: list tools and call one
    import pprint

    print(f"Connecting to {MCP_URL} ...")
    tools = list_tools()
    print(f"Found {len(tools)} tools:")
    for t in tools:
        print(f" - {t['name']}: {t['description'][:80]}")

    if tools:
        print("\nCalling get_corridor_fx_rate(AED->BDT) ...")
        pprint.pprint(get_corridor_fx_rate("AED", "BDT"))
