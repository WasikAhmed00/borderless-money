# xPay — full backend (LangGraph + PyG risk model + RAG)
FROM python:3.12-slim

# Fix 1: Install build tools for mcp[cli] / cryptography / torch_geometric deps that need gcc/cargo/rust
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements-full.txt .
RUN pip install --no-cache-dir -r requirements-full.txt

COPY app ./app
COPY config ./config
COPY data ./data
COPY rag ./rag
COPY evals ./evals
COPY ml ./ml
COPY tests ./tests
COPY alembic ./alembic
COPY alembic.ini ./alembic.ini
COPY scripts ./scripts

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Run migrations and seed users before starting (DB is storage only, math stays Decimal)
CMD sh -c "alembic upgrade head || echo 'migrations skipped (no DB)'; python scripts/migrate_json_to_db.py || true; uvicorn app.main:app --host 0.0.0.0 --port 8000"
