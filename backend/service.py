"""Memory lifecycle on the edge: ingest -> chunk -> privacy gate -> embed -> store.
Also update and delete. Every mutation bumps `version` so sync can reason about it."""
from __future__ import annotations

import time
import uuid

from . import models as M
from .audit import AuditLog
from .chunking import chunk_segments
from .store import MemoryStore, f_alive, f_match


class NotFound(Exception):
    pass


class Invalid(Exception):
    pass


class MemoryService:
    def __init__(self, cfg, edge: MemoryStore, embedder, privacy, audit: AuditLog):
        self.cfg, self.edge, self.embedder, self.privacy, self.audit = cfg, edge, embedder, privacy, audit

    # ------------------------------------------------------------------ ingest
    def ingest_segments(self, source: str, segments: list[tuple[int | None, str]],
                        replace_source: bool = True) -> dict:
        t0 = time.perf_counter()
        chunks = chunk_segments(segments, self.cfg.chunk_words, self.cfg.chunk_overlap_words)
        if not chunks:
            raise Invalid("No extractable text (scanned PDF? OCR is not enabled).")

        planned: dict[str, object] = {}                  # id -> chunk (dedupes inside the batch too)
        for ch in chunks:
            planned.setdefault(M.memory_id_for(ch.text), ch)
        existing = self.edge.get_many(list(planned))

        todo = [(pid, ch) for pid, ch in planned.items()
                if pid not in existing or existing[pid].payload.get("deleted")]
        skipped = len(planned) - len(todo)

        # Privacy gate + embeddings only for what is actually new.
        texts = [ch.text for _, ch in todo]
        verdicts = self.privacy.scan_many(texts) if texts else []
        dense = self.embedder.embed_documents(texts) if texts else []
        sparse = self.embedder.sparse_documents(texts) if texts else []

        local_only = 0
        for (pid, ch), verdict, dv, sv in zip(todo, verdicts, dense, sparse):
            old = existing.get(pid)                       # tombstone being revived, if any
            payload = M.new_payload(
                text=ch.text, source=source, page=ch.page, chunk_index=ch.index,
                device_id=self.cfg.device_id, sensitive=verdict.sensitive, labels=verdict.labels,
                version=(old.payload["version"] + 1) if old else 1,
                synced_version=old.payload.get("synced_version", 0) if old else 0,
                created_at=old.payload.get("created_at") if old else None)
            self.edge.upsert(pid, {"dense": dv, "sparse": sv}, payload)
            local_only += verdict.sensitive
            self.audit.record("memory_ingested", id=pid, source=source, page=ch.page,
                              status=payload["sync_status"], labels=verdict.labels)

        removed = 0
        if replace_source:                                # re-uploading a changed file supersedes old chunks
            stale = [r for r in self.edge.all(f_alive(f_match("source", source))) if r.id not in planned]
            for r in stale:
                self._tombstone(r)
                removed += 1

        return {"source": source, "chunks": len(chunks), "new": len(todo), "duplicates": skipped,
                "local_only": local_only, "superseded": removed,
                "ms": round((time.perf_counter() - t0) * 1000, 1)}

    def ingest_text(self, text: str, source: str | None = None) -> dict:
        source = source or f"note-{M.content_hash(text)[:8]}"
        return self.ingest_segments(source, [(None, text)], replace_source=False)

    # ------------------------------------------------------------ update/delete
    def update_memory(self, id_: str, text: str) -> dict:
        rec = self.edge.get(id_)
        if not rec or rec.payload.get("deleted"):
            raise NotFound(id_)
        p = rec.payload
        if p["sync_status"] == M.CONFLICT:
            raise Invalid("Resolve the conflict before editing this memory.")
        text = M.normalize(text)
        if not text:
            raise Invalid("Empty text.")
        if M.content_hash(text) == p["content_hash"]:
            return {"id": id_, "changed": False, "version": p["version"]}

        verdict = self.privacy.scan(text)
        dv = self.embedder.embed_documents([text])[0]
        sv = self.embedder.sparse_documents([text])[0]
        newly_sensitive_but_in_cloud = verdict.sensitive and p.get("synced_version", 0) > 0
        payload = {**p, "text": text, "content_hash": M.content_hash(text), "version": p["version"] + 1,
                   "updated_at": time.time(), "device_id": self.cfg.device_id,
                   "sensitivity": "sensitive" if verdict.sensitive else "normal",
                   "pii_labels": verdict.labels,
                   "sync_status": M.LOCAL_ONLY if verdict.sensitive else M.PENDING,
                   "retract_from_cloud": bool(newly_sensitive_but_in_cloud)}
        self.edge.upsert(id_, {"dense": dv, "sparse": sv}, payload)
        self.audit.record("memory_updated", id=id_, version=payload["version"],
                          status=payload["sync_status"], retract=newly_sensitive_but_in_cloud)
        return {"id": id_, "changed": True, "version": payload["version"], "sync_status": payload["sync_status"]}

    def delete_memory(self, id_: str) -> dict:
        rec = self.edge.get(id_)
        if not rec or rec.payload.get("deleted"):
            raise NotFound(id_)
        return {"id": id_, "mode": self._tombstone(rec)}

    def _tombstone(self, rec) -> str:
        p = rec.payload
        if p.get("synced_version", 0) == 0:               # cloud never saw it: just erase locally
            self.edge.delete([rec.id])
            self.audit.record("memory_deleted", id=rec.id, mode="hard")
            return "hard"
        # Cloud has a copy: leave a tombstone so the deletion propagates to other devices.
        self.edge.set_payload(rec.id, {"deleted": True, "text": "", "content_hash": "",
                                       "version": p["version"] + 1, "updated_at": time.time(),
                                       "device_id": self.cfg.device_id, "sync_status": M.PENDING,
                                       "conflict_remote": None})
        self.audit.record("memory_deleted", id=rec.id, mode="tombstone")
        return "tombstone"

    # ------------------------------------------------------------------- reads
    def list_memories(self, status: str | None = None, source: str | None = None,
                      include_deleted: bool = False, limit: int = 50, offset=None):
        must = []
        if not include_deleted:
            must.append(f_match("deleted", False))
        if status:
            must.append(f_match("sync_status", status))
        if source:
            must.append(f_match("source", source))
        from qdrant_client import models
        return self.edge.scroll(models.Filter(must=must) if must else None, limit=limit, offset=offset)

    def counts(self) -> dict:
        from qdrant_client import models
        out = {s: self.edge.count(models.Filter(must=[f_match("sync_status", s), f_match("deleted", False)]))
               for s in M.STATUSES}
        out["total"] = self.edge.count(f_alive())
        out["tombstones"] = self.edge.count(models.Filter(must=[f_match("deleted", True)]))
        return out
