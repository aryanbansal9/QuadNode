# QuadNode backend (refactor)

Offline-first edge memory: chunk -> privacy gate -> hybrid retrieval -> local LLM, with
version-aware edge<->cloud sync and conflict handling.

## Layout
```
backend/
  config.py     env-driven settings           models.py    record schema + pure helpers
  chunking.py   sentence-aware chunker        privacy.py   regex + entropy + GLiNER gate (per chunk)
  embeddings.py Nomic dense + BM25 + rerank   store.py     thread-safe Qdrant collection wrapper
  retrieval.py  hybrid RRF + rerank + explain service.py   ingest / update / delete (versioned)
  sync.py       push / pull / conflicts       audit.py     HMAC hash-chained log + SSE fan-out
  llm.py        Ollama (VRAM auto-pick)       container.py wiring / dependency injection
  main.py       FastAPI app
tests/          21 tests (real Qdrant, fake models)
```

## Run
```bash
python -m venv venv && venv\Scripts\activate          # Windows
pip install -r requirements.txt
ollama pull llama3.1:8b        # (or llama3.2:3b for CPU-only)
python -m uvicorn backend.main:app --port 8000          # NO --reload (embedded Qdrant file lock)
pytest -q                                              # no models/GPU needed
```
Pre-download models once while online (fastembed/flashrank/GLiNER cache into `backend/models`
or the HF cache); afterwards set `HF_HUB_OFFLINE=1` for a true air-gapped run.

### Real cloud + two devices (recommended demo)
```bash
docker run -p 6333:6333 qdrant/qdrant
set QN_CLOUD_URL=http://localhost:6333
set QN_DEVICE_ID=EDGE-A  &  python -m uvicorn backend.main:app --port 8000
set QN_DEVICE_ID=EDGE-B  &  python -m uvicorn backend.main:app --port 8001   # second terminal
```
Without `QN_CLOUD_URL` the cloud is an embedded folder (single process only).

### Env vars (all optional)
`QN_DEVICE_ID` `QN_CLOUD_URL` `QN_CLOUD_API_KEY` `QN_CONFLICT_POLICY=manual|lww`
`QN_USE_GLINER=0|1` `QN_PRIVACY_FAIL_CLOSED=1` `QN_LLM_MODEL` `QN_SYNC_INTERVAL` `QN_DATA_DIR`

## API
| | |
|---|---|
| `POST /ingest {text,source?}` `POST /upload` (pdf/txt/md) | chunk + gate + embed + store |
| `POST /search {query,k}` | explainable hybrid hits (dense/sparse/fused rank, rerank score, timings) |
| `POST /chat` `POST /chat/stream` (SSE) | grounded answer; never calls the LLM without evidence |
| `GET /memories?status=&source=` `GET/PUT/DELETE /memories/{id}` | inspect / edit / delete |
| `GET /status` `POST /sync` `POST /network {online}` | device + sync state; demo offline switch |
| `GET /conflicts` `POST /conflicts/{id}/resolve {strategy}` | `keep_local` / `keep_remote` / `keep_both` |
| `GET /activity` `GET /events` (SSE) `GET /audit/verify` | activity feed, live stream, tamper check |
| `POST /privacy/preview {text}` | what the gate would flag + redacted view |

## Sync model in one table
`local_changed = version > synced_version` · `remote_changed = remote.version > synced_version`

| local changed | remote changed | result |
|---|---|---|
| yes | no | PUSH |
| no | yes | PULL |
| yes | yes (content differs) | CONFLICT -> manual resolve, or auto last-writer-wins |
| identical content | | converge bookkeeping only |

`LOCAL_ONLY` chunks are never pushed (checked at the push site too). Deletes propagate as
tombstones. Editing a synced memory so it now contains a secret retracts it from the cloud.

## Swapping in Qdrant Edge
`MemoryStore` is the only class that touches the storage engine (~12 methods). Qdrant Edge
(`pip install qdrant-edge-py`, Python 3.11+) uses a different API: `EdgeShard.create/load`,
`shard.update(UpdateOperation.upsert_points([Point(...)]))`, `shard.retrieve(...)`,
`shard.query(QueryRequest(query=Query.Nearest(vec, using=...), filter=..., limit=...))`.
Write `EdgeMemoryStore` with the same methods, then pass it to `build()`. Verify against the
docs first: scroll, set-payload and prefetch/fusion signatures (docs: qdrant.tech/documentation/edge/).

## Known limitations
* Not run against the real GLiNER / fastembed / FlashRank / Ollama in CI - tests use fakes.
* Cloud check-then-write is not atomic; two devices pushing the same id at the same instant can race.
* `lww` uses wall clocks; skewed device clocks can pick the "wrong" winner.
* Tombstones keep their vectors; a retracted memory may already exist on other devices.
* Scanned PDFs need OCR (not included).
