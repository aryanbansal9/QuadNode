"""Edge <-> cloud synchronisation.

Model: every memory has `version` (bumped per edit) and `synced_version` (the last
version both sides agreed on - the common ancestor). That is enough for a
three-way decision without vector clocks:

    local_changed  = local.version  > local.synced_version
    remote_changed = remote.version > local.synced_version

    same content                      -> SAME      (converge bookkeeping only)
    local_changed and remote_changed  -> CONFLICT  (concurrent edits)
    local_changed only                -> PUSH
    remote_changed only               -> PULL
    neither                           -> SAME

Guarantees: LOCAL_ONLY data is never pushed (checked again at the push site);
every operation is idempotent (crash halfway, re-run, same end state); a failure
on one memory never blocks the others."""
from __future__ import annotations

import json
import threading
import time
import uuid
from dataclasses import asdict, dataclass, field
from pathlib import Path

from qdrant_client import models

from . import models as M
from .audit import AuditLog
from .store import MemoryStore, Record, f_match, f_status

SAME, PUSH, PULL, CONFLICT = "same", "push", "pull", "conflict"


class PrivacyViolation(Exception):
    pass


class ConflictError(Exception):
    pass


class Offline(Exception):
    pass


def classify(lp: dict, rp: dict | None) -> str:
    """Pure function - the whole conflict policy in one place (unit tested)."""
    if rp is None:
        return PUSH
    if (rp.get("content_hash") == lp.get("content_hash")
            and bool(rp.get("deleted")) == bool(lp.get("deleted"))):
        return SAME
    base = lp.get("synced_version", 0)
    local_changed = lp["version"] > base
    remote_changed = rp["version"] > base
    if local_changed and remote_changed:
        return CONFLICT
    if local_changed:
        return PUSH
    if remote_changed:
        return PULL
    return SAME


class Connectivity:
    """Real reachability (Qdrant server ping) plus a manual switch for demos."""

    def __init__(self, cloud: MemoryStore, ttl: float = 2.0):
        self.cloud, self.ttl = cloud, ttl
        self._forced_offline = False
        self._last: tuple[float, bool] = (0.0, False)

    @property
    def forced_offline(self) -> bool:
        return self._forced_offline

    def set_forced_offline(self, flag: bool) -> None:
        self._forced_offline = flag
        self._last = (0.0, False)

    def mark_failed(self) -> None:
        self._last = (time.monotonic(), False)

    def probe(self, use_cache: bool = True) -> bool:
        if self._forced_offline:
            return False
        if not self.cloud.remote:                       # embedded simulator is always reachable
            return True
        now = time.monotonic()
        if use_cache and now - self._last[0] < self.ttl:
            return self._last[1]
        ok = self.cloud.ping()
        self._last = (now, ok)
        return ok


@dataclass
class SyncReport:
    online: bool = True
    pushed: int = 0
    pulled: int = 0
    converged: int = 0
    conflicts: int = 0
    auto_resolved: int = 0
    retracted: int = 0
    skipped_local_only: int = 0
    errors: list[str] = field(default_factory=list)
    skipped: str | None = None
    ms: float = 0.0

    def dict(self) -> dict:
        return asdict(self)


class SyncEngine:
    def __init__(self, cfg, edge: MemoryStore, cloud: MemoryStore, conn: Connectivity, audit: AuditLog):
        self.cfg, self.edge, self.cloud, self.conn, self.audit = cfg, edge, cloud, conn, audit
        self._run_lock = threading.Lock()
        self._cloud_ready = False
        self.state = self._load_state()

    # ------------------------------------------------------------- persistence
    def _load_state(self) -> dict:
        p: Path = self.cfg.state_path
        if p.exists():
            try:
                return json.loads(p.read_text())
            except Exception:
                pass
        return {"pull_cursor": 0.0, "last_sync_at": None, "last_report": None}

    def _save_state(self) -> None:
        self.cfg.state_path.parent.mkdir(parents=True, exist_ok=True)
        self.cfg.state_path.write_text(json.dumps(self.state))

    # ------------------------------------------------------------------ driver
    def run_once(self) -> SyncReport:
        rep = SyncReport()
        if not self._run_lock.acquire(blocking=False):
            rep.skipped = "sync already running"
            return rep
        t0 = time.perf_counter()
        try:
            if not self.conn.probe(use_cache=False):
                rep.online, rep.skipped = False, "offline"
                return rep
            self._ensure_cloud()
            self._retract(rep)
            self._push_all(rep)
            self._pull(rep)
            self.state.update(last_sync_at=time.time(), last_report=rep.dict())
            self._save_state()
        except Exception as e:                           # network dropped mid-run etc.
            rep.errors.append(f"{type(e).__name__}: {e}")
            self._cloud_ready = False
            self.conn.mark_failed()
            self.audit.record("sync_error", error=type(e).__name__)
        finally:
            rep.ms = round((time.perf_counter() - t0) * 1000, 1)
            self._run_lock.release()
        if rep.pushed or rep.pulled or rep.conflicts or rep.retracted or rep.errors:
            self.audit.record("sync_run", **{k: v for k, v in rep.dict().items() if k != "skipped"})
        return rep

    def _ensure_cloud(self) -> None:
        if not self._cloud_ready:
            self.cloud.ensure()
            self._cloud_ready = True

    # -------------------------------------------------------------------- push
    def _push_all(self, rep: SyncReport) -> None:
        for id_ in self.edge.ids(f_status(M.PENDING)):
            try:
                self._sync_one(id_, rep)
            except Exception as e:
                rep.errors.append(f"{id_[:8]}: {type(e).__name__}")
                if not self.conn.probe(use_cache=False):
                    raise Offline() from e               # abort the run, keep queue intact

    def _sync_one(self, id_: str, rep: SyncReport) -> None:
        local = self.edge.get(id_, vectors=True)
        if not local or local.payload.get("sync_status") != M.PENDING:
            return
        remote = self.cloud.get(id_)
        action = classify(local.payload, remote.payload if remote else None)
        if action == PUSH:
            self._push(local)
            rep.pushed += 1
        elif action == SAME:
            self._converge(local.id, local.payload, remote.payload)
            rep.converged += 1
        elif action == PULL:
            self._apply_remote(self.cloud.get(id_, vectors=True))
            rep.pulled += 1
        else:
            self._conflict(local, remote, rep)

    def _push(self, local: Record) -> None:
        p = local.payload
        if p.get("sync_status") == M.LOCAL_ONLY or p.get("sensitivity") == "sensitive":
            raise PrivacyViolation(local.id)             # defence in depth: never reachable normally
        cloud_payload = {**p, "sync_status": M.SYNCED, "synced_version": p["version"],
                         "conflict_remote": None, "retract_from_cloud": False}
        self.cloud.upsert(local.id, local.vector, cloud_payload)        # 1) cloud first ...
        self.edge.set_payload(local.id, {"sync_status": M.SYNCED,        # 2) ... then mark local.
                                         "synced_version": p["version"], # Crash between = re-run is a no-op.
                                         "conflict_remote": None})
        self.audit.record("sync_push", id=local.id, version=p["version"], deleted=bool(p.get("deleted")))

    def _converge(self, id_: str, lp: dict, rp: dict) -> None:
        v = max(lp["version"], rp["version"])
        self.edge.set_payload(id_, {"version": v, "synced_version": v, "sync_status": M.SYNCED,
                                    "conflict_remote": None})
        if rp["version"] < v:
            self.cloud.set_payload(id_, {"version": v, "synced_version": v})
        self.audit.record("sync_converged", id=id_, version=v)

    def _retract(self, rep: SyncReport) -> None:
        """A synced memory was edited to contain a secret: pull it back out of the cloud."""
        flt = models.Filter(must=[f_match("retract_from_cloud", True)])
        for id_ in self.edge.ids(flt):
            self.cloud.delete([id_])
            self.edge.set_payload(id_, {"retract_from_cloud": False, "synced_version": 0})
            self.audit.record("sync_retracted", id=id_)
            rep.retracted += 1

    # -------------------------------------------------------------------- pull
    def _pull(self, rep: SyncReport) -> None:
        cursor = self.state.get("pull_cursor", 0.0)
        flt = models.Filter(must=[models.FieldCondition(key="updated_at", range=models.Range(gte=cursor))])
        batch = sorted(self.cloud.all(flt), key=lambda r: r.payload.get("updated_at", 0))[: self.cfg.pull_batch]
        newest = cursor
        for r in batch:
            try:
                self._pull_one(r, rep)
            except Exception as e:
                rep.errors.append(f"pull {r.id[:8]}: {type(e).__name__}")
                if not self.conn.probe(use_cache=False):
                    raise Offline() from e
                break                                    # don't advance the cursor past a failure
            newest = max(newest, r.payload.get("updated_at", 0))
        self.state["pull_cursor"] = newest              # gte + idempotent apply => safe to re-see items

    def _pull_one(self, remote_meta: Record, rep: SyncReport) -> None:
        rp = remote_meta.payload
        local = self.edge.get(remote_meta.id)
        if local is None:
            if rp.get("deleted"):
                return
            self._apply_remote(self.cloud.get(remote_meta.id, vectors=True))
            rep.pulled += 1
            return
        lp = local.payload
        if lp["sync_status"] in (M.LOCAL_ONLY, M.CONFLICT):
            rep.skipped_local_only += lp["sync_status"] == M.LOCAL_ONLY
            return
        action = classify(lp, rp)
        if action == PULL:
            self._apply_remote(self.cloud.get(remote_meta.id, vectors=True))
            rep.pulled += 1
        elif action == SAME and (lp["sync_status"] != M.SYNCED or lp["version"] != rp["version"]):
            self._converge(local.id, lp, rp)
            rep.converged += 1
        elif action == CONFLICT:
            self._conflict(self.edge.get(local.id, vectors=True), remote_meta, rep)
        # PUSH: local is ahead; the push phase owns it.

    def _apply_remote(self, remote: Record) -> None:
        """Make the edge copy identical to the cloud copy."""
        rp = remote.payload
        payload = {**rp, "sync_status": M.SYNCED, "synced_version": rp["version"],
                   "conflict_remote": None, "retract_from_cloud": False}
        self.edge.upsert(remote.id, remote.vector, payload)
        self.audit.record("sync_pull", id=remote.id, version=rp["version"], deleted=bool(rp.get("deleted")),
                          origin=rp.get("device_id"))

    # ---------------------------------------------------------------- conflict
    def _conflict(self, local: Record, remote: Record, rep: SyncReport) -> None:
        rp = remote.payload
        self.edge.set_payload(local.id, {
            "sync_status": M.CONFLICT,
            "conflict_remote": {"text": rp.get("text", ""), "version": rp["version"],
                                "updated_at": rp.get("updated_at"), "device_id": rp.get("device_id"),
                                "content_hash": rp.get("content_hash"), "deleted": bool(rp.get("deleted"))}})
        rep.conflicts += 1
        self.audit.record("sync_conflict", id=local.id, local_version=local.payload["version"],
                          remote_version=rp["version"], remote_device=rp.get("device_id"))
        if self.cfg.conflict_policy == "lww":
            newer_local = local.payload.get("updated_at", 0) >= rp.get("updated_at", 0)
            self.resolve(local.id, "keep_local" if newer_local else "keep_remote", auto=True)
            rep.conflicts -= 1
            rep.auto_resolved += 1

    def resolve(self, id_: str, strategy: str, auto: bool = False) -> dict:
        if strategy not in ("keep_local", "keep_remote", "keep_both"):
            raise ConflictError("strategy must be keep_local | keep_remote | keep_both")
        if not self.conn.probe(use_cache=False):
            raise Offline("Resolving needs the cloud copy; reconnect first.")
        self._ensure_cloud()
        local = self.edge.get(id_, vectors=True)
        if not local or local.payload.get("sync_status") != M.CONFLICT:
            raise ConflictError("Memory is not in conflict.")
        remote = self.cloud.get(id_, vectors=True)
        lp, rp = local.payload, remote.payload
        extra = None

        if strategy == "keep_remote":
            self._apply_remote(remote)
        else:
            if strategy == "keep_both" and not lp.get("deleted"):
                extra = str(uuid.uuid4())                # local text survives as its own memory
                self.edge.upsert(extra, local.vector, {
                    **lp, "version": 1, "synced_version": 0, "sync_status": M.PENDING,
                    "conflict_remote": None, "created_at": time.time(), "updated_at": time.time()})
                self.audit.record("memory_forked", id=extra, from_id=id_)
            if strategy == "keep_both":
                self._apply_remote(remote)
            else:                                        # keep_local: win by leapfrogging the remote version
                new_v = max(lp["version"], rp["version"]) + 1
                self.edge.set_payload(id_, {"version": new_v, "synced_version": rp["version"],
                                            "updated_at": time.time(), "sync_status": M.PENDING,
                                            "conflict_remote": None})
                self._push(self.edge.get(id_, vectors=True))
        self.audit.record("conflict_resolved", id=id_, strategy=strategy, auto=auto)
        return {"id": id_, "strategy": strategy, "forked_id": extra}
