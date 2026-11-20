# xPay — Project TODO / Done

## Frontend — Remittance Experience
- [x] Deliver a useful, attractive remittance homepage while preserving send-money workflow, API calls, quote binding, voice input, language toggle, and receipt lifecycle.
- [x] Make recipient net receive the primary outcome; expose route economics, fees, arrival time, incentive eligibility, and compliance state in the quote experience.
- [x] Add a responsive product shell (desktop + mobile) without new runtime dependencies.
- [x] Keep `/roi` route and add route manifest for `/` and `/roi`.
- [x] Add live `/docs` module at `{frontend}/docs` — YC pitch + whitepaper + live dashboard (Mermaid, sticky nav, admin drawer, PDF export).

## Backend — API & Data Layer
- [x] Migrate auth from `users.json` to PostgreSQL `users` table via `AsyncSession` (SQLAlchemy 2.0, asyncpg, alembic `001_init`, `scripts/seed_db.py` hardcoded + bcrypt, idempotent).
- [x] Add JWT RBAC (admin/user/guest) — `POST /token`, `GET/POST /api/users`, `DELETE /api/users/{email}` (admin cannot self-delete), guest read-only for quote/compare, user/admin for execute.
- [x] Ensure all DB ops use `AsyncSession`; deterministic `Decimal` math before DB persistence.
- [x] Add live docs persistence: `DocsConfig` + `TeamMember` (`app/models/docs.py`, `alembic 002_docs`, `app/api/docs.py` — public `GET /api/docs/config|live-data|team`, admin `PUT/POST/DELETE`).
- [x] Seed live docs: `scripts/seed_docs.py` (DocsConfig public + 30-day window, 3 team members including Tanu Sen Riya — Backend Engineer) + `scripts/seed_team.py`.

## AI & MCP
- [x] Implement MCP Architecture B (separate process): `backend/app/mcp/server.py` (`xpay-financial-intelligence-mcp` on `:8001` Streamable HTTP, 5 read-only tools + `parse_remittance_intent` prompt) + `backend/app/mcp/client.py` (ClientSession, `list_tools`/`call_tool`) + LangGraph adapter in `orchestrator.py` (discover + fallback to direct services).
- [x] Fix MCP health probe: `GET http://mcp-server:8001/health` via `@mcp.custom_route("/health")`, backend probes `MCP_SERVER_URL` (env, default `http://localhost:8001/health`) with `httpx` 1s, frontend shows `Active` (green pulse) / `Inactive (Offline)` (red) with fallback tooltip.
- [x] Upgrade Regulatory RAG: semantic chunking (sentence-boundary, 3-4 sentences, 1 overlap), contextual embeddings (`[Document: {title} | Section: {section}]`), NetworkX Graph RAG (entities + co-occurrence edges, hybrid `+0.15` bonus).

## Docs & Ops
- [x] Update `AGENT.md` (Data Layer: PostgreSQL, Live Docs, DB rule, RAG maintenance), `README.md` (structure, quickstart with `alembic upgrade head && seed_db.py/seed_docs.py`, auth table, live docs section, team includes Tanu), `docs/MCP_ARCHITECTURE.md` (read-only, PostgreSQL via services).
- [x] Pin `mcp[cli]>=1.9,<2` and handle `FastMCP`/`MCPServer` both versions; `FastMCP(host="0.0.0.0", port=8001, streamable_http_path="/mcp")` + `mcp.run(transport="streamable-http")` stays running.
- [x] Add `httpx>=0.24` and `aiosqlite>=0.20` (SQLite fallback for local dev without Docker: default `sqlite+aiosqlite:///./xpay.db`, Docker overrides to `postgresql+asyncpg://postgres:postgres@db:5432/xpay`).
- [x] `backend/Dockerfile` — `build-essential` + `curl`, copy `alembic`/`scripts`, CMD `alembic upgrade head && seed_db && seed_docs && uvicorn`; `backend/.dockerignore` ensures `app/mcp/` not ignored.
- [x] `docker-compose.yml` — `db` (postgres:16-alpine, pgdata, healthcheck), `backend` + `mcp-server` depend on `db` healthy, `MCP_SERVER_URL=http://mcp-server:8001`, `frontend` depends on `backend`+`mcp-server`.
- [x] `.github/workflows/ci.yml` — postgres service for `test` and `docker` jobs, `DATABASE_URL` env, `alembic upgrade head` + `seed_db.py` + `seed_docs.py` before tests, authenticated smoke `curl` with JWT.

## Verification — Live End-to-End
- [x] Connect app to running backend for live verification: `docker compose up --build` → `db` healthy, `backend` `PostgresqlImpl` + `Uvicorn running on http://0.0.0.0:8000`, `mcp-server` stays up on `:8001` with `/health` 200, `frontend` `✓ Compiled` + `✓ Ready on http://localhost:3000`, `curl http://localhost:8000/api/health` 200, `curl http://localhost:8000/api/docs/live-data` 200 with `mcp_status`, `curl http://localhost:8001/health` 200.
