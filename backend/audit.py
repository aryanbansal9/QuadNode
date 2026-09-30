"""Tamper-evident audit log + live event fan-out.

Each entry's HMAC covers the previous entry's hash, so editing, deleting or
reordering any line breaks every later hash. `verify()` proves it. Entries hold
ids, counts and label names only - never memory text or secret values."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import os
import threading
import time
from collections import deque
from pathlib import Path

GENESIS = "0" * 64


def _canon(obj) -> str:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), default=str)


class AuditLog:
    def __init__(self, path: Path, key: bytes | None = None, keep: int = 500):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._key = key or self._load_key(self.path.parent / ".audit_key")
        self._lock = threading.Lock()
        self._recent: deque[dict] = deque(maxlen=keep)
        self._subs: list[tuple[asyncio.AbstractEventLoop, asyncio.Queue]] = []
        self._seq, self._prev = 0, GENESIS
        self._load_tail()

    @staticmethod
    def _load_key(p: Path) -> bytes:
        if p.exists():
            return p.read_bytes()
        k = os.urandom(32)
        p.write_bytes(k)
        return k

    def _mac(self, prev: str, body: dict) -> str:
        return hmac.new(self._key, (prev + _canon(body)).encode(), hashlib.sha256).hexdigest()

    def _load_tail(self) -> None:
        if not self.path.exists():
            return
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                e = json.loads(line)
                self._recent.append(e)
                self._seq, self._prev = e["seq"], e["hash"]

    def record(self, type_: str, **data) -> dict:
        with self._lock:
            self._seq += 1
            body = {"seq": self._seq, "ts": round(time.time(), 3), "type": type_, "data": data}
            entry = {**body, "prev": self._prev, "hash": self._mac(self._prev, body)}
            with self.path.open("a", encoding="utf-8") as f:
                f.write(_canon(entry) + "\n")
            self._prev = entry["hash"]
            self._recent.append(entry)
            subs = list(self._subs)
        for loop, q in subs:                      # push to SSE listeners (thread-safe)
            try:
                loop.call_soon_threadsafe(self._offer, q, entry)
            except RuntimeError:
                pass
        return entry

    @staticmethod
    def _offer(q: asyncio.Queue, entry: dict) -> None:
        try:
            q.put_nowait(entry)
        except asyncio.QueueFull:
            pass

    def recent(self, limit: int = 100, types: set[str] | None = None) -> list[dict]:
        items = [e for e in self._recent if not types or e["type"] in types]
        return items[-limit:][::-1]

    def verify(self) -> dict:
        prev, n = GENESIS, 0
        if not self.path.exists():
            return {"valid": True, "entries": 0}
        with self.path.open("r", encoding="utf-8") as f:
            for line in f:
                if not line.strip():
                    continue
                e = json.loads(line)
                body = {k: e[k] for k in ("seq", "ts", "type", "data")}
                if e["prev"] != prev or e["hash"] != self._mac(prev, body) or e["seq"] != n + 1:
                    return {"valid": False, "entries": n, "first_bad_seq": e.get("seq")}
                prev, n = e["hash"], n + 1
        return {"valid": True, "entries": n, "head": prev}

    # -- SSE support ----------------------------------------------------------
    def subscribe(self, loop: asyncio.AbstractEventLoop) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=200)
        with self._lock:
            self._subs.append((loop, q))
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        with self._lock:
            self._subs = [(l, x) for (l, x) in self._subs if x is not q]
