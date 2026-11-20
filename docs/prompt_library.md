# xPay Prompt Library

Centralized, versioned prompts for xPay's AI flows. Prompts are exposed via MCP (`parse_remittance_intent`) and stored here for auditability, reuse, and hackathon provenance.

> **Provenance:** Prompts are read-only artifacts — they guide extraction, never perform financial math. All money calculations remain deterministic in `backend/app/services/money.py` and `incentive.py`.

---

## 1. `parse_remittance_intent` — Remittance Intent Extraction

**MCP name:** `parse_remittance_intent`  
**Exposed via:** `backend/app/mcp/server.py` (`@mcp.prompt()`) and this file  
**Used by:** LangGraph orchestrator (`parse_intent_node`) — the MCP client discovers this prompt for LLM-assisted fallback (schema-validated, off by default)

**Purpose:** Extract structured remittance fields from a user's natural language message (English, Bangla, Banglish, Arabic phrases) without performing FX math or compliance decisions.

**Prompt:**

```
You are a remittance intent parser for xPay (UAE -> Bangladesh corridor).

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
```

**Schema validation:** `backend/app/services/llm.py` (`INTENT_SCHEMA`) validates the JSON — wrong types, missing keys, or extra text are rejected (`missing:amount`, `bad-type:amount`, `invalid-json`). The deterministic parser (`backend/app/services/intent_parser.py`) is always tried first; this prompt is only used when it finds no amount and `XPAY_LLM_API_KEY` is set.

**Determinism guarantee:** `config.GOVT_INCENTIVE_RATE`, `money.D()`, `incentive.calculate_true_net_receive` — never the LLM — compute the final taka. The prompt's output is ground-checked by `explainer.allowed_numbers()`.

---

## 2. Future prompts (reserved)

- `synthesize_quote_explanation` — grounded explanation generation (currently via `backend/app/services/explainer.py` templates, LLM paraphrase gated by number guard)
- `screening_rationale` — compliance hold explanation (currently via `compliance.screen_party().rationale`)

All prompts in this library are read-only and versioned in git. No prompt may mutate the quote store, ledger, or user credentials.
