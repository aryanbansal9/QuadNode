"""Dense (Nomic, Matryoshka-truncated) + sparse (BM25) embedders.

Two details that quietly matter:
* Nomic v1.5 is trained with task prefixes. Documents need "search_document: ",
  queries need "search_query: ". Skipping them measurably lowers recall.
* Truncating a Matryoshka vector to 256-d must be followed by re-normalisation."""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

DOC_PREFIX = "search_document: "
QUERY_PREFIX = "search_query: "


@dataclass(frozen=True)
class SparseVec:
    indices: list[int]
    values: list[float]


def _trunc_norm(v, dim: int) -> list[float]:
    a = np.asarray(v, dtype=np.float32)[:dim]
    n = float(np.linalg.norm(a)) or 1.0
    return (a / n).tolist()


class FastEmbedder:
    def __init__(self, cfg):
        from fastembed import SparseTextEmbedding, TextEmbedding
        cache = str(cfg.models_dir)
        self.dim = cfg.embed_dim
        self._dense = TextEmbedding(cfg.dense_model, cache_dir=cache)
        self._sparse = SparseTextEmbedding(cfg.sparse_model, cache_dir=cache)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [_trunc_norm(v, self.dim) for v in self._dense.embed([DOC_PREFIX + t for t in texts])]

    def embed_query(self, text: str) -> list[float]:
        return _trunc_norm(next(iter(self._dense.embed([QUERY_PREFIX + text]))), self.dim)

    def sparse_documents(self, texts: list[str]) -> list[SparseVec]:
        return [SparseVec(e.indices.tolist(), e.values.tolist()) for e in self._sparse.embed(texts)]

    def sparse_query(self, text: str) -> SparseVec:
        e = next(iter(self._sparse.query_embed(text)))
        return SparseVec(e.indices.tolist(), e.values.tolist())


class FlashReranker:
    """Cross-encoder scoring of (query, passage) pairs."""

    def __init__(self, cfg):
        from flashrank import Ranker
        self._ranker = Ranker(model_name=cfg.rerank_model, cache_dir=str(cfg.models_dir))

    def score(self, query: str, passages: list[dict]) -> dict[str, float]:
        from flashrank import RerankRequest
        out = self._ranker.rerank(RerankRequest(query=query, passages=passages))
        return {str(p["id"]): float(p["score"]) for p in out}
