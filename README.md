<p align="center">
  <img src="./frontend/public/assets/xpay-logo.png" alt="xPay Logo" width="200"/>
</p>
<h1 align="center">xPay</h1>

<p align="center">AI-assisted, jurisdiction-aware remittance intelligence that recommends the eligible route with the highest recipient net amount and explains every decision.</p>

<p align="center">
  <a href="https://cloudcampbd.com/ai-builders-congress">International AI Builders Congress 2026</a> · FinSphere AI · Challenge: Borderless Money<br/>
  <strong>Team CTRL V</strong> — Idea to Unicorn
</p>

---

## Problem

Bangladesh is among the world's largest remittance recipients. Workers in the UAE sending AED 1,000 home typically lose 3–6% to FX spreads and stacked fees, and almost no consumer app computes the **Bangladesh Bank 2.5% cash incentive** for formal-channel remittance into the route choice. Existing tools optimize headline fees, not the taka that actually arrives, and they do not explain compliance holds in plain language.

**Primary user:** a UAE-based migrant worker sending to family in Bangladesh via bKash/Nagad/bank, often on a mid-range Android, often in Bangla and by voice. **Secondary user:** a remittance fintech or mobile-money operator evaluating routes through an API.

## Solution

**xPay is an AI-assisted, jurisdiction-aware remittance intelligence prototype that helps compare eligible transfer routes, calculate recipient net amounts, explain routing decisions, and demonstrate compliance-aware transfer workflows.**

A worker says *"Send 1,000 dirhams to my mother's bKash in Dhaka"* — xPay parses intent, prices every viable rail end-to-end (FX, rail fee, last-mile fee, platform fee, and incentive eligibility), screens for risk and sanctions, ranks routes by reliability-adjusted net amount, and shows a receipt with a full audit trail. The worker confirms an exact, time-bound quote before any transfer step is demonstrated.

The core value is **recipient net-receive optimization with transparent, explainable trade-offs**, not hidden cheapest-fee marketing.

## How xPay works

1. **Voice or text input** — Web Speech API on the frontend; multilingual intent parser on the backend (English, Bangla, Banglish, and evaluated Arabic phrases).
2. **Agentic orchestrator (LangGraph)** — a state machine that calls deterministic Python tools in order: intent parsing → rail pricing → risk and compliance screening → ranking and explanation. An identical sequential fallback runs when LangGraph is not installed, so the demo never depends on the graph runtime.
3. **Scoring and execution engine (Python)** — corridor-driven rail pricing, exact-decimal incentive math, OFAC-aware fuzzy screening with human-review outcomes, and a clearly labeled simulated settlement adapter. Every quote is persisted with a TTL and must be explicitly confirmed at execution.
4. **Receipt and monitoring** — status, amount, route, timing, reference ID, simulated ledger hash, and ISO 20022 payload, with metrics exposed at `GET /metrics`.

Full flow, failure paths, and the quote lifecycle are documented in [docs/architecture.md](docs/architecture.md) and [docs/FINANCIAL_MODEL.md](docs/FINANCIAL_MODEL.md).

## Demo

- **Live app:** `http://localhost:3000` after `docker compose up --build` (or `npm run dev` in `frontend/` + `uvicorn app.main:app` in `backend/`).
- **Bilingual UI:** `EN | বাংলা` toggle on all screens, persisted in `xpay-lang`; Bangla voice and numerals are handled end-to-end.
- No public demo link is claimed in this repository — run the stack locally to reproduce the screenshots and metrics below.

## Key features (verified in code)

- **Multilingual intent parsing** — rule-based, deterministic where money is involved; handles Bengali numerals, inflections, and Banglish transliteration.
- **Corridor-driven routing** — rails, FX, fees, and incentive eligibility are data in `backend/config/corridors/*.json`; adding a corridor is a new file, not code. Ranked by reliability-adjusted net (`true_net × success_rate`).
- **Exact-decimal financial engine** — all money math in `Decimal` with half-up rounding, missing pricing flagged as `incomplete` and barred from winning or settling.
- **Compliance-aware workflow** — OFAC-aware fuzzy screening (normalized Jaro + coverage) with `CLEAR` / `REVIEW` / `BLOCKED` outcomes, GNN risk scoring (experimental, synthetic), and plain-language explanations.
- **Quote lifecycle and safety** — persisted `quote_id` + 60-minute expiry, confirmation binding, `Idempotency-Key` retries, and uncertain settlement reported as `RECONCILIATION_REQUIRED`, never as success.
- **Regulatory retrieval** — cited passages from Bangladesh Bank, OFAC, and ISO 20022 excerpts are returned as `regulatory_basis` in every quote and execution response.
- **Bangla-capable frontend** — Next.js 14 + Tailwind, voice input, and the `/roi` operator ROI calculator.

See [docs/api-contracts.md](docs/api-contracts.md) for request/response contracts and [REAL_VS_SIMULATED.md](REAL_VS_SIMULATED.md) for the implementation truth table.

## Example calculation

xPay ranks routes by what the family **actually receives**, not headline fees. The Bangladesh Bank incentive is applied only where `incentive_eligible` is true per `backend/config/corridors/uae_bd.json`.

```
Gross  = Principal(AED) × FX
Fees   = Fees(AED) × FX
Net    = Gross − Fees + Eligible incentive(BDT)
```

**Reproducible example — AED 1,000 to bKash (simulated snapshots, corridor math):**

| Route | FX | Fees (AED) | Incentive (BDT) | True net receive (BDT) | Time |
| :--- | ---: | ---: | ---: | ---: | ---: |
| **Stellar Hybrid Anchor → bKash** (recommended) | 32.80 | 6.00 (3.00 rail + 1.00 last-mile + 2.00 xPay) | +820.00 | **33,423.20** | 2 h |
| Exchange House MTO → bKash | 32.30 | 14.00 | +807.50 | 32,655.30 | 6 h |
| Traditional SWIFT → bKash (via xPay) | 32.40 | 26.00 | +810.00 | 32,367.60 | 28 h |
| *Legacy SWIFT outside xPay (counterfactual, no platform fee)* | 32.40 | 24.00 | +810.00 | 32,432.40 | 28 h |

The recommended rail delivers **990.80 BDT more (+3.05%)** than the legacy baseline after xPay's own fee is paid. The receipt shows the same line items. All figures are recomputable from `backend/config/corridors/uae_bd.json` and `backend/app/services/incentive.py`; see [docs/FINANCIAL_MODEL.md](docs/FINANCIAL_MODEL.md) for rounding, completeness, and eligibility rules.

## Architecture

```
Client (Next.js + Voice) → Agentic orchestrator (LangGraph / sequential fallback)
  → Scoring engine: routing scorer · incentive calculator · GNN risk + OFAC screening
  → Quote store → Confirmation gate → Simulated settlement → Receipt
                               ↘ Regulatory RAG (cited passages)
```

- **Layer B (orchestrator):** `backend/app/agent/orchestrator.py`
- **Layer A (scoring):** `backend/app/services/` — incentive, routing, compliance, risk, corridor, intent, RAG, money, quotes, store, stellar
- **Data:** `backend/config/corridors/*.json`, `backend/data/*.json`, `backend/rag/corpus/`
- **ML:** `backend/ml/train_gnn.py` + `backend/ml/model.pt` (synthetic)

Details, sequence diagram, and failure paths: [docs/architecture.md](docs/architecture.md).

## AI and ML components

| Component | Role | Status |
| :--- | :--- | :--- |
| Multilingual intent parser | Extracts amount, corridor, payout method, recipient, urgency from text/voice | **Implemented** — rule-based, deterministic |
| LangGraph orchestrator | Calls tools in order and logs reasoning | **Implemented** — with sequential fallback |
| Routing scorer | Prices rails end-to-end and ranks by reliability-adjusted net | **Implemented** — exact-decimal |
| GNN risk model (`RemittanceGNN`, PyTorch Geometric) | Scores pre-settlement risk on a transaction graph | **Experimental** — trained on synthetic data (2,400 transactions, AUC 0.9038 on held-out split; see limitations) |
| Logistic regression / rule stand-ins | Baselines for the same synthetic task | **Experimental** — ablation shows no GNN advantage on this data |
| OFAC fuzzy matcher | Normalized Jaro + coverage with rationale | **Implemented** — sample list only |
| Regulatory RAG | Retrieves cited Bangladesh Bank / OFAC / ISO 20022 passages | **Implemented** — lexical fallback if embeddings unavailable |
| Bounded LLM | Optional schema-validated intent assistance | **Experimental** — off by default, never does arithmetic |

LLM outputs are schema-validated and cannot override financial calculations; see [docs/SECURITY_AND_RESPONSIBLE_AI.md](docs/SECURITY_AND_RESPONSIBLE_AI.md).

## Real vs simulated

Every simulated surface is labeled **Simulated** in the UI and API (`simulated: true`, `network: SIMULATED`). The full truth table is in [REAL_VS_SIMULATED.md](REAL_VS_SIMULATED.md).

| Capability | Real (in this repo) | Simulated / mocked |
| :--- | :--- | :--- |
| 2.5% incentive math | Real policy, real engine | Pricing is demo snapshots |
| Routing and fee comparison | Real engine, config-driven | Corridor FX/fees are snapshots |
| OFAC screening | Real fuzzy-matching engine | Sample sanctions list (local JSON) |
| GNN risk scoring | Prototype model shipped (`ml/model.pt`) with published eval and ablation | Trained on synthetic data; deterministic stand-in is the default |
| Stellar settlement | Deterministic simulated adapter, clearly labeled | Testnet path payment is a future milestone — requires funded issuer/distributor and trustlines |
| bKash/Nagad payout | — | Mock recipient registry |
| FX feeds, live bKash/Nagad APIs, licensed remittance integration | — | Future milestones, not claimed as working |

xPay is a research and hackathon prototype, not a licensed remittance provider.

## Verified evaluation results

All numbers below are computed from this repository and served at `GET /metrics`. The **single source of truth** is [docs/kpis.md](docs/kpis.md) — other documents reference it. Curated and synthetic benchmarks are labeled as such and are not production statistics.

| KPI | Measured | Target | How |
| :--- | ---: | :--- | :--- |
| Net-receive uplift vs SWIFT (AED 1,000 → bKash) | **+3.05%** | ≥ 3.0% | 33,423.20 vs 32,432.40 (corridor math) |
| Intent accuracy (en/bn/ar) | **100%** | ≥ 95% | 49 curated utterances (`backend/data/intent_eval.json`) |
| p95 quote latency (end-to-end HTTP) | **21.2 ms** | ≤ 3,000 ms | 300 loopback `POST /api/agent/quote` (`reports/load_test.txt`) |
| False-positive hold rate | **0.0%** | ≤ 2.0% | 21 clear names (`data/sanctions_eval.json`) |
| OFAC recall (exact/leet hits) | **100%** | 100% | 11 true hits BLOCKED on 58-case benchmark |
| GNN test AUC (synthetic — prototype evidence) | **0.9038** | — | Held-out split (ceiling ≈0.94 at 2% label noise); linear rule matches it — see `backend/ml/ablation.md` |
| Producer risk gate recall at 0.8 | **0.0%** | — | Raw GNN scores never reach the policy threshold; recalibration required before review use |

See [docs/kpis.md](docs/kpis.md) for methodology and [docs/VALIDATION_REPORT.md](docs/VALIDATION_REPORT.md) for reproduction steps.

## Quickstart

**Docker (recommended, full stack):**
```bash
docker compose up --build
# backend  → http://localhost:8000  (API docs at /docs)
# frontend → http://localhost:3000
```

**Backend (local venv):**
```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-full.txt  # or requirements-lite.txt for the fast path
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
cp .env.local.example .env.local  # points at http://localhost:8000
npm run dev
```

**No-install verification:**
```bash
python3 backend/tests/test_core.py   # core engines, stdlib only
python3 backend/run_demo.py          # end-to-end quote → receipt in the terminal
```

**Demo scenarios:** pass `demo_scenario` in `POST /api/agent/execute` or pick it in the UI — `default` (CLEAR), `fuzzy_review` (near-match held for review), `high_risk` (manual review).

## API overview

| Method | Path | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Liveness + corridors + engine flags |
| `GET` | `/api/ready` | Readiness checks |
| `POST` | `/api/agent/parse-intent` | Text/voice → structured intent (en/bn/ar) |
| `POST` | `/api/agent/quote` | Intent → ranked routes → citations → persisted `quote_id` |
| `POST` | `/api/agent/execute` | Compliance gate → quote binding → simulated execution → receipt (`Idempotency-Key` honored) |
| `GET` | `/api/transactions/{id}` | Stored receipt |
| `GET` | `/api/quotes/{quote_id}` | Quote with live status `ACTIVE/EXPIRED/CONSUMED` |
| `GET` | `/api/routes/compare` | Direct rail comparison (`?corridor=uae_bd`) |
| `GET` | `/metrics` | Measured KPIs (from in-repo eval sets) |

Cross-cutting: `X-Request-ID` on every response, per-IP rate limiting on `/api/*`, optional `XPAY_API_KEY`. Contracts: [docs/api-contracts.md](docs/api-contracts.md).

## Repository structure

```
.
├── AGENT.md                 # agent context & fintech guardrails
├── README.md
├── REAL_VS_SIMULATED.md     # claim-by-claim truth table (real vs simulated)
├── Makefile                 # test / eval / docker targets
├── docker-compose.yml       # backend + frontend services
├── plan.md / TODO.md / SUMMARY.md
├── .github/workflows/ci.yml # fresh-checkout CI (tests + docker build)
├── assets/logo/xpay-logo.png
├── backend/
│   ├── app/main.py / app/config.py
│   ├── app/agent/orchestrator.py  # LangGraph state machine (+ sequential fallback)
│   ├── app/services/        # incentive, routing_scorer, compliance, gnn_risk, intent_parser, money, quotes, store, stellar, horizon, regulatory_rag, llm, explainer, roi, metrics
│   ├── app/db/schema.sql
│   ├── config/corridors/    # uae_bd.json / ksa_bd.json / my_bd.json (pricing as data)
│   ├── data/                # intent_eval.json, sanctions_eval.json, ofac_sample.json, fx_rates.json, recipients.json, rag_eval.json
│   ├── rag/corpus/          # bb_* / iso20022_pacs008 / ofac_screening excerpts
│   ├── ml/                  # train_gnn.py, ablation.py, model.pt, eval.json, ablation.md
│   ├── evals/               # eval_scenarios.py, eval_sanctions.py, eval_rag.py
│   ├── tests/               # test_core.py, test_financial.py, test_roi.py, test_smoke.py, test_step3.py, test_step4.py
│   ├── requirements*.txt / Dockerfile / run_demo.py
│   └── .venv/               # local venv (gitignored)
├── frontend/
│   ├── app/                 # page.tsx, layout.tsx, globals.css, roi/page.tsx
│   ├── components/          # BrandMark, AgentPipeline, ChainTrail, MicButton, FlowDiagram
│   ├── lib/                 # api.ts, i18n.ts, types.ts
│   ├── public/assets/xpay-logo.png + public/favicon.ico
│   ├── package.json / next.config.js / tailwind.config.ts / tsconfig.json
│   └── .env.local.example
├── docs/                    # architecture, api-contracts, FINANCIAL_MODEL, kpis, VALIDATION_REPORT, PRODUCT_STRATEGY, business-validation, SECURITY_AND_RESPONSIBLE_AI, responsible-ai, one-pager, demo-script, competition-analysis, stellar-sensitivity, unit-economics, etc.
├── data/sources.md          # provenance for FX, routing, sanctions, RAG sources
├── deploy/render.yaml
├── reports/                 # load_test.txt, simulation_1000.json, review_volume.json
└── scripts/                 # load_test_p95.py, simulate_1000.py, review_volume.py, stellar_sensitivity.py
```

## Team — CTRL V

| Member | Role |
| :--- | :--- |
| **Sukonya Dutta Pushpa** (Captain) | AI orchestration and explainer |
| **Taskif Bin Parves** | Backend and settlement adapter |
| **Wasik Ahmed** | Routing and incentive engine |
| **Fahim Ahmed** | Frontend and voice UX |
| **Alisha Akter** | RegTech, data, and compliance |

## Responsible AI, privacy, and limitations

- LLM outputs are schema-validated and **cannot override** financial calculations.
- Compliance holds cannot be bypassed by an AI explanation; held transfers require human review (24-hour SLA) and never settle automatically.
- The system **does not autonomously authorize real transfers**; quotes are bound to their original calculations and expired or consumed quotes are refused.
- Uncertain settlement outcomes are reported as `RECONCILIATION_REQUIRED`, never as success.
- Demo data and the sample sanctions list are clearly identified; the matcher is not a legal screening service and citations are not legal advice.
- PII stays off-chain; only hashes and non-identifying audit data touch the ledger.
- Rate limiting and idempotency are per-process in this prototype; production deployment would require shared state, licensed partners, authoritative screening data, and legal/regulatory review.

See [docs/responsible-ai.md](docs/responsible-ai.md) and [docs/SECURITY_AND_RESPONSIBLE_AI.md](docs/SECURITY_AND_RESPONSIBLE_AI.md).

## Documentation

- Architecture and data flow: [docs/architecture.md](docs/architecture.md)
- Financial calculation rules: [docs/FINANCIAL_MODEL.md](docs/FINANCIAL_MODEL.md)
- KPIs and measurement: [docs/kpis.md](docs/kpis.md)
- Validation evidence: [docs/VALIDATION_REPORT.md](docs/VALIDATION_REPORT.md)
- Real vs simulated: [REAL_VS_SIMULATED.md](REAL_VS_SIMULATED.md)
- Product strategy and ROI: [docs/PRODUCT_STRATEGY.md](docs/PRODUCT_STRATEGY.md)
- Business validation: [docs/business-validation.md](docs/business-validation.md)
- Competition mapping: [docs/competition-analysis.md](docs/competition-analysis.md)
- Demo script: [docs/demo-script.md](docs/demo-script.md)
