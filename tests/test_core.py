import json

from backend import models as M
from backend.audit import AuditLog
from backend.chunking import chunk_text
from backend.privacy import scan_regex
from backend.sync import CONFLICT, PULL, PUSH, SAME, classify
from .conftest import make_device


def ids_in_cloud(d):
    return {r.id for r in d.cloud.all()}


# ------------------------------------------------------------------ chunking
def test_chunking_bounds_and_overlap():
    t = " ".join(f"Sentence number {i} talks about topic {i % 7} in detail." for i in range(120))
    cs = chunk_text(t, 60, 15)
    assert len(cs) > 5 and all(len(c.text.split()) <= 60 for c in cs)
    assert set(cs[0].text.split()[-5:]) & set(cs[1].text.split()[:20])       # overlap exists


def test_secret_deep_in_document_flags_only_its_chunks(dev):
    body = " ".join(f"Robot fact number {i} about wheels and sensors." for i in range(200))
    text = body[:3000] + " The admin password is Tr0ub4dor&3xyz. " + body[3000:]
    r = dev.memory.ingest_segments("manual.txt", [(1, text)])
    assert 0 < r["local_only"] < r["new"]                                # not the whole doc
    counts = dev.memory.counts()
    assert counts["LOCAL_ONLY"] == r["local_only"] and counts["PENDING"] == r["new"] - r["local_only"]


def test_privacy_patterns():
    assert scan_regex("AKIAIOSFODNN7EXAMPLE")
    assert scan_regex("card 4111 1111 1111 1111")
    assert not scan_regex("order number 1234567890123 shipped")
    assert not scan_regex("robots navigate warehouses")


# ------------------------------------------------------------------- ingest
def test_dedupe_and_replace_source(dev):
    a = dev.memory.ingest_segments("f.txt", [(None, "Alpha beta gamma delta. " * 5)])
    b = dev.memory.ingest_segments("f.txt", [(None, "Alpha beta gamma delta. " * 5)])
    assert a["new"] == 1 and b["new"] == 0 and b["duplicates"] == 1
    c = dev.memory.ingest_segments("f.txt", [(None, "Totally different content now.")])
    assert c["superseded"] == 1 and dev.memory.counts()["total"] == 1


# ---------------------------------------------------------------- retrieval
def test_hybrid_search_explains_and_prefers_relevant(dev):
    dev.memory.ingest_text("The warehouse robot charges at dock seven every night.", "a")
    dev.memory.ingest_text("Quarterly revenue grew because of new kiosks.", "b")
    r = dev.retriever.search("where does the robot charge", top_k=2)
    top = r.hits[0]
    assert "dock seven" in top.text and top.confident
    assert top.dense_rank is not None and top.sparse_rank is not None and top.fused_rank >= 1
    assert set(r.timings_ms) >= {"embed", "qdrant_hybrid", "rerank", "total"}


def test_deleted_memories_are_not_searchable(dev):
    dev.memory.ingest_text("Secret launch codes are stored in the vault room.", "a")
    mid = dev.edge.all()[0].id
    dev.memory.delete_memory(mid)
    assert dev.retriever.search("launch codes vault").hits == []


# --------------------------------------------------------------------- sync
def test_classify_table():
    base = dict(content_hash="a", version=1, synced_version=1, deleted=False)
    assert classify(base, None) == PUSH
    assert classify({**base, "content_hash": "b", "version": 2}, {**base}) == PUSH
    assert classify(base, {**base, "content_hash": "b", "version": 2}) == PULL
    assert classify({**base, "content_hash": "b", "version": 2}, {**base, "content_hash": "c", "version": 2}) == CONFLICT
    assert classify({**base, "content_hash": "b", "version": 2}, {**base, "content_hash": "b", "version": 2}) == SAME


def test_push_and_local_only_never_leaves_device(dev):
    dev.memory.ingest_text("Meeting notes about the gripper redesign.", "n1")
    dev.memory.ingest_text("My password is Hunter2Hunter2.", "n2")
    rep = dev.sync.run_once()
    assert rep.pushed == 1 and not rep.errors
    cloud_texts = [r.payload["text"] for r in dev.cloud.all()]
    assert cloud_texts == ["Meeting notes about the gripper redesign."]
    assert dev.memory.counts()["LOCAL_ONLY"] == 1 and dev.memory.counts()["SYNCED"] == 1
    assert dev.sync.run_once().pushed == 0                                # idempotent


def test_offline_queues_then_syncs_on_reconnect(dev):
    dev.conn.set_forced_offline(True)
    dev.memory.ingest_text("Offline note one about battery health.", "o1")
    rep = dev.sync.run_once()
    assert rep.online is False and dev.cloud.count() == 0
    assert dev.memory.counts()["PENDING"] == 1                            # retained, not lost
    dev.conn.set_forced_offline(False)
    assert dev.sync.run_once().pushed == 1 and dev.cloud.count() == 1


def test_pull_from_other_device(tmp_path, cloud):
    a, b = make_device(tmp_path, cloud, "A"), make_device(tmp_path, cloud, "B")
    a.memory.ingest_text("The kiosk firmware version is 4.2.", "k")
    a.sync.run_once()
    rb = b.sync.run_once()
    assert rb.pulled == 1
    assert b.retriever.search("kiosk firmware version").hits[0].text.startswith("The kiosk firmware")


def test_update_propagates_without_conflict(tmp_path, cloud):
    a, b = make_device(tmp_path, cloud, "A"), make_device(tmp_path, cloud, "B")
    a.memory.ingest_text("Meeting is at 5pm in room two.", "m")
    a.sync.run_once(); b.sync.run_once()
    mid = a.edge.all()[0].id
    a.memory.update_memory(mid, "Meeting is at 6pm in room two.")
    a.sync.run_once()
    rb = b.sync.run_once()
    assert rb.pulled == 1 and rb.conflicts == 0
    assert "6pm" in b.edge.get(mid).payload["text"] and b.edge.get(mid).payload["version"] == 2


def test_concurrent_edits_conflict_and_resolve_keep_local(tmp_path, cloud):
    a, b = make_device(tmp_path, cloud, "A"), make_device(tmp_path, cloud, "B")
    a.memory.ingest_text("Meeting is at 5pm in room two.", "m")
    a.sync.run_once(); b.sync.run_once()
    mid = a.edge.all()[0].id
    a.conn.set_forced_offline(True); b.conn.set_forced_offline(True)      # both offline, both edit
    a.memory.update_memory(mid, "Meeting moved to 6pm in room two.")
    b.memory.update_memory(mid, "Meeting moved to 7pm in room nine.")
    a.conn.set_forced_offline(False); b.conn.set_forced_offline(False)
    assert a.sync.run_once().pushed == 1                                  # first writer wins the push
    rb = b.sync.run_once()
    assert rb.conflicts == 1
    rec = b.edge.get(mid).payload
    assert rec["sync_status"] == M.CONFLICT and "6pm" in rec["conflict_remote"]["text"]
    assert b.memory.counts()["CONFLICT"] == 1
    b.sync.resolve(mid, "keep_local")                                     # B's text wins, at a newer version
    assert b.edge.get(mid).payload["sync_status"] == M.SYNCED
    assert "7pm" in b.cloud.get(mid).payload["text"]
    a.sync.run_once()
    assert "7pm" in a.edge.get(mid).payload["text"]                       # converged everywhere
    assert a.edge.get(mid).payload["version"] == b.edge.get(mid).payload["version"]


def _diverge(tmp_path, cloud, dev_b_kwargs=None):
    a = make_device(tmp_path, cloud, "A")
    b = make_device(tmp_path, cloud, "B", **(dev_b_kwargs or {}))
    a.memory.ingest_text("Dock code is 1111 for the north gate.", "d")
    a.sync.run_once(); b.sync.run_once()
    mid = a.edge.all()[0].id
    a.memory.update_memory(mid, "Dock code changed for north gate now.")
    b.memory.update_memory(mid, "Dock code differs at north gate today.")   # later => newer updated_at
    return a, b, mid


def test_conflict_keep_both_forks_local_text(tmp_path, cloud):
    a, b, mid = _diverge(tmp_path, cloud)
    a.sync.run_once(); assert b.sync.run_once().conflicts == 1
    out = b.sync.resolve(mid, "keep_both")
    texts = sorted(r.payload["text"] for r in b.edge.all())
    assert out["forked_id"] and texts == ["Dock code changed for north gate now.",
                                          "Dock code differs at north gate today."]
    assert b.edge.get(mid).payload["sync_status"] == M.SYNCED             # id now mirrors the cloud
    assert b.edge.get(out["forked_id"]).payload["sync_status"] == M.PENDING


def test_conflict_keep_remote(tmp_path, cloud):
    a, b, mid = _diverge(tmp_path, cloud)
    a.sync.run_once(); b.sync.run_once()
    b.sync.resolve(mid, "keep_remote")
    assert "changed" in b.edge.get(mid).payload["text"] and b.memory.counts()["CONFLICT"] == 0


def test_lww_policy_auto_resolves_to_newer_edit(tmp_path, cloud):
    a, b, mid = _diverge(tmp_path, cloud, {"conflict_policy": "lww"})
    a.sync.run_once()
    rep = b.sync.run_once()
    assert rep.auto_resolved == 1 and rep.conflicts == 0
    assert "today" in b.cloud.get(mid).payload["text"]                    # B edited later => B wins
    assert b.memory.counts()["CONFLICT"] == 0


def test_resolve_requires_connectivity(tmp_path, cloud):
    import pytest
    from backend.sync import Offline
    a, b, mid = _diverge(tmp_path, cloud)
    a.sync.run_once(); b.sync.run_once()
    b.conn.set_forced_offline(True)
    with pytest.raises(Offline):
        b.sync.resolve(mid, "keep_local")
    assert b.edge.get(mid).payload["sync_status"] == M.CONFLICT           # untouched


def test_delete_propagates_as_tombstone(tmp_path, cloud):
    a, b = make_device(tmp_path, cloud, "A"), make_device(tmp_path, cloud, "B")
    a.memory.ingest_text("Temporary wifi password rotation schedule notes.", "t")
    a.sync.run_once(); b.sync.run_once()
    mid = a.edge.all()[0].id
    assert a.memory.delete_memory(mid)["mode"] == "tombstone"
    a.sync.run_once(); b.sync.run_once()
    assert b.edge.get(mid).payload["deleted"] is True
    assert b.retriever.search("wifi rotation schedule").hits == []


def test_edit_that_adds_secret_retracts_from_cloud(dev):
    dev.memory.ingest_text("Server access notes for the depot gateway.", "s")
    dev.sync.run_once()
    mid = dev.edge.all()[0].id
    assert dev.cloud.count() == 1
    dev.memory.update_memory(mid, "Server access notes: password is Zx9Qw8Er7Ty6.")
    rep = dev.sync.run_once()
    assert rep.retracted == 1 and dev.cloud.count() == 0
    assert dev.edge.get(mid).payload["sync_status"] == M.LOCAL_ONLY


# -------------------------------------------------------------------- audit
def test_audit_chain_detects_tampering(tmp_path):
    log = AuditLog(tmp_path / "a.jsonl", key=b"k" * 32)
    for i in range(5):
        log.record("evt", i=i)
    assert log.verify()["valid"]
    lines = (tmp_path / "a.jsonl").read_text().splitlines()
    e = json.loads(lines[2]); e["data"]["i"] = 999
    lines[2] = json.dumps(e, sort_keys=True, separators=(",", ":"))
    (tmp_path / "a.jsonl").write_text("\n".join(lines) + "\n")
    v = log.verify()
    assert not v["valid"] and v["first_bad_seq"] == 3
