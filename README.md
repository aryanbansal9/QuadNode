# 🧠 QuadNode: Enterprise-Grade Edge AI Security & Memory Engine

**AI That Remembers Where It Operates.**

QuadNode is an offline-first Edge AI memory platform that allows intelligent systems to ingest, protect, remember, and reason over data locally—and synchronize with a global cloud only when safe and connected. 

Built for environments where cloud connectivity is unreliable (industrial facilities, disaster response, remote infrastructure) or where data privacy is paramount, QuadNode ensures AI never loses its context when the network goes dark.

---

## 🔥 Core Technical Features

*   **Federated Hybrid Retrieval:** Simultaneously queries local Qdrant Edge and AWS Qdrant Cloud databases. Combines Nomic dense embeddings with BM25 sparse search, merges results via Reciprocal Rank Fusion (RRF), and deduplicates in real-time.
*   **Cross-Encoder Reranking:** Passes fused vector results through a local `FlashRank` cross-encoder to guarantee the absolute highest-relevance context window for the LLM.
*   **Fail-Closed Privacy Gate:** Uses `GLiNER` (Zero-shot NLP) to scan all incoming documents for PII and credentials. Sensitive chunks are permanently tagged as `LOCAL_ONLY` and physically blocked from outbound cloud sync queues.
*   **Self-Healing Local LLM:** Contextual reasoning is executed strictly on-device using Ollama (Llama 3.1/3.2). Features an automatic "Extractive Fallback" mechanism that synthesizes raw vector text if the LLM encounters a hardware fault.
*   **Deterministic 3-Way Synchronization:** Tracks vector edits via `version` and `synced_version` states. Handles multi-device collisions with a dedicated UI for `keep_local`, `keep_remote`, or `keep_both` resolution strategies.
*   **Matryoshka Vector Truncation:** Compresses 768-dimensional embeddings down to 256 dimensions, slashing edge storage and RAM usage by 66% while preserving semantic accuracy.

---

## 🏗️ System Architecture

QuadNode operates on a strict **Edge-First** pipeline. The cloud is a synchronization partner, not a single point of failure.

```text
              ┌─────────────────────────────────┐
              │          USER DOCUMENT          │
              └────────────────┬────────────────┘
                               ▼
              ┌─────────────────────────────────┐
              │ GLiNER ZERO-SHOT PRIVACY FILTER │
              └────────┬───────────────┬────────┘
                       │               │
                 [Sensitive]      [Safe Data]
                       │               │
                       ▼               ▼
                 LOCAL_ONLY         PENDING ──────────┐
                       │               │              │ (When Online)
              ┌────────▼───────────────▼────────┐     ▼
              │   QDRANT EDGE (Local Storage)   │   AWS QDRANT CLOUD
              └────────┬────────────────────────┘     ▲
                       │                              │
              ┌────────▼──────────────────────────────┴─┐
              │      FEDERATED HYBRID RETRIEVAL         │
              │   (Dense + Sparse + RRF + FlashRank)    │
              └────────┬────────────────────────────────┘
                       ▼
              ┌─────────────────────────────────┐
              │     OLLAMA LOCAL LLM (RAG)      │
              └────────┬────────────────────────┘
                       ▼
                 GROUNDED ANSWER
```                 

### Tech Stack
| Component | Technology |
| :--- | :--- |
| **Frontend Console** | React, Vite, Tailwind CSS, Recharts |
| **Backend API** | Python, FastAPI |
| **Vector Storage (Edge & Cloud)**| Qdrant |
| **Embeddings** | FastEmbed (`nomic-embed-text-v1.5`) |
| **Reranking** | FlashRank |
| **Entity/Privacy Detection** | GLiNER |
| **Local LLM Engine** | Ollama (`Llama 3.1` / `3.2 3B`) |

🚀 Getting Started
1. Backend Setup (FastAPI Engine)
Ensure you have Python 3.13+ and Ollama installed on your machine.

```bash
# Clone the repository
git clone https://github.com/aryanbansal9/QuadNode.git
cd QuadNode

# Install dependencies
pip install -r requirements.txt
pip install qdrant-client ollama flashrank

# Start Ollama and pull the default model
ollama serve
ollama pull llama3.2:3b  # Or llama3.1 if you have >= 6GB VRAM
```

Environment Variables:
Create a .env file in the root of the backend folder to connect to the global sync cluster:

```
QDRANT_URL=your_aws_qdrant_cloud_url
QDRANT_API_KEY=your_qdrant_api_key
```

Start the Edge Server:

```bash
python -m uvicorn backend.main:app --port 8000
```

2. Frontend Setup (React UI)
Open a new terminal window to start the Edge Intelligence Console.

```bash
# Navigate to the frontend directory
cd QuadNode-frontend

# Install dependencies
npm install
```

**Environment Variables:**
Create a `.env` file in the `QuadNode-frontend` directory:
```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_USE_MOCK=false
```

**Start the Console:**
```bash
npm run dev
```

## 🧪 Hackathon Jury Demo Flow
To demonstrate the full power of QuadNode to the judges, follow this sequence:

1. **Ingestion & Privacy Guard:** Go to the **Documents** tab. Drag and drop a `.txt` file containing a fake AWS root key. Watch the GLiNER filter instantly quarantine the document as `LOCAL_ONLY`.
2. **Federated Search:** Go to the **Search** tab. Search for a concept. Show how the results display exact Semantic, Keyword, and FlashRank cross-encoder confidence scores.
3. **Local AI Reasoning:** Go to the **AI Assistant** tab. Ask a question about the document you just uploaded. The Llama model will answer locally and cite the exact source document.
4. **The "Drop Network" Test:** Click the **Simulate cloud offline** button in the top navigation. Go back to the Assistant and ask another question. Prove that the LLM and vector retrieval still function perfectly without the internet.
5. **Edge-to-Cloud Sync:** Restore the connection. Go to the **Synchronization** tab. Click **Sync Now**. Watch the `PENDING` safe vectors push to AWS Qdrant Cloud, while the `LOCAL_ONLY` secrets remain safely trapped on the edge device.