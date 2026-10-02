"""HTTP API for QuadNode Edge Memory Engine.

Run: python -m uvicorn backend.main:app --port 8000
Note: Embedded Qdrant maintains an exclusive write lock on storage.
Do not use '--reload' in production or multi-worker mode.
"""

from __future__ import annotations

import asyncio
import io
import json
import logging
import time
from contextlib import asynccontextmanager
from typing import Literal

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, File, HTTPException, Query, UploadFile, status
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

# ------------------------------------------------------------------ SCHEMAS

class IngestIn(BaseModel):
    text: str = Field(..., min_length=1, description="Raw text memory content")
    source: str | None = Field(None, description="Optional document source identifier")


class UpdateIn(BaseModel):
    text: str = Field(..., min_length=1, description="Updated text memory content")


class QueryIn(BaseModel):
    query: str = Field(..., min_length=1)
    k: int = Field(5, ge=1, le=20)


class NetworkIn(BaseModel):
    online: bool


class ResolveIn(BaseModel):
    strategy: Literal["keep_local", "keep_remote", "keep_both"]


# ------------------------------------------------------------------ HELPERS

def _view(rec, full: bool = True) -> dict:
    p = dict(rec.payload)
    if not full and "text" in p:
        p["text"] = p["text"][:200]
    return {"id": rec.id, **p}


async def _read_upload_stream(file: UploadFile, max_bytes: int) -> bytes:
    """Reads uploaded files in 1MB chunks to prevent memory exhaustion attacks."""
    size = 0
    chunks = []
    while chunk := await file.read(1024 * 1024):
        size += len(chunk)
        if size > max_bytes:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {max_bytes // (1024 * 1024)}MB"
            )
        chunks.append(chunk)
    return b"".join(chunks)


# ------------------------------------------------------------------ APPLICATION

def create_app(factory=build) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        c: Container = await run_in_threadpool(factory)
        app.state.c = c
        app.state.sync_lock = asyncio.Lock()  # Protects embedded store from concurrent write operations
        app.state.wake = asyncio.Event()
        app.state.loop = asyncio.get_running_loop()
        
        task = asyncio.create_task(_sync_loop(app))
        c.audit.record("boot", device=c.cfg.device_id, llm=getattr(c.llm, "model", None))
        
        yield
        
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    async def _sync_loop(app: FastAPI):
        """Monitors network state and triggers auto-sync when online."""
        c: Container = app.state.c
        was_online = None
        while True:
            try:
                online = await asyncio.to_thread(c.conn.probe, False)
                if online != was_online:
                    c.audit.record("network", online=online, forced=c.conn.forced_offline)
                    was_online = online
                
                if online and not app.state.sync_lock.locked():
                    async with app.state.sync_lock:
                        await asyncio.to_thread(c.sync.run_once)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Error inside background sync loop")

            try:
                await asyncio.wait_for(app.state.wake.wait(), timeout=c.cfg.sync_interval)
            except asyncio.TimeoutError:
                pass
            app.state.wake.clear()

    app = FastAPI(
        title="QuadNode Edge Memory Engine",
        version="2.0.0",
        description="Offline-First Vector RAG & Synchronization Platform",
        lifespan=lifespan
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:3000", "http://localhost:5173", "tauri://localhost"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    def C() -> Container:
        return app.state.c

    # -------------------------------------------------------------- STATUS

    @app.get("/health")
    def health():
        return {"status": "healthy", "timestamp": time.time()}

    @app.get("/status")
    def get_status():
        c = C()
        online = c.conn.probe()
        cloud_n = None
        if online:
            try:
                cloud_n = c.cloud.count(None)
            except Exception:
                cloud_n = None

        return {
            "device_id": c.cfg.device_id,
            "online": online,
            "forced_offline": c.conn.forced_offline,
            "edge": c.memory.counts(),
            "cloud_memories": cloud_n,
            "conflict_policy": c.cfg.conflict_policy,
            "llm_model": getattr(c.llm, "model", "Llama3-8B-Local"),
            "last_sync_at": c.sync.state.get("last_sync_at"),
            "last_sync": c.sync.state.get("last_report"),
            "audit": {"sequence": c.audit._seq}
        }

    # -------------------------------------------------------------- INGESTION

    @app.post("/ingest", status_code=status.HTTP_201_CREATED)
    async def ingest(body: IngestIn):
        c = C()
        async with app.state.sync_lock:
            try:
                return await run_in_threadpool(c.memory.ingest_text, body.text, body.source)
            except Invalid as e:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))

    @app.post("/upload")
    async def upload(file: UploadFile = File(...)):
        c = C()
        max_bytes = c.cfg.max_upload_mb * 1024 * 1024
        data = await _read_upload_stream(file, max_bytes)
        filename = file.filename or "uploaded_document"

        def process_file():
            if filename.lower().endswith(".pdf"):
                from pypdf import PdfReader
                reader = PdfReader(io.BytesIO(data))
                extracted_pages = []
                for idx, page in enumerate(reader.pages):
                    text = page.extract_text() or ""
                    if text.strip():
                        extracted_pages.append((idx + 1, text))
                
                if not extracted_pages:
                    raise Invalid("PDF contains no extractable text or is a scanned document.")
                return c.memory.ingest_segments(filename, extracted_pages)
            else:
                raw_text = data.decode("utf-8", errors="replace")
                if not raw_text.strip():
                    raise Invalid("Uploaded text file is empty.")
                return c.memory.ingest_segments(filename, [(None, raw_text)])

        async with app.state.sync_lock:
            try:
                return await run_in_threadpool(process_file)
            except Invalid as e:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(e))

    @app.post("/privacy/preview")
    def privacy_preview(body: IngestIn):
        scan_result = C().privacy.scan(body.text)
        return {
            "sensitive": scan_result.sensitive,
            "labels": scan_result.labels,
            "redacted": PrivacyGuard.redact(body.text)
        }

    # ------------------------------------------------------ SEARCH & CHAT

    @app.post("/search")
    def search(body: QueryIn):
        res = C().retriever.search(body.query, top_k=body.k, explain=True)
        return {
            "query": res.query,
            "timings_ms": res.timings_ms,
            "hits": [hit.public() for hit in res.hits]
        }

    def _grounded_context(query: str):
        c = C()
        res = c.retriever.search(query, top_k=c.cfg.context_k, explain=False)
        usable_hits = [h for h in res.hits if h.confident]
        return res, usable_hits

    def _format_source(hit):
        return {
            "id": hit.id,
            "source": hit.source,
            "page": hit.page,
            "score": hit.rerank_score,
            "sync_status": hit.sync_status
        }

    NO_MEMORY_MSG = "I do not have sufficient grounded memory on this topic to answer accurately."

    @app.post("/chat")
    def chat(body: QueryIn):
        c = C()
        res, usable_hits = _grounded_context(body.query)
        if not usable_hits:
            return {
                "answer": NO_MEMORY_MSG,
                "grounded": False,
                "sources": [],
                "timings_ms": res.timings_ms
            }

        try:
            t0 = time.perf_counter()
            answer_text = c.llm.answer(body.query, usable_hits)
            res.timings_ms["llm"] = round((time.perf_counter() - t0) * 1000, 1)
            return {
                "answer": answer_text,
                "grounded": True,
                "sources": [_format_source(h) for h in usable_hits],
                "timings_ms": res.timings_ms
            }
        except Exception as err:
            log.exception("Local LLM Generation Error")
            return {
                "answer": None,
                "grounded": True,
                "llm_error": type(err).__name__,
                "sources": [_format_source(h) for h in usable_hits],
                "timings_ms": res.timings_ms
            }

    @app.post("/chat/stream")
    def chat_stream(body: QueryIn):
        c = C()
        res, usable_hits = _grounded_context(body.query)

        def event_generator():
            yield f"event: sources\ndata: {json.dumps([_format_source(h) for h in usable_hits])}\n\n"
            if not usable_hits:
                yield f"event: token\ndata: {json.dumps(NO_MEMORY_MSG)}\n\n"
            else:
                try:
                    for token in c.llm.stream(body.query, usable_hits):
                        yield f"event: token\ndata: {json.dumps(token)}\n\n"
                except Exception as err:
                    yield f"event: error\ndata: {json.dumps(type(err).__name__)}\n\n"
            yield f"event: done\ndata: {json.dumps(res.timings_ms)}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")

    # ----------------------------------------------------------- MEMORIES

    @app.get("/memories")
    def list_memories(
        status_filter: str | None = Query(None, alias="status"),
        source: str | None = None,
        include_deleted: bool = False,
        limit: int = Query(50, ge=1, le=200),
        offset: str | None = None
    ):
        if status_filter and status_filter not in M.STATUSES:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"Invalid status filter. Must be one of {M.STATUSES}")
        records, next_off = C().memory.list_memories(status_filter, source, include_deleted, limit, offset)
        return {
            "items": [_view(r, full=False) for r in records],
            "next_offset": str(next_off) if next_off else None
        }

    @app.get("/memories/{id_}")
    def get_memory(id_: str):
        record = C().edge.get(id_)
        if not record:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Memory record not found")
        return _view(record)

    @app.put("/memories/{id_}")
    async def update_memory(id_: str, body: UpdateIn):
        async with app.state.sync_lock:
            try:
                return await run_in_threadpool(C().memory.update_memory, id_, body.text)
            except NotFound:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Memory record not found")
            except Invalid as e:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))

    @app.delete("/memories/{id_}")
    async def delete_memory(id_: str):
        async with app.state.sync_lock:
            try:
                return await run_in_threadpool(C().memory.delete_memory, id_)
            except NotFound:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Memory record not found")

    # ------------------------------------------------------- SYNC & CLOUD

    @app.post("/sync")
    @app.post("/sync/bidirectional")
    async def sync_bidirectional():
        """Full 2-way synchronization cycle between Local Qdrant and Cloud Cluster."""
        async with app.state.sync_lock:
            report = await asyncio.to_thread(C().sync.run_once)
            return report.dict() if hasattr(report, "dict") else report

    @app.post("/sync/push")
    async def sync_push():
        """Pushes pending local memories to Qdrant Cloud."""
        async with app.state.sync_lock:
            return await asyncio.to_thread(C().sync.push_only)

    @app.post("/sync/pull")
    async def sync_pull():
        """Pulls updated memories from Qdrant Cloud down to Edge storage."""
        async with app.state.sync_lock:
            return await asyncio.to_thread(C().sync.pull_only)

    @app.get("/sync/status")
    def sync_status():
        c = C()
        online = c.conn.probe()
        edge_counts = c.memory.counts()
        cloud_count = c.cloud.count(None) if online else 0
        return {
            "online": online,
            "local_vectors": edge_counts.get("total", 0),
            "cloud_vectors": cloud_count,
            "last_sync": c.sync.state.get("last_sync_at")
        }

    @app.post("/network")
    async def toggle_network(body: NetworkIn):
        """Simulate losing/gaining internet connectivity for testing offline resilience."""
        c = C()
        c.conn.set_forced_offline(not body.online)
        c.audit.record("network", online=body.online, forced=not body.online)
        app.state.wake.set()
        return {
            "online": await asyncio.to_thread(c.conn.probe, False),
            "forced_offline": c.conn.forced_offline
        }

    @app.get("/conflicts")
    def list_conflicts():
        from .store import f_status
        return {"items": [_view(r) for r in C().edge.all(f_status(M.CONFLICT))]}

    @app.post("/conflicts/{id_}/resolve")
    async def resolve_conflict(id_: str, body: ResolveIn):
        async with app.state.sync_lock:
            try:
                return await asyncio.to_thread(C().sync.resolve, id_, body.strategy)
            except Offline as e:
                raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(e))
            except ConflictError as e:
                raise HTTPException(status.HTTP_409_CONFLICT, str(e))

    # ----------------------------------------------------- AUDIT & EVENTS

    @app.get("/activity")
    def get_activity(limit: int = Query(100, ge=1, le=500), types: str | None = None):
        type_set = set(types.split(",")) if types else None
        return {"items": C().audit.recent(limit, type_set)}

    @app.get("/audit/verify")
    def verify_audit():
        return C().audit.verify()

    @app.get("/events")
    async def sse_events():
        c = C()
        event_queue = c.audit.subscribe(asyncio.get_running_loop())

        async def stream():
            try:
                yield "retry: 2000\n\n"
                while True:
                    try:
                        evt = await asyncio.wait_for(event_queue.get(), timeout=15)
                        yield f"data: {json.dumps(evt)}\n\n"
                    except asyncio.TimeoutError:
                        yield ": keepalive\n\n"
            finally:
                c.audit.unsubscribe(event_queue)

        return StreamingResponse(stream(), media_type="text/event-stream")

    return app


app = create_app()