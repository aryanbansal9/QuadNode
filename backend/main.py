"""HTTP API. Run:  python -m uvicorn backend.main:app --port 8000   (no --reload:
embedded Qdrant holds a file lock and reload would spawn a second process)."""
from __future__ import annotations

import asyncio
import io
import json
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from . import models as M
from .container import Container, build
from .privacy import PrivacyGuard
from .service import Invalid, NotFound
from .sync import ConflictError, Offline

log = logging.getLogger("quadnode")


class IngestIn(BaseModel):
    text: str = Field(min_length=1)
    source: str | None = None


class UpdateIn(BaseModel):
    text: str = Field(min_length=1)


class QueryIn(BaseModel):
    query: str = Field(min_length=1)
    k: int = Field(5, ge=1, le=20)


class NetworkIn(BaseModel):
    online: bool


class ResolveIn(BaseModel):
    strategy: str   # keep_local | keep_remote | keep_both


def _view(rec, full: bool = True) -> dict:
    p = dict(rec.payload)
    if not full:
        p["text"] = p.get("text", "")[:200]
    return {"id": rec.id, **p}


def create_app(factory=build) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        c: Container = await run_in_threadpool(factory)
        app.state.c = c
        loop = asyncio.get_running_loop()
        app.state.wake = asyncio.Event()
        app.state.loop = loop
        task = asyncio.create_task(_sync_loop(app))
        c.audit.record("boot", device=c.cfg.device_id, llm=getattr(c.llm, "model", None))
        yield
        task.cancel()

    async def _sync_loop(app: FastAPI):
        """Connectivity watcher + background sync. Wakes on a timer or when the
        network switch is flipped, so 'reconnect' triggers sync immediately."""
        c: Container = app.state.c
        was = None
        while True:
            try:
                online = await asyncio.to_thread(c.conn.probe, False)
                if online != was:
                    c.audit.record("network", online=online, forced=c.conn.forced_offline)
                    was = online
                if online:
                    await asyncio.to_thread(c.sync.run_once)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("sync loop error")
            try:
                await asyncio.wait_for(app.state.wake.wait(), timeout=c.cfg.sync_interval)
            except asyncio.TimeoutError:
                pass
            app.state.wake.clear()

    app = FastAPI(title="QuadNode Edge Memory", lifespan=lifespan)
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

    def C() -> Container:
        return app.state.c

    # ------------------------------------------------------------------ status
    @app.get("/health")
    def health():
        return {"ok": True}

    @app.get("/status")
    def status():
        c = C()
        online = c.conn.probe()
        try:
            cloud_n = c.cloud.count(None) if online else None
        except Exception:
            cloud_n = None
        return {"device_id": c.cfg.device_id, "online": online, "forced_offline": c.conn.forced_offline,
                "edge": c.memory.counts(), "cloud_memories": cloud_n,
                "conflict_policy": c.cfg.conflict_policy, "llm_model": getattr(c.llm, "model", None),
                "last_sync_at": c.sync.state.get("last_sync_at"), "last_sync": c.sync.state.get("last_report"),
                "audit": {"entries": c.audit._seq}}

    # ------------------------------------------------------------------ ingest
    @app.post("/ingest")
    def ingest(body: IngestIn):
        try:
            return C().memory.ingest_text(body.text, body.source)
        except Invalid as e:
            raise HTTPException(422, str(e))

    @app.post("/upload")
    async def upload(file: UploadFile = File(...)):
        c = C()
        data = await file.read()
        if len(data) > c.cfg.max_upload_mb * 1024 * 1024:
            raise HTTPException(413, "File too large")
        name = file.filename or "upload"

        def work():
            if name.lower().endswith(".pdf"):
                from pypdf import PdfReader
                pages = [(i + 1, (p.extract_text() or "")) for i, p in enumerate(PdfReader(io.BytesIO(data)).pages)]
            else:
                pages = [(None, data.decode("utf-8", errors="replace"))]
            return c.memory.ingest_segments(name, [(pg, t) for pg, t in pages if t.strip()])

        try:
            return await run_in_threadpool(work)
        except Invalid as e:
            raise HTTPException(422, str(e))

    @app.post("/privacy/preview")
    def privacy_preview(body: IngestIn):
        v = C().privacy.scan(body.text)
        return {"sensitive": v.sensitive, "labels": v.labels, "redacted": PrivacyGuard.redact(body.text)}

    # ---------------------------------------------------------- search & chat
    @app.post("/search")
    def search(body: QueryIn):
        r = C().retriever.search(body.query, top_k=body.k, explain=True)
        return {"query": r.query, "timings_ms": r.timings_ms, "hits": [h.public() for h in r.hits]}

    def _grounded(q: str):
        c = C()
        r = c.retriever.search(q, top_k=c.cfg.context_k, explain=False)
        return r, [h for h in r.hits if h.confident]

    def _src(h):
        return {"id": h.id, "source": h.source, "page": h.page, "score": h.rerank_score,
                "sync_status": h.sync_status}

    NO_MEM = "I don't have anything relevant in memory for that."

    @app.post("/chat")
    def chat(body: QueryIn):
        c = C()
        r, usable = _grounded(body.query)
        if not usable:                                    # never let the LLM improvise
            return {"answer": NO_MEM, "grounded": False, "sources": [], "timings_ms": r.timings_ms}
        try:
            import time
            t0 = time.perf_counter()
            ans = c.llm.answer(body.query, usable)
            r.timings_ms["llm"] = round((time.perf_counter() - t0) * 1000, 1)
            return {"answer": ans, "grounded": True, "sources": [_src(h) for h in usable], "timings_ms": r.timings_ms}
        except Exception as e:
            log.exception("LLM failure")
            return {"answer": None, "grounded": True, "llm_error": f"{type(e).__name__}",
                    "sources": [_src(h) for h in usable], "timings_ms": r.timings_ms}

    @app.post("/chat/stream")
    def chat_stream(body: QueryIn):
        c = C()
        r, usable = _grounded(body.query)

        def gen():
            yield f"event: sources\ndata: {json.dumps([_src(h) for h in usable])}\n\n"
            if not usable:
                yield f"event: token\ndata: {json.dumps(NO_MEM)}\n\n"
            else:
                try:
                    for tok in c.llm.stream(body.query, usable):
                        yield f"event: token\ndata: {json.dumps(tok)}\n\n"
                except Exception as e:
                    yield f"event: error\ndata: {json.dumps(type(e).__name__)}\n\n"
            yield f"event: done\ndata: {json.dumps(r.timings_ms)}\n\n"

        return StreamingResponse(gen(), media_type="text/event-stream")

    # --------------------------------------------------------------- memories
    @app.get("/memories")
    def memories(status: str | None = Query(None), source: str | None = None, include_deleted: bool = False,
                 limit: int = Query(50, ge=1, le=200), offset: str | None = None):
        if status and status not in M.STATUSES:
            raise HTTPException(422, f"status must be one of {M.STATUSES}")
        recs, nxt = C().memory.list_memories(status, source, include_deleted, limit, offset)
        return {"items": [_view(r, full=False) for r in recs], "next_offset": str(nxt) if nxt else None}

    @app.get("/memories/{id_}")
    def memory(id_: str):
        r = C().edge.get(id_)
        if not r:
            raise HTTPException(404, "not found")
        return _view(r)

    @app.put("/memories/{id_}")
    def update(id_: str, body: UpdateIn):
        try:
            return C().memory.update_memory(id_, body.text)
        except NotFound:
            raise HTTPException(404, "not found")
        except Invalid as e:
            raise HTTPException(409, str(e))

    @app.delete("/memories/{id_}")
    def delete(id_: str):
        try:
            return C().memory.delete_memory(id_)
        except NotFound:
            raise HTTPException(404, "not found")

    # ------------------------------------------------------------------- sync
    @app.post("/sync")
    async def sync_now():
        return (await asyncio.to_thread(C().sync.run_once)).dict()

    @app.post("/network")
    async def network(body: NetworkIn):
        """Demo switch: simulate losing/regaining connectivity."""
        c = C()
        c.conn.set_forced_offline(not body.online)
        c.audit.record("network", online=body.online, forced=not body.online)
        app.state.wake.set()
        return {"online": await asyncio.to_thread(c.conn.probe, False), "forced_offline": c.conn.forced_offline}

    @app.get("/conflicts")
    def conflicts():
        return {"items": [_view(r) for r in C().edge.all(M_status(M.CONFLICT))]}

    @app.post("/conflicts/{id_}/resolve")
    async def resolve(id_: str, body: ResolveIn):
        try:
            return await asyncio.to_thread(C().sync.resolve, id_, body.strategy)
        except Offline as e:
            raise HTTPException(503, str(e))
        except ConflictError as e:
            raise HTTPException(409, str(e))

    # -------------------------------------------------------- activity & audit
    @app.get("/activity")
    def activity(limit: int = Query(100, ge=1, le=500), types: str | None = None):
        return {"items": C().audit.recent(limit, set(types.split(",")) if types else None)}

    @app.get("/audit/verify")
    def audit_verify():
        return C().audit.verify()

    @app.get("/events")
    async def events():
        c = C()
        q = c.audit.subscribe(asyncio.get_running_loop())

        async def gen():
            try:
                yield "retry: 2000\n\n"
                while True:
                    try:
                        e = await asyncio.wait_for(q.get(), timeout=15)
                        yield f"data: {json.dumps(e)}\n\n"
                    except asyncio.TimeoutError:
                        yield ": keepalive\n\n"
            finally:
                c.audit.unsubscribe(q)

        return StreamingResponse(gen(), media_type="text/event-stream")

    return app


def M_status(s):
    from .store import f_status
    return f_status(s)


app = create_app()
