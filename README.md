# 🚀 QuadNode: Enterprise-Grade Edge AI Security & Memory Engine

QuadNode is a high-performance, ultra-secure local AI memory architecture built for offline-first environments. It combines high-speed vector embeddings, cross-encoder re-ranking, and zero-shot privacy guardrails to power intelligent agentic workflows entirely on local hardware.

---

## 🏗️ Core Technology Stack

* **Vector Database:** [Qdrant (Local Mode)](https://qdrant.tech/) — For high-speed localized semantic similarity search and vector storage.
* **Embeddings:** `nomic-embed-text-v1.5` (via `fastembed`) — Optimized vectorization running locally.
* **Re-Ranking:** FlashRank (`ms-marco-MiniLM-L-12-v2`) — Stage-2 cross-encoder scoring to eliminate hallucinations and maximize contextual accuracy.
* **Privacy Guardrails:** GLiNER — Zero-shot named entity recognition (NER) to catch and quarantine sensitive credentials, API keys, and passwords before syncing.
* **Inference Engine:** Llama 3.1 (via Ollama) — Local, privacy-first language generation.
* **Performance Layer:** In-memory Semantic Caching for sub-millisecond query responses.
* **Compliance & Auditing:** Cryptographic SHA-256 transaction logging (`audit.log`).

---

## ⚙️ Quick Start Guide (One-Click Setup)

Running QuadNode on your local system is fully automated. Follow these simple steps:

### Prerequisites
1. Ensure [Python 3.10+](https://www.python.org/) is installed.
2. Ensure [Ollama](https://ollama.com/) is installed and the Llama 3.1 model is pulled:
   ```bash
   ollama pull llama3.1