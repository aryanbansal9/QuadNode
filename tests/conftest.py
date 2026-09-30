import hashlib
import re
import sys
from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest
from qdrant_client import QdrantClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from backend.config import Config                      # noqa: E402
from backend.container import build                    # noqa: E402
from backend.embeddings import SparseVec               # noqa: E402
from backend.privacy import PrivacyGuard               # noqa: E402

DIM = 32
_tok = lambda s: re.findall(r"[a-z0-9]+", s.lower())   # noqa: E731
_h = lambda w: int(hashlib.md5(w.encode()).hexdigest(), 16)  # noqa: E731


class FakeEmbedder:
    """Deterministic bag-of-words embeddings: similar words => similar vectors."""
    dim = DIM

    def _d(self, t):
        v = np.zeros(DIM, dtype=np.float32)
        for w in _tok(t):
            v[_h(w) % DIM] += 1
        return (v / (np.linalg.norm(v) or 1)).tolist()

    def _s(self, t):
        c = {}
        for w in _tok(t):
            c[_h(w) % 100000] = c.get(_h(w) % 100000, 0) + 1.0
        return SparseVec(list(c), list(c.values()))

    def embed_documents(self, ts): return [self._d(t) for t in ts]
    def embed_query(self, t): return self._d(t)
    def sparse_documents(self, ts): return [self._s(t) for t in ts]
    def sparse_query(self, t): return self._s(t)


class FakeReranker:
    def score(self, query, passages):
        q = set(_tok(query))
        return {p["id"]: len(q & set(_tok(p["text"]))) / (len(q) or 1) for p in passages}


def make_cfg(tmp_path, device="EDGE-A", **kw):
    return replace(Config(), device_id=device, data_dir=tmp_path, models_dir=tmp_path / "m",
                   embed_dim=DIM, use_gliner=False, **kw)


def make_device(tmp_path, cloud_client, device="EDGE-A", **kw):
    cfg = make_cfg(tmp_path, device, **kw)
    return build(cfg, embedder=FakeEmbedder(), reranker=FakeReranker(), privacy=PrivacyGuard(None),
                 llm=object(), edge_client=QdrantClient(":memory:"), cloud_client=cloud_client)


@pytest.fixture
def cloud():
    return QdrantClient(":memory:")


@pytest.fixture
def dev(tmp_path, cloud):
    return make_device(tmp_path, cloud)
