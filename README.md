# 🚀 QuadNode: Enterprise-Grade Edge AI Security & Memory Engine

QuadNode is an offline-first, edge-native AI memory architecture designed to eliminate hallucinations, enforce cryptographic data privacy, and deliver sub-millisecond retrieval speeds entirely on local hardware. 

By unifying **zero-shot privacy guardrails**, **hybrid vector search**, **cross-encoder re-ranking**, and **local LLM reasoning**, QuadNode creates a self-aware memory assistant that operates with 100% data sovereignty. It features a distributed dual-database architecture for intelligent edge-to-cloud synchronization.

---

## 🧠 Architectural Pipeline
```text
       [User Input / Text Document]
                    │
                    ▼
 ┌──────────────────────────────────────┐
 │  1. Zero-Shot PII Guardrail (GLiNER) │ ──► Flags Credentials (LOCAL_ONLY vs PENDING)
 └──────────────────────────────────────┘
                    │
                    ▼
 ┌──────────────────────────────────────┐
 │  2. Vectorization (Nomic FastEmbed)  │ ──► 256-d Dense Vector Matryoshka
 └──────────────────────────────────────┘
                    │
                    ▼
 ┌──────────────────────────────────────┐
 │  3. Local Vector Storage (Qdrant)    │ ──► Edge DB Recall (Top-10 Matches)
 └──────────────────────────────────────┘
                    │
                    ▼
 ┌──────────────────────────────────────┐
 │ 4. Cross-Encoder Ranker (FlashRank)  │ ──► Stage 2 Precision Scoring (>0.05)
 └──────────────────────────────────────┘
                    │
                    ▼
 ┌──────────────────────────────────────┐
 │  5. Local Inference (Ollama Llama3)  │ ──► Factual Generation (Zero Guesswork)
 └──────────────────────────────────────┘
                    │
                    ▼
 ┌──────────────────────────────────────┐
 │ 6. Edge-to-Cloud Sync Engine         │ ──► Pushes PENDING vectors to Cloud Server
 └──────────────────────────────────────┘
```

---
## 🛠️ Technology Stack & Engine

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Vector Storage** | **Qdrant** | High-speed dual databases (`qdrant_edge/` and `qdrant_cloud_sim/`). |
| **Dense Embedding** | **FastEmbed** | Lightweight, high-accuracy semantic vector representations (`nomic-embed-text-v1.5`). |
| **Re-Ranking** | **FlashRank** | Cross-encoder precision scoring that eliminates context noise (`ms-marco-MiniLM-L-12-v2`). |
| **Privacy Filter** | **GLiNER** | Zero-shot Named Entity Recognition to quarantine sensitive tokens. |
| **LLM Inference** | **Ollama** | Offline, privacy-first local LLM execution (`llama3.1`). |
| **Caching Layer** | **Semantic Cache** | Sub-millisecond response delivery for recurring queries. |
| **Compliance** | **SHA-256 Ledger** | Cryptographically signed transaction history saved to `audit.log`. |

---
## 📂 Repository Structure

```text
QuadNode/
├── backend/                  # FastAPI Python Sidecar
│   ├── main.py               # Distributed inference & API routing
│   ├── audit.log             # Cryptographic SHA-256 ledger
│   ├── qdrant_edge/          # Local vector database (Edge memory)
│   └── qdrant_cloud_sim/     # Simulated Centralized Server (Cloud memory)
├── frontend/                 # Tauri v2 + React UI (Managed separately)
├── run.bat                   # One-click Windows startup script
└── requirements.txt          # Python ML dependencies
```

---
## 📋 Prerequisites & Setup

1. Requirements
Python: Version 3.10 or higher.

Ollama: Installed and running locally. Pull the inference model before starting:
```
Bash

ollama pull llama3.1
```
2. Environment Initialization
Set up your Python virtual environment and install the required machine learning dependencies.

Windows (Command Prompt / PowerShell):
```
DOS

python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```
macOS / Linux:
```
Bash

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```
---
## ⚡ Running QuadNode

Method 1: Automated Startup (Windows)
Double-click run.bat in the root directory. This automatically launches Ollama, activates the virtual environment, and starts the FastAPI sidecar server on http://127.0.0.1:8000.

Method 2: Manual Terminal Launch
Activate your virtual environment and run the Uvicorn server:
```
Bash

python -m uvicorn backend.main:app --reload
```
## 🔌 API Reference & Usage
1. System Telemetry (`GET /status`)
Returns live metrics on edge memories, cloud synchronization queues, and local privacy quarantines.
```bash
curl [http://127.0.0.1:8000/status](http://127.0.0.1:8000/status)
```

Endpoint: http://127.0.0.1:8000/ingest

Request Payload:
```
JSON

{
  "text": "The frontend architecture for QuadNode is exclusively built using Tauri and React."
}
```

cURL Execution:
```
Bash

curl -X POST "[http://127.0.0.1:8000/ingest](http://127.0.0.1:8000/ingest)" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"The frontend architecture for QuadNode is exclusively built using Tauri and React.\"}"
  ```

Response:
```
JSON

{
  "status": "success",
  "privacy_flagged": false,
  "id": "8f1882c6-5ccb-4555-b019-c589652acaf0",
  "execution_time_ms": 882.52
}
```

2. Query Memory & Chat (POST /chat)
Triggers recall, cross-encoder re-ranking, confidence threshold checks, and local Llama 3.1 inference.

Endpoint: http://127.0.0.1:8000/chat

Request Payload:
```
JSON

{
  "query": "What is the frontend architecture built with?"
}
```
cURL Execution:
```
Bash

curl -X POST "[http://127.0.0.1:8000/sync](http://127.0.0.1:8000/sync)" \
  -H "Content-Type: application/json" \
  -d "{\"query\": \"What is the frontend architecture built with?\"}"
  ```
Response:
```
JSON

{
  "query": "What is the frontend architecture built with?",
  "response": "The frontend architecture for QuadNode is exclusively built using Tauri and React.",
  "sources": [
    "- The frontend architecture is exclusively built using Tauri and React. [Confidence: 0.9998]"
  ],
  "cache_hit": false,
  "execution_time_ms": 1134.49
}
```

---
## 🚀 Future Roadmap
* **Hardware Auto-Tuning**: Dynamic model quantization fallback based on available VRAM.

* **Multi-Modal Memory**: Expanding Qdrant storage to accept image embeddings.

* **Multi-Device Mesh:** Peer-to-peer syncing for distributed edge nodes in zero-connectivity zones.

---
## 🛠️ Troubleshooting Guide

* **`Ollama execution error`**
  Ensure the Ollama application is running on your machine and you have pulled the model using `ollama pull llama3.1`.
* **`ValueError: Dense vector is not found`**
  Your local vector schema is outdated. Delete the `backend/qdrant_storage` directory to clear old database formats, then restart the server.
* **Server crashes on startup (Missing Imports)**
  Ensure your virtual environment is actively running (`venv\Scripts\activate`) and all packages are installed via `pip install -r requirements.txt`.
