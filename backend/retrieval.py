"""Hybrid retrieval: (dense || sparse) -> RRF fusion in Qdrant -> cross-encoder rerank.
Returns explainable hits (per-branch rank, fused rank, rerank score) plus stage timings."""
from __future__ import annotations

import logging
import time
from dataclasses import asdict, dataclass, field

from .store import MemoryStore, f_alive

log = logging.getLogger(__name__)


@dataclass
class Hit:
    id: str
    text: str
    source: str
    page: int | None
    sync_status: str
    sensitivity: str
    version: int
    fused_rank: int
    dense_rank: int | None = None
    sparse_rank: int | None = None
    rerank_score: float | None = None
    confident: bool = False

    def public(self, with_text: bool = True) -> dict:
        d = asdict(self)
        if not with_text:
            d.pop("text")
        return d


@dataclass
class SearchResult:
    query: str
    hits: list[Hit] = field(default_factory=list)
    timings_ms: dict = field(default_factory=dict)


class Retriever:
    def __init__(self, cfg, store: MemoryStore, embedder, reranker):
        self.cfg, self.store, self.embedder, self.reranker = cfg, store, embedder, reranker

    def search(self, query: str, top_k: int = 5, explain: bool = True) -> SearchResult:
        t = {}
        t0 = time.perf_counter()
        qd, qs = self.embedder.embed_query(query), self.embedder.sparse_query(query)
        t["embed"] = (time.perf_counter() - t0) * 1000

        flt, n = f_alive(), self.cfg.candidates
        t0 = time.perf_counter()
        fused = self.store.query_hybrid(qd, qs, flt, prefetch_limit=n, limit=n)
        t["qdrant_hybrid"] = (time.perf_counter() - t0) * 1000

        ranks: dict[str, dict[str, int]] = {"dense": {}, "sparse": {}}
        if explain and fused:
            for name, q in (("dense", qd), ("sparse", qs)):
                pts = self.store.query_branch(name, q, flt, n)
                ranks[name] = {str(p.id): i + 1 for i, p in enumerate(pts)}

        hits = [Hit(id=str(p.id), text=p.payload.get("text", ""), source=p.payload.get("source", "?"),
                    page=p.payload.get("page"), sync_status=p.payload.get("sync_status", "?"),
                    sensitivity=p.payload.get("sensitivity", "normal"), version=p.payload.get("version", 1),
                    fused_rank=i + 1, dense_rank=ranks["dense"].get(str(p.id)),
                    sparse_rank=ranks["sparse"].get(str(p.id))) for i, p in enumerate(fused)]

        t0 = time.perf_counter()
        if hits:
            try:
                scores = self.reranker.score(query, [{"id": h.id, "text": h.text} for h in hits])
                for h in hits:
                    h.rerank_score = scores.get(h.id)
                    h.confident = (h.rerank_score or 0.0) >= self.cfg.rerank_min_score
                hits.sort(key=lambda h: (h.rerank_score is None, -(h.rerank_score or 0.0), h.fused_rank))
            except Exception:
                # Degrade gracefully: keep RRF order, but do NOT claim confidence.
                log.exception("rerank failed; falling back to fused order")
        t["rerank"] = (time.perf_counter() - t0) * 1000
        t["total"] = sum(t.values())
        return SearchResult(query, hits[:top_k], {k: round(v, 2) for k, v in t.items()})
