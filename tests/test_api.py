import time

from fastapi.testclient import TestClient
from qdrant_client import QdrantClient

from backend.main import create_app
from .conftest import make_device


class FakeLLM:
    model = "fake"
    def answer(self, q, hits): return "ANSWER:" + hits[0].text
    def stream(self, q, hits): yield from ["AN", "SWER"]


def client(tmp_path):
    cloud = QdrantClient(":memory:")
    def f():
        d = make_device(tmp_path, cloud)
        d.llm = FakeLLM()
        return d
    return TestClient(create_app(f))


def test_end_to_end_api(tmp_path):
    with client(tmp_path) as c:
        assert c.post("/ingest", json={"text": "The robot arm calibrates every morning at six."}).json()["new"] == 1
        c.post("/ingest", json={"text": "My password is Xk29Lm4Qp7Zz."})
        st = c.get("/status").json()
        assert st["edge"]["total"] == 2 and st["edge"]["LOCAL_ONLY"] == 1

        r = c.post("/search", json={"query": "when does the robot arm calibrate"}).json()
        assert r["hits"][0]["dense_rank"] and "timings_ms" in r

        chat = c.post("/chat", json={"query": "when does the robot arm calibrate"}).json()
        assert chat["grounded"] and chat["answer"].startswith("ANSWER:") and chat["sources"][0]["source"]

        miss = c.post("/chat", json={"query": "zebra quantum pineapple"}).json()
        assert miss["grounded"] is False and "don't have" in miss["answer"]   # LLM never called

        assert c.post("/network", json={"online": False}).json()["online"] is False
        c.post("/ingest", json={"text": "Offline note about spare batteries in cabinet three."})
        assert c.post("/sync").json()["online"] is False
        assert c.post("/network", json={"online": True}).json()["online"] is True
        for _ in range(50):                                                   # watcher auto-syncs on reconnect
            if c.get("/status").json()["cloud_memories"] == 2:
                break
            time.sleep(0.1)
        assert c.get("/status").json()["cloud_memories"] == 2                 # secret note stayed home
        assert c.post("/sync").json()["pushed"] == 0                          # nothing left: idempotent
        assert sum(e["type"] == "sync_push" for e in c.get("/activity").json()["items"]) == 2

        items = c.get("/memories", params={"status": "SYNCED"}).json()["items"]
        assert len(items) == 2
        mid = items[0]["id"]
        assert c.put(f"/memories/{mid}", json={"text": "Edited text about batteries."}).json()["changed"]
        assert c.delete(f"/memories/{mid}").json()["mode"] == "tombstone"
        assert c.get("/audit/verify").json()["valid"]
        assert any(e["type"] == "sync_push" for e in c.get("/activity").json()["items"])
        assert c.get("/memories/does-not-exist").status_code == 404


def test_upload_and_privacy_preview(tmp_path):
    with client(tmp_path) as c:
        r = c.post("/upload", files={"file": ("n.txt", b"Wheels need new bearings every year. " * 30, "text/plain")})
        assert r.status_code == 200 and r.json()["chunks"] >= 1
        assert c.post("/upload", files={"file": ("e.txt", b"   ", "text/plain")}).status_code in (200, 422)
        p = c.post("/privacy/preview", json={"text": "mail bob@example.com key AKIAIOSFODNN7EXAMPLE"}).json()
        assert p["sensitive"] and "[REDACTED:email]" in p["redacted"] and "AKIA" not in p["redacted"]
