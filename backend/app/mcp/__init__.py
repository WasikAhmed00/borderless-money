"""xPay MCP — Model Context Protocol package.

Architecture B (Separate Process):
- FastAPI app        → port 8000
- MCP server (FastMCP) → port 8001 via Streamable HTTP (read-only)

Exposes 5 deterministic, read-only financial intelligence tools.
"""
