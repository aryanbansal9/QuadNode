# QuadNode: Enterprise-Grade Edge AI Security & Memory Engine

Offline-first edge memory platform featuring per-chunk privacy gating, Reciprocal Rank Fusion (RRF) hybrid retrieval, local Llama 3.1 inference, and deterministic 3-way edge-to-cloud synchronization with conflict handling.

---
## 📂 Project Layout
```
backend/
  config.py     Env-driven settings           models.py    Record schema + pure helpers
  chunking.py   Sentence-aware chunker        privacy.py   Regex + entropy + GLiNER gate (per chunk)
  embeddings.py Nomic dense + BM25 + rerank   store.py     Thread-safe Qdrant collection wrapper
  retrieval.py  Hybrid RRF + rerank + explain service.py   Ingest / update / delete (versioned)
  sync.py       Push / pull / conflicts       audit.py     HMAC hash-chained log + SSE fan-out
  llm.py        Ollama (VRAM auto-pick)       container.py Wiring / dependency injection
  main.py       FastAPI application router

tests/          21 automated tests (real Qdrant, mock models)
```

---

## 🚀 Quick Start & Running

### 1. Environment Setup
```bash
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
```

### 2. Pull Local Models (Ollama)
```
Bash

ollama pull llama3.1:latest    # (or llama3.2:3b for CPU-only nodes)
```

### 3. Run the Backend Server
Note: Do not use `--reload` because the embedded Qdrant database maintains a strict file lock.
```
Bash

python -m uvicorn backend.main:app --port 8000
```
Open your browser at http://127.0.0.1:8000/docs to view the interactive Swagger API documentation.

## 4. Run the Automated Test Suite
```
Bash

pytest -q
```
---
## 🌐 Multi-Device & Cloud Demo Setup
To demonstrate real distributed edge-to-cloud synchronization with intermittent connectivity:
### 1. Spin up a local Qdrant Cloud server via Docker:
```
Bash
docker run -p 6333:6333 qdrant/qdrant
```
### 2. Launch Edge Node A (Terminal 1):
```
Bash

set QN_CLOUD_URL=http://localhost:6333
set QN_DEVICE_ID=EDGE-A
python -m uvicorn backend.main:app --port 8000
```
### 3. Launch Edge Node B (Terminal 2):
```
Bash

set QN_CLOUD_URL=http://localhost:6333
set QN_DEVICE_ID=EDGE-B
python -m uvicorn backend.main:app --port 8001
```
---
## 🔌 Core API Reference

| Endpoint | Description |
| :--- | :--- |
| `POST /ingest` or `POST /upload` | Ingests `.pdf`/`.txt` files, chunks text, applies GLiNER zero-shot privacy scans, and embeds into Edge DB |
| `POST /search` | Returns explainable hybrid hits (dense rank, sparse rank, fused RRF rank, rerank score, timings) |
| `POST /chat` or `POST /chat/stream` | Grounded local LLM response; never invokes the model without verified memory evidence |
| `GET /memories` or `GET/PUT/DELETE /memories/{id}` | Inspect, edit, or delete stored memories |
| `GET /status`, `POST /sync`, `POST /network` | Device telemetry, sync triggers, and live offline simulation toggle |
| `GET /conflicts`, `POST /conflicts/{id}/resolve` | View conflicting concurrent edits and resolve via strategy (`keep_local`, `keep_remote`, `keep_both`) |
| `GET /activity`, `GET /events`, `GET /audit/verify` | Live activity feed, Server-Sent Events stream, and HMAC tamper-evident audit verification |
| `POST /privacy/preview` | Preview what secrets the privacy gate flags and see redacted output |
---
## 🔄 Synchronization & Conflict Logic
The system evaluates state changes using a 3-way version tracker (`version` vs `synced_version`):

| Local Changed | Remote Changed | Resulting Action |
| :--- | :--- | :--- |
| Yes | No | **PUSH** |
| No | Yes | **PULL** |
| Yes | Yes (Content differs) | **CONFLICT** (Manual resolution or auto Last-Writer-Wins) |
| Identical Content | Identical Content | **SAME** (Converge bookkeeping) |

* **Privacy Protection:** `LOCAL_ONLY` chunks containing sensitive credentials or PII are strictly quarantined and never transmitted to the cloud.
* **Tombstones:** Deletions propagate securely across nodes via tombstones.

---
 
## 🛡️ Known Limitations & Future Roadmap
* **Scanned PDFs:** Require external OCR integration.
* **Clock Skew:** Last-Writer-Wins (`lww`) conflict resolution relies on system wall clocks.
* **Hardware Auto-Tuning:** Automatically detects available GPU VRAM at startup to scale between 8B and 3B models.