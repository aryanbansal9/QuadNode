"""Thread-safe wrapper over one Qdrant collection.

Used for BOTH sides: the edge store and the cloud store. The sync engine and
services only talk to this class, so the storage engine is swappable:
  * today   : qdrant-client (embedded local mode for edge, HTTP for the server)
  * next    : a Qdrant Edge `EdgeShard` adapter implementing the same ~12 methods
              (see README, "Swapping in Qdrant Edge")."""
from __future__ import annotations

import threading
from dataclasses import dataclass

from qdrant_client import QdrantClient, models

from .embeddings import SparseVec


@dataclass
class Record:
    id: str
    payload: dict
    vector: dict | None = None


def f_match(key: str, value) -> models.FieldCondition:
    return models.FieldCondition(key=key, match=models.MatchValue(value=value))


def f_alive(*extra: models.FieldCondition) -> models.Filter:
    return models.Filter(must=[f_match("deleted", False), *extra])


def f_status(status: str) -> models.Filter:
    return models.Filter(must=[f_match("sync_status", status)])


def _sparse(v) -> models.SparseVector:
    if isinstance(v, models.SparseVector):
        return v
    return models.SparseVector(indices=list(v.indices), values=list(v.values))


class MemoryStore:
    def __init__(self, client: QdrantClient, collection: str, dim: int, name: str = "edge",
                 remote: bool = False):
        self.client, self.collection, self.dim, self.name, self.remote = client, collection, dim, name, remote
        self._lock = threading.RLock()

    # ---- lifecycle ------------------------------------------------------
    def ensure(self) -> None:
        with self._lock:
            if not self.client.collection_exists(self.collection):
                self.client.create_collection(
                    self.collection,
                    vectors_config={"dense": models.VectorParams(size=self.dim, distance=models.Distance.COSINE)},
                    sparse_vectors_config={"sparse": models.SparseVectorParams(modifier=models.Modifier.IDF)},
                )
            if self.remote:                       # payload indexes are a no-op in embedded mode
                for key, schema in (("sync_status", "keyword"), ("source", "keyword"),
                                    ("sensitivity", "keyword"), ("deleted", "bool"),
                                    ("updated_at", "float")):
                    try:
                        self.client.create_payload_index(self.collection, key, field_schema=schema)
                    except Exception:
                        pass

    def ping(self) -> bool:
        try:
            self.client.get_collections()
            return True
        except Exception:
            return False

    # ---- writes ---------------------------------------------------------
    def upsert(self, id_: str, vector: dict, payload: dict) -> None:
        vec = {"dense": list(vector["dense"]), "sparse": _sparse(vector["sparse"])}
        with self._lock:
            self.client.upsert(self.collection, points=[models.PointStruct(id=id_, vector=vec, payload=payload)])

    def set_payload(self, id_: str, patch: dict) -> None:
        with self._lock:
            self.client.set_payload(self.collection, payload=patch, points=[id_])

    def delete(self, ids: list[str]) -> None:
        if ids:
            with self._lock:
                self.client.delete(self.collection, points_selector=models.PointIdsList(points=ids))

    # ---- reads ----------------------------------------------------------
    def get_many(self, ids: list[str], vectors: bool = False) -> dict[str, Record]:
        if not ids:
            return {}
        with self._lock:
            pts = self.client.retrieve(self.collection, ids=ids, with_payload=True, with_vectors=vectors)
        return {str(p.id): Record(str(p.id), p.payload or {}, p.vector if vectors else None) for p in pts}

    def get(self, id_: str, vectors: bool = False) -> Record | None:
        return self.get_many([id_], vectors).get(id_)

    def scroll(self, flt: models.Filter | None = None, limit: int = 50, offset=None,
               vectors: bool = False) -> tuple[list[Record], object]:
        with self._lock:
            pts, nxt = self.client.scroll(self.collection, scroll_filter=flt, limit=limit, offset=offset,
                                          with_payload=True, with_vectors=vectors)
        return [Record(str(p.id), p.payload or {}, p.vector if vectors else None) for p in pts], nxt

    def all(self, flt: models.Filter | None = None) -> list[Record]:
        """Every matching record (payload only). Collected first so callers can
        mutate payloads while iterating without disturbing pagination."""
        out, off = [], None
        while True:
            recs, off = self.scroll(flt, limit=256, offset=off)
            out.extend(recs)
            if off is None:
                return out

    def ids(self, flt: models.Filter | None = None) -> list[str]:
        return [r.id for r in self.all(flt)]

    def count(self, flt: models.Filter | None = None) -> int:
        with self._lock:
            return self.client.count(self.collection, count_filter=flt, exact=True).count

    def query_hybrid(self, dense: list[float], sparse: SparseVec, flt: models.Filter,
                     prefetch_limit: int, limit: int):
        """Server-side hybrid: dense + sparse branches fused with Reciprocal Rank Fusion."""
        with self._lock:
            return self.client.query_points(
                self.collection,
                prefetch=[
                    models.Prefetch(query=dense, using="dense", limit=prefetch_limit, filter=flt),
                    models.Prefetch(query=_sparse(sparse), using="sparse", limit=prefetch_limit, filter=flt),
                ],
                query=models.FusionQuery(fusion=models.Fusion.RRF),
                limit=limit, with_payload=True,
            ).points

    def query_branch(self, name: str, query, flt: models.Filter, limit: int):
        """Single branch ('dense' or 'sparse'); used to explain *why* a hit was found."""
        q = _sparse(query) if name == "sparse" else query
        with self._lock:
            return self.client.query_points(self.collection, query=q, using=name, query_filter=flt,
                                            limit=limit, with_payload=False).points
