"""Regulatory RAG — Contextual, Semantic Chunking + Graph RAG (NetworkX) + Hybrid Retrieval.

Corpus: backend/rag/corpus/*.md — Bangladesh Bank circular excerpts, OFAC FAQ
excerpts, ISO 20022 reference. Every chunk carries its source line verbatim
(organization + domain) so the API can expose `regulatory_basis` with checkable
citations. Invented citations are fatal for a compliance product, so the source
string is taken from the corpus file, never generated.

Upgrades (Nov 2026):
  1. Semantic Chunking — sentence-boundary splitter (not fixed-char) ensures
     complete clauses like "the 2.5% incentive applies to..." are never cut.
     Recursive-style grouping: 3-4 sentences per chunk with 1-sentence overlap.
  2. Contextual RAG (Anthropic-style) — each chunk is prepended with
     [Document: {doc_title} | Section: {section_title}] before embedding,
     so a chunk about "the incentive" still embeds "UAE" context.
  3. Lightweight Graph RAG (NetworkX) — entities (Corridor, Incentive, Payout)
     become nodes; co-occurrence in a chunk creates HAS_* edges. Retrieval
     extracts query entities, traverses 1-hop neighbors, and merges graph
     hits with vector/lexical scores (Hybrid RAG).

Embeddings: when `sentence-transformers` is installed the *contextualized*
chunks are embedded with all-MiniLM-L6-v2; otherwise a lexical hashed n-gram
TF retriever serves as the documented fallback. `engine` in retrieve()
always reports which one answered.
"""

import math
import re
from functools import lru_cache
from pathlib import Path

CORPUS_DIR = Path(__file__).resolve().parents[2] / "rag" / "corpus"
DIM = 512
TOP_K = 3

try:  # optional: real embeddings when available — loaded LAZILY on first use,
      # never at import time (an eager HF download would block server startup)
    from sentence_transformers import SentenceTransformer

    _ST_AVAILABLE = True
except Exception:  # noqa: BLE001 — lexical fallback is the documented default
    _ST_AVAILABLE = False

_MODEL = None
EMBEDDING_ENGINE = "lexical-ngram-tf"

_WORD_RE = re.compile(r"[a-z0-9%]+")

# --- Semantic chunking helpers ---

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9#\-])")

def _sentences(text: str) -> list[str]:
    """Split text into sentences on .!? boundaries, keeping complete clauses."""
    # Normalize whitespace, then split on sentence boundaries
    text = " ".join(text.split())
    parts = _SENTENCE_SPLIT_RE.split(text)
    # Filter very short fragments, but keep incentive clauses intact
    return [p.strip() for p in parts if len(p.strip()) > 20]

def _semantic_chunks(text: str, max_sentences: int = 4, overlap: int = 1) -> list[str]:
    """Group sentences into overlapping semantic chunks.

    Example: 9 sentences, max 4, overlap 1 → chunks of 4,4,2 sentences.
    This mirrors LangChain RecursiveCharacterTextSplitter with sentence awareness
    and high overlap, ensuring "the 2.5% incentive applies to..." never splits.
    """
    sents = _sentences(text)
    if not sents:
        return []
    if len(sents) <= max_sentences:
        return [" ".join(sents)]
    chunks = []
    i = 0
    while i < len(sents):
        chunk = " ".join(sents[i : i + max_sentences])
        if len(chunk.strip()) > 40:
            chunks.append(chunk)
        if i + max_sentences >= len(sents):
            break
        i += max_sentences - overlap
    return chunks

# --- Graph RAG helpers (NetworkX, lightweight) ---

try:
    import networkx as nx  # type: ignore

    _NX_AVAILABLE = True
except Exception:  # noqa: BLE001
    _NX_AVAILABLE = False
    nx = None  # type: ignore

# Entity patterns — regex-based, no heavy NLP
_ENTITY_PATTERNS = {
    "CORRIDOR": re.compile(r"\b(UAE|AED|Bangladesh|BDT|KSA|SAR|Saudi|India|INR)\b", re.IGNORECASE),
    "INCENTIVE": re.compile(r"2\.5%\s*(?:cash incentive|incentive)?|\b\d+(?:\.\d+)?%\b", re.IGNORECASE),
    "PAYOUT": re.compile(r"\b(bKash|Nagad|Rocket|MFS|Bank|Upay)\b", re.IGNORECASE),
    "CHANNEL": re.compile(r"\b(formal channels?|hundi|informal channels?)\b", re.IGNORECASE),
    "REGULATION": re.compile(r"\b(OFAC|SDN|pacs\.008|ISO\s*20022|Bangladesh Bank)\b", re.IGNORECASE),
}

def _extract_entities(text: str) -> list[tuple[str, str]]:
    """Return list of (entity_text, entity_type)."""
    entities = []
    for etype, pat in _ENTITY_PATTERNS.items():
        for m in pat.finditer(text):
            # Normalize: strip, lower for corridor/payout consistency, keep original for display
            raw = m.group(0).strip()
            # For corridor/payout, normalize to title case for graph key
            if etype in ("CORRIDOR", "PAYOUT", "CHANNEL", "REGULATION"):
                norm = raw.title() if etype != "INCENTIVE" else raw.lower()
            else:
                norm = raw
            entities.append((norm, etype))
    # Deduplicate preserving order
    seen = set()
    uniq = []
    for e in entities:
        if e not in seen:
            seen.add(e)
            uniq.append(e)
    return uniq

def _build_graph(docs: list[dict]):
    """Build NetworkX DiGraph from docs: nodes=entities, edges=co-occurrence in chunk."""
    if not _NX_AVAILABLE or nx is None:
        return None
    G = nx.DiGraph()
    for doc in docs:
        chunk_id = doc["id"]
        text = doc["text"]
        entities = _extract_entities(text)
        # Also include contextual title in entity set for graph
        title_entities = _extract_entities(doc.get("title", "") + " " + doc.get("section", ""))
        all_entities = entities + title_entities
        # Add nodes
        for ent_text, ent_type in all_entities:
            node_id = f"{ent_type}:{ent_text.lower()}"
            if not G.has_node(node_id):
                G.add_node(node_id, text=ent_text, type=ent_type, chunks=set())
            # Track which chunks mention this entity
            G.nodes[node_id]["chunks"].add(chunk_id)
        # Add edges for co-occurrence (undirected via two directed edges)
        for i, (a_text, a_type) in enumerate(all_entities):
            for b_text, b_type in all_entities[i + 1 :]:
                a_id = f"{a_type}:{a_text.lower()}"
                b_id = f"{b_type}:{b_text.lower()}"
                if a_id == b_id:
                    continue
                # Edge label encodes relationship type
                label = f"{a_type}_TO_{b_type}"
                if not G.has_edge(a_id, b_id):
                    G.add_edge(a_id, b_id, label=label, weight=1)
                else:
                    G[a_id][b_id]["weight"] += 1
                if not G.has_edge(b_id, a_id):
                    G.add_edge(b_id, a_id, label=f"{b_type}_TO_{a_type}", weight=1)
                else:
                    G[b_id][a_id]["weight"] += 1
    return G

def _graph_retrieve(query: str, graph, docs_by_id: dict, top_k: int = 3) -> list[str]:
    """Given query, extract entities, traverse 1-hop neighbors, return ranked chunk IDs."""
    if graph is None or not _NX_AVAILABLE:
        return []
    q_entities = _extract_entities(query)
    if not q_entities:
        return []
    # Find matching nodes for query entities (fuzzy: lower match)
    matched_nodes = []
    for q_text, q_type in q_entities:
        q_node = f"{q_type}:{q_text.lower()}"
        if graph.has_node(q_node):
            matched_nodes.append(q_node)
        else:
            # Try partial match: any node with same text substring
            for n in graph.nodes:
                if q_text.lower() in n.lower() or n.lower() in q_text.lower():
                    matched_nodes.append(n)
                    break
    if not matched_nodes:
        return []
    # Collect 1-hop neighbors + the matched nodes themselves
    candidate_chunks: dict[str, int] = {}
    for node in matched_nodes:
        # Chunks directly mentioning this entity
        for cid in graph.nodes[node].get("chunks", set()):
            candidate_chunks[cid] = candidate_chunks.get(cid, 0) + 2
        # 1-hop neighbors
        for neighbor in graph.successors(node):
            for cid in graph.nodes[neighbor].get("chunks", set()):
                candidate_chunks[cid] = candidate_chunks.get(cid, 0) + 1
            # Also 2-hop for corridor-incentive chains (UAE -> 2.5% -> bKash)
            for nn in graph.successors(neighbor):
                for cid in graph.nodes[nn].get("chunks", set()):
                    candidate_chunks[cid] = candidate_chunks.get(cid, 0) + 0.5
    # Rank by score
    ranked = sorted(candidate_chunks.items(), key=lambda x: x[1], reverse=True)
    return [cid for cid, _ in ranked[:top_k]]

# --- Embedding helpers ---

def _hash(s: str) -> int:
    h = 2166136261
    for ch in s:
        h = ((h ^ ord(ch)) * 16777619) & 0xFFFFFFFF
    return h % DIM


def _lexical_embed(text: str) -> list[float]:
    tokens = _WORD_RE.findall(text.lower())
    grams = list(tokens)
    for t in tokens:
        padded = f"^{t}$"
        grams.extend(padded[i:i + 4] for i in range(max(len(padded) - 3, 1)))
    vec = [0.0] * DIM
    for g in grams:
        vec[_hash(g)] += 1.0
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def _embed_texts(texts: list[str]) -> list:
    global _MODEL, EMBEDDING_ENGINE
    if _ST_AVAILABLE and _MODEL is None:
        try:  # first retrieval only; bounded failure → lexical fallback
            _MODEL = SentenceTransformer("all-MiniLM-L6-v2")
            EMBEDDING_ENGINE = "all-MiniLM-L6-v2"
        except Exception:  # noqa: BLE001
            _MODEL = None
            EMBEDDING_ENGINE = "lexical-ngram-tf"
    if _MODEL is not None:
        return _MODEL.encode(texts, normalize_embeddings=True).tolist()
    return [_lexical_embed(t) for t in texts]


def _dense_cosine(a: list[float], b: list[float]) -> float:
    return sum(x * y for x, y in zip(a, b))


def _sparse_cosine(a: dict[int, float], b: dict[int, float]) -> float:
    na = math.sqrt(sum(v * v for v in a.values())) or 1.0
    nb = math.sqrt(sum(v * v for v in b.values())) or 1.0
    small, big = (a, b) if len(a) < len(b) else (b, a)
    return sum(v * big.get(i, 0.0) for i, v in small.items()) / (na * nb)


def _first_domain(source: str) -> str | None:
    m = re.search(r"\((?:www\.)?([a-z0-9.\-]+\.[a-z]{2,})\)", source)
    return m.group(1) if m else None


# --- Corpus with Contextual RAG + Semantic Chunking + Graph ---

_GRAPH = None

@lru_cache(maxsize=1)
def _corpus() -> tuple:
    docs = []
    graph_docs = []  # for graph building
    if not CORPUS_DIR.exists():
        return ()
    for path in sorted(CORPUS_DIR.glob("*.md")):
        try:
            raw = path.read_text(encoding="utf-8")
        except OSError:
            continue
        lines = raw.strip().splitlines()
        title = lines[0].lstrip("# ").strip() if lines else path.stem
        source = next((ln[len("Source: "):].strip() for ln in lines
                       if ln.startswith("Source: ")), path.stem)
        # Extract sections: split on markdown headings
        # Keep section titles for contextual headers
        body = "\n".join(ln for ln in lines if not ln.startswith(("Source:", "Status:")))
        # Split body into sections by headings
        section_splits = re.split(r"\n(?=#{1,3}\s)", body)
        for sec_idx, section_text in enumerate(section_splits):
            sec_lines = section_text.strip().splitlines()
            section_title = ""
            section_body = section_text
            if sec_lines and sec_lines[0].startswith("#"):
                section_title = sec_lines[0].lstrip("# ").strip()
                section_body = "\n".join(sec_lines[1:])
            # Semantic chunking: split section body into sentence-aware chunks
            # Use semantic chunker instead of fixed-char paragraphs
            chunks = _semantic_chunking_fallback(section_body)
            for j, chunk_text in enumerate(chunks):
                # Contextual header (Anthropic-style)
                contextual_text = f"[Document: {title} | Section: {section_title or title}] {chunk_text}"
                chunk_id = f"{path.stem}:{sec_idx}:{j}"
                doc = {
                    "id": chunk_id,
                    "title": title,
                    "section": section_title or title,
                    "source": source,
                    "domain": _first_domain(source),
                    "text": chunk_text,  # original for snippet
                    "contextual_text": contextual_text,  # for embedding
                }
                docs.append(doc)
                graph_docs.append(doc)

    # Build graph from docs
    global _GRAPH
    if _NX_AVAILABLE and docs:
        _GRAPH = _build_graph(graph_docs)

    # Embed contextualized texts (not raw)
    contextual_texts = [d["contextual_text"] for d in docs]
    embeddings = _embed_texts(contextual_texts)
    for d, emb in zip(docs, embeddings):
        if _MODEL is not None:
            d["vector"] = emb
        else:
            d["vector"] = {i: v for i, v in enumerate(emb) if v}
        # Also keep docs_by_id for graph retrieval
        d["graph_chunks"] = {d["id"] for d in docs}  # placeholder
    # Store graph in cache for retrieval
    return tuple(docs)

def _semantic_chunking_fallback(section_body: str) -> list[str]:
    """Wrapper for semantic chunking with paragraph fallback.

    If section_body is short, treat as one chunk. Otherwise, use semantic
    sentence grouping. Falls back to paragraph splitting if needed.
    """
    section_body = section_body.strip()
    if not section_body:
        return []
    # Try semantic chunking
    chunks = _semantic_chunks(section_body, max_sentences=4, overlap=1)
    # If semantic chunking yields no chunks (e.g., no sentence boundaries), fallback to paragraph
    if not chunks:
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", section_body) if len(p.strip()) > 40]
        chunks = [" ".join(p.split()) for p in paragraphs if p]
    # Final fallback: if still empty but text exists, use whole section
    if not chunks and len(section_body) > 20:
        chunks = [" ".join(section_body.split())]
    return chunks

def _get_graph():
    # Ensure corpus is loaded and graph built
    _corpus()
    return _GRAPH

def retrieve(query: str, k: int = TOP_K) -> dict:
    """Top-k corpus passages: {engine, passages: [{id, title, source, domain,
    score, snippet}]}. Hybrid: vector/lexical + Graph RAG bonus.

    Never raises — citations are additive, never load-bearing.
    """
    try:
        docs = _corpus()
        if not docs:
            return {"engine": EMBEDDING_ENGINE, "passages": []}
        # Prepare query embedding (also contextual? For query, no header needed)
        qv = _embed_texts([query])[0]
        # Vector/lexical scoring
        scored: dict[str, float] = {}
        docs_by_id = {d["id"]: d for d in docs}
        for d in docs:
            if _MODEL is not None:
                score = _dense_cosine(qv, d["vector"])
            else:
                score = _sparse_cosine(
                    {i: v for i, v in enumerate(qv) if v}, d["vector"])
            scored[d["id"]] = score

        # Graph RAG bonus: traverse NetworkX graph for query entities
        graph = _get_graph()
        graph_cids = _graph_retrieve(query, graph, docs_by_id, top_k=k) if graph is not None else []
        for cid in graph_cids:
            if cid in scored:
                # Boost graph hits by +0.15 (hybrid) — ensures graph-connected chunks rank higher
                scored[cid] += 0.15
            else:
                # If graph found a chunk not in vector top, give it a modest score
                scored[cid] = scored.get(cid, 0) + 0.1

        # Sort by hybrid score
        ranked_ids = sorted(scored.items(), key=lambda x: x[1], reverse=True)
        # Build passages
        passages = []
        for cid, score in ranked_ids[:k]:
            if score <= 0.02:
                continue
            d = docs_by_id[cid]
            passages.append({
                "id": d["id"],
                "title": d["title"],
                "source": d["source"],
                "domain": d["domain"],
                "score": round(score, 4),
                "snippet": d["text"][:220],
                # Expose graph bonus for debugging (optional)
                "contextual": d.get("contextual_text", "")[:120],
            })
        # Engine label reflects hybrid nature
        engine_label = EMBEDDING_ENGINE
        if graph is not None and graph_cids:
            engine_label = f"{EMBEDDING_ENGINE}+graph"
        # If contextual embeddings were used, note it
        if any("contextual_text" in d for d in docs):
            engine_label = f"contextual-{engine_label}"
        return {"engine": engine_label, "passages": passages}
    except Exception:  # noqa: BLE001
        return {"engine": EMBEDDING_ENGINE, "passages": []}
