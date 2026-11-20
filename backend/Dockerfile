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

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
