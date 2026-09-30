"""Memory record schema + pure helpers (no I/O, easy to unit test)."""
from __future__ import annotations

import hashlib
import re
import time
import uuid

# ---- sync states ------------------------------------------------------------
LOCAL_ONLY = "LOCAL_ONLY"   # sensitive: must never leave the device
PENDING = "PENDING"         # eligible, waiting to be pushed
SYNCED = "SYNCED"           # edge and cloud agree
CONFLICT = "CONFLICT"       # both sides changed since the last common version
STATUSES = (LOCAL_ONLY, PENDING, SYNCED, CONFLICT)

NAMESPACE = uuid.UUID("6f1d3a52-9c1e-4c55-8f5a-2b7f0a1c9d10")


def normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def content_hash(text: str) -> str:
    return hashlib.sha256(normalize(text).encode("utf-8")).hexdigest()


def memory_id_for(text: str) -> str:
    """Deterministic id: identical text => identical id => free dedupe, and two
    devices that ingest the same fact converge on one point instead of two."""
    return str(uuid.uuid5(NAMESPACE, content_hash(text)))


def new_payload(*, text: str, source: str, page: int | None, chunk_index: int,
                device_id: str, sensitive: bool, labels: list[str],
                version: int = 1, synced_version: int = 0,
                created_at: float | None = None) -> dict:
    now = time.time()
    return {
        "text": text,
        "source": source,
        "page": page,
        "chunk_index": chunk_index,
        "content_hash": content_hash(text),
        # -- versioning / sync bookkeeping
        "version": version,                 # bumped on every edit/delete
        "synced_version": synced_version,   # last version both sides agreed on (the "base")
        "sync_status": LOCAL_ONLY if sensitive else PENDING,
        "conflict_remote": None,            # snapshot of the other side while CONFLICT
        "retract_from_cloud": False,
        "deleted": False,                   # tombstone flag (deletes must sync too)
        # -- provenance / privacy (labels only, never the secret values)
        "device_id": device_id,
        "created_at": created_at or now,
        "updated_at": now,
        "sensitivity": "sensitive" if sensitive else "normal",
        "pii_labels": labels,
    }
