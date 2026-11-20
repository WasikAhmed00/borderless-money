# AGENT.md - Context & Memory File

## 1. System Overview & Architecture
**Project:** xPay (borderless-money)
**Core Value Proposition:** AI-assisted, jurisdiction-aware cross-border remittance that optimizes for the highest *recipient net-receive* amount, factoring in exact FX rates, fees, and regulatory incentives.
**Architecture:** Monorepo containing a FastAPI backend (`/backend`) and a Next.js 14 frontend (`/frontend`).
**Data Layer:** PostgreSQL (async via SQLAlchemy 2.0) — `app/db/database.py` (AsyncEngine + AsyncSession), `app/models/` (Mapped classes), `alembic/` (versioned migrations), `app/core/config.py` (DATABASE_URL via pydantic-settings). Deterministic math (Decimal) runs before DB persistence — DB is storage only.
**Core Routing Flow:** 
`Intent Parse` → `Price Routes` → `Risk Screen` → `Rank` → `Execute` (Quote & Receipt Generation).
**Live Docs:** `/docs` is a live module (YC pitch + whitepaper + dashboard) — configuration (`DocsConfig`: `is_public`, `start_time`, `end_time`) and team (`TeamMember`) are stored in PostgreSQL via `AsyncSession` and served through `app/api/docs.py` (public reads, admin writes). Live metrics (`/api/docs/live-data`) are exact Decimal where money is involved.

## 2. Critical Fintech Rules (Zero Tolerance)
When generating or modifying code for this repository, you MUST adhere to the following non-negotiable rules:
*   **NEVER use floating-point numbers for money.** All currency, FX spread, and fee calculations MUST use exact-decimal representations (e.g., Python's `decimal.Decimal` or integers representing the smallest currency unit).
*   **LLMs are strictly OFF the critical path for math.** The agent can parse user intent, but a deterministic engine MUST calculate fees, FX spreads, and final amounts. Reject any LLM output that attempts to hallucinate a numerical figure.
*   **Compliance is absolute.** Fuzzy OFAC matches with a score of `≥ 0.90` must trigger a human-in-the-loop hold. Never auto-block a transaction based solely on an alias match. Exact canonical full-name matches are the only auto-blocks.
*   **PII Minimization.** Never expose Personally Identifiable Information in application logs. Only hashes and non-identifying audit data should touch the ledger.

## 3. Tech Stack & Coding Standards
*   **Backend (Python):** 
    *   Framework: FastAPI, Uvicorn.
    *   Validation: Pydantic (strictly enforce schemas for all I/O).
    *   Typing: Enforce Python type hints for all function signatures.
    *   Testing: `pytest`. All new features (especially routing logic) MUST include deterministic unit tests.
    *   Database: PostgreSQL 16 via `sqlalchemy[asyncio]` + `asyncpg` + `AsyncSession` + `alembic`. **All database interactions MUST use AsyncSession** — no synchronous SQLAlchemy in app code.
*   **Frontend (TypeScript):** 
    *   Framework: Next.js 14 (App Router), React.
    *   Styling: Tailwind CSS.
    *   Standards: Use functional components and strict TypeScript interfaces.
*   **AI/ML:** 
    *   Orchestration: LangGraph (state machine).
    *   Risk Scoring: PyTorch Geometric (GNN) - *Note: deterministic stand-in is the default; trained GNN is opt-in*.
    *   Embeddings: Sentence Transformers (optional, fallback to lexical is required).

## 4. AI Agent & Prompting Guidelines
*   **Deterministic First:** Always prefer the deterministic rule-based parser for intent extraction. The schema-validated LLM fallback is optional and must be off by default.
*   **Explainability:** Every quote and recommendation must return a plain-language reasoning log (Intent → Ranking → Screening → Execution).
*   **Strict JSON Outputs:** When writing prompts for internal LLM usage (e.g., LangGraph nodes), enforce strict JSON schema outputs. 

## 5. Documentation Standards
*   **Evergreen Documentation:** Do NOT add hackathon sprint dates, timeline references, or ephemeral status updates (e.g., "Oct 25 deliverable"). Write documentation as if the system is a living, production-ready project.
*   **Honest Limitations:** Clearly document that this is a prototype. The sanctions matcher uses a sample list, deployment is currently Docker-based (PostgreSQL via `docker-compose` + async SQLAlchemy), and JWT authentication (admin/user/guest RBAC) is now present but still demo-grade (dummy SECRET_KEY, bcrypt hashes, no email verification).
