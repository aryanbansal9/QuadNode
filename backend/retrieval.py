"""Federated Hybrid Retrieval: Edge + Cloud -> Deduplication -> Cross-encoder rerank."""
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
    origin: str = "edge"  # Tracks whether it came from local edge or cloud
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
    # UPDATED: Now accepts both edge and cloud stores, plus connectivity state
    def __init__(self, cfg, edge: MemoryStore, cloud: MemoryStore, conn, embedder, reranker):
        self.cfg = cfg
        self.edge = edge
        self.cloud = cloud
        self.conn = conn
        self.embedder = embedder
        self.reranker = reranker

    def search(self, query: str, top_k: int = 5, explain: bool = True) -> SearchResult:
        t = {}
        t0 = time.perf_counter()
        qd, qs = self.embedder.embed_query(query), self.embedder.sparse_query(query)
        t["embed"] = (time.perf_counter() - t0) * 1000

        flt, n = f_alive(), self.cfg.candidates
        
        # 1. Search Local Edge Storage
        t0 = time.perf_counter()
        edge_pts = self.edge.query_hybrid(qd, qs, flt, prefetch_limit=n, limit=n)
        t["qdrant_edge"] = (time.perf_counter() - t0) * 1000

        # 2. Search Cloud Storage (Only if Online)
        cloud_pts = []
        if self.conn.probe():
            try:
                t0 = time.perf_counter()
                cloud_pts = self.cloud.query_hybrid(qd, qs, flt, prefetch_limit=n, limit=n)
                t["qdrant_cloud"] = (time.perf_counter() - t0) * 1000
            except Exception as e:
                log.warning(f"Cloud search failed, falling back to edge only: {e}")

        # 3. Combine & Deduplicate (Local Edge takes precedence for pending edits)
        seen_ids = set()
        hits = []

        # Add edge hits first
        for p in edge_pts:
            seen_ids.add(str(p.id))
            hits.append(Hit(
                id=str(p.id), text=p.payload.get("text", ""), source=p.payload.get("source", "?"),
                page=p.payload.get("page"), sync_status=p.payload.get("sync_status", "?"),
                sensitivity=p.payload.get("sensitivity", "normal"), version=p.payload.get("version", 1),
                fused_rank=0, origin="edge"
            ))

        # Add cloud hits if they don't already exist locally
        for p in cloud_pts:
            if str(p.id) not in seen_ids:
                seen_ids.add(str(p.id))
                hits.append(Hit(
                    id=str(p.id), text=p.payload.get("text", ""), source=p.payload.get("source", "?"),
                    page=p.payload.get("page"), sync_status=p.payload.get("sync_status", "?"),
                    sensitivity=p.payload.get("sensitivity", "normal"), version=p.payload.get("version", 1),
                    fused_rank=0, origin="cloud"
                ))

        # 4. Cross-encoder Reranking (Finds the absolute best answers from the combined pool)
        t0 = time.perf_counter()
        if hits:
            try:
                scores = self.reranker.score(query, [{"id": h.id, "text": h.text} for h in hits])
                for h in hits:
                    h.rerank_score = scores.get(h.id)
                    h.confident = (h.rerank_score or 0.0) >= self.cfg.rerank_min_score
                # Sort by highest rerank score
                hits.sort(key=lambda h: (h.rerank_score is None, -(h.rerank_score or 0.0)))
            except Exception:
                log.exception("Rerank failed; falling back to combined hybrid order")
        
        # Assign final ranking positions
        for i, h in enumerate(hits):
            h.fused_rank = i + 1

        t["rerank"] = (time.perf_counter() - t0) * 1000
        t["total"] = sum(t.values())
        return SearchResult(query, hits[:top_k], {k: round(v, 2) for k, v in t.items()})