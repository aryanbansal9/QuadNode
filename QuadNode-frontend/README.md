🧠 QuadNode

AI That Remembers Where It Operates.

An offline-first Edge AI memory and intelligence platform designed to keep AI useful, private, and operational even when cloud connectivity disappears.








🚨 The Problem

Modern AI systems increasingly depend on cloud infrastructure.

But many real-world environments cannot guarantee continuous connectivity.

Think about:

🏭 Industrial facilities

🚆 Railway infrastructure

🚑 Disaster-response environments

⛏️ Mining operations

🌾 Remote agriculture

🏥 Field healthcare

🚁 Emergency operations

When the network disappears, a cloud-dependent AI system can lose access to historical information, semantic memory, previous observations, operational context, and AI reasoning capabilities.

This creates a fundamental problem:

What happens when the AI loses the cloud but still needs its memory?

💡 The QuadNode Solution

QuadNode moves intelligent memory closer to where the data is generated.

Instead of forcing every interaction through a remote cloud service, QuadNode maintains an Edge Memory Layer capable of:

Receiving information locally

Detecting sensitive information

Generating semantic embeddings

Storing memories in a local vector database

Searching memories semantically

Re-ranking relevant information

Passing retrieved context to a local LLM

Continuing AI conversations without cloud connectivity

Synchronizing eligible memories when connectivity returns

Core Philosophy

CLOUD CONNECTIVITY IS OPTIONAL.
MEMORY IS NOT.

🧠 What Makes QuadNode Different?

QuadNode combines several components into a single edge intelligence pipeline.

                 ┌──────────────────────┐
                 │       User / AI      │
                 └──────────┬───────────┘
                            │
                            ▼
                 ┌──────────────────────┐
                 │    QuadNode Edge     │
                 │    Intelligence      │
                 └──────────┬───────────┘
                            │
            ┌───────────────┼────────────────┐
            │               │                │
            ▼               ▼                ▼
      Privacy Scan     Vector Memory    Local AI
        GLiNER           Qdrant         Ollama
            │               │                │
            └───────────────┼────────────────┘
                            │
                            ▼
                    Semantic Retrieval
                            │
                            ▼
                     AI Reasoning
                            │
                            ▼
                     Local Response
                            │
                     ┌──────┴──────┐
                     │             │
                  Offline        Online
                     │             │
                     ▼             ▼
                Keep Local     Synchronize
                                Eligible
                                Memories

🏗️ System Architecture

QuadNode consists of two primary layers.

1. Edge Intelligence Layer

Runs locally on the machine/device.

Responsibilities:

Memory ingestion

Privacy classification

Embedding generation

Vector storage

Semantic retrieval

Re-ranking

Local LLM reasoning

Offline operation

Audit logging

Technologies

Component

Technology

API

FastAPI

Embeddings

FastEmbed

Embedding Model

nomic-embed-text-v1.5

Vector Database

Qdrant

Re-ranking

FlashRank

Entity Detection

GLiNER

Local LLM

Ollama

Language

Python

☁️ Cloud Synchronization Layer

QuadNode maintains a second Qdrant store representing the cloud synchronization layer.

Edge Qdrant
     │
     │  Pending memories
     ▼
Sync Engine
     │
     │  When connectivity returns
     ▼
Cloud Qdrant

Implementation note: The current hackathon implementation uses a local Qdrant instance as a simulated cloud environment. This allows the complete synchronization workflow to be demonstrated without requiring an external Qdrant Cloud deployment.

🔄 Complete Memory Flow

Step 1 — User Creates a Memory

A user submits information through the Memory interface.

Example:

"The maintenance team replaced the cooling pump
after detecting abnormal vibration."

The frontend sends:

POST /ingest

Step 2 — Privacy Analysis

Before storing the memory, QuadNode analyzes the content using GLiNER.

User Memory
     │
     ▼
GLiNER Privacy Scan
     │
     ├── Sensitive → LOCAL_ONLY
     │
     └── Non-sensitive → PENDING

Step 3 — Generate Semantic Embedding

The memory is converted into a vector representation using:

nomic-embed-text-v1.5

The current implementation uses a 256-dimensional vector representation.

This means QuadNode does not only store text. It stores the semantic representation of the information.

For example:

"Pump overheating during night shift"

can be retrieved by a query such as:

"Previous incidents involving high temperature"

even if the exact words are different.

Step 4 — Store in Edge Memory

The resulting vector and metadata are stored in the local Qdrant collection:

quadnode_memory

Each memory carries metadata such as:

text
source
timestamp
sync_status

A newly created memory can therefore enter the system as:

PENDING

or:

LOCAL_ONLY

Step 5 — Semantic Search

When the user asks the AI a question:

POST /chat

QuadNode first converts the query into an embedding and searches the Edge Qdrant database for semantically relevant memories.

Step 6 — Re-ranking

Initial vector search provides candidate memories.

QuadNode then uses:

FlashRank

to re-rank those candidates.

Query
  │
  ▼
Vector Search
  │
  ▼
Candidate Memories
  │
  ▼
FlashRank
  │
  ▼
Most Relevant Memories

Step 7 — Local AI Reasoning

The retrieved memories are passed to a local LLM through Ollama.

Current implementation:

Ollama
└── llama3.1

The LLM receives:

User Question
+
Retrieved Edge Memories

and generates the final response.

Step 8 — The Cloud Can Disappear

This is the core QuadNode demonstration.

              INTERNET
                  │
            ❌ CONNECTION
                  │
                  X
                  │
        ┌─────────▼─────────┐
        │    EDGE DEVICE    │
        │                   │
        │ Local Qdrant      │
        │ Local Embeddings  │
        │ Local Retrieval   │
        │ Local LLM         │
        └───────────────────┘
                  │
                  ▼
             AI STILL WORKS

When the cloud disappears, QuadNode doesn't forget.

Step 9 — Connectivity Returns

Once connectivity is restored, memories marked as:

PENDING

can be synchronized.

The frontend triggers:

POST /sync

Result:

PENDING
   │
   │ Sync
   ▼
SYNCED

🔐 Privacy-Aware Synchronization

Not every memory needs to leave the edge.

QuadNode distinguishes between:

LOCAL_ONLY

and:

PENDING

                 MEMORY
                    │
             Privacy Analysis
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
      LOCAL_ONLY           PENDING
          │                   │
          ▼                   ▼
    Stay on Edge        Eligible for Sync

📊 QuadNode Dashboard

The frontend provides an Edge Intelligence Console for monitoring:

Edge memory count

Cloud memory count

Pending synchronization

Local-only secured memories

AI cache information

Connection state

System activity

💬 AI Assistant

The Assistant interface provides conversational access to the Edge Memory Engine.

Example questions:

What maintenance issues have we recorded?

Have we seen similar failures before?

What happened during the previous inspection?

Which equipment problems occurred recently?

The retrieval pipeline is:

Question
   ↓
Embedding
   ↓
Edge Vector Search
   ↓
Re-ranking
   ↓
Relevant Memories
   ↓
Local LLM
   ↓
Answer

🧠 Memory Explorer

The Memory interface allows users to:

Create memories

View stored memories

Inspect synchronization state

Understand what information exists locally

Track newly ingested information

🔎 Search

QuadNode provides semantic search over stored memory.

Instead of relying only on exact keyword matching:

"pump failure"

the system can retrieve conceptually related memories involving:

cooling system
abnormal vibration
maintenance
overheating
equipment failure

🔄 Synchronization Console

The synchronization interface visualizes the Edge ↔ Cloud relationship.

EDGE MEMORY

Memory A     SYNCED
Memory B     SYNCED
Memory C     PENDING
Memory D     LOCAL_ONLY

⚔️ Conflict Handling

QuadNode's architecture is designed around the idea that distributed memories can eventually evolve independently.

The frontend contains a Conflict Resolution experience.

Current implementation note: The hackathon frontend presents demonstration conflict data rather than claiming a complete distributed conflict-resolution engine.

🕒 Timeline

The Timeline interface provides a chronological view of memory activity and system operations.

It helps answer:

What happened?
When did it happen?
Was it created locally?
Was it synchronized?

🖥️ Device & System View

QuadNode treats the machine running the system as an Edge intelligence node.

Intelligence doesn't have to live in the cloud.

🎨 Product Interface

QuadNode's frontend is designed as a modern Edge AI operations console.

Design Principles

Dark + Light themes

Responsive layout

High information density

Clear system status

Motion and micro-interactions

Edge/cloud state visualization

Semantic memory visualization

Modern data dashboards

The product includes:

Landing Page
      ↓
Edge Intelligence Console
      ↓
 ┌───────────────┐
 │ Dashboard     │
 │ Assistant     │
 │ Memory        │
 │ Search        │
 │ Documents     │
 │ Synchronize   │
 │ Conflicts     │
 │ Timeline      │
 │ Devices       │
 │ Settings      │
 └───────────────┘

🌐 Frontend Architecture

React
 │
 ├── Pages
 │    ├── Landing
 │    ├── Dashboard
 │    ├── Assistant
 │    ├── Memory
 │    ├── Search
 │    ├── Documents
 │    ├── Sync
 │    ├── Conflicts
 │    ├── Timeline
 │    ├── Devices
 │    └── Settings
 │
 ├── Components
 ├── Context
 │    └── Connection State
 ├── API Layer
 │    └── Backend Services
 └── Utilities

Frontend Stack

React

Vite

Tailwind CSS

React Router

Axios

Lucide Icons

⚙️ Backend API

Endpoint

Method

Purpose

/status

GET

Edge/cloud system status

/ingest

POST

Add a new memory

/chat

POST

Query Edge memory + local AI

/sync

POST

Synchronize pending memories

/memories

GET

Retrieve stored memories

📡 API Flow

Memory Ingestion

POST /ingest

Frontend
   ↓
FastAPI
   ↓
Privacy Scan
   ↓
Embedding
   ↓
Edge Qdrant

AI Query

POST /chat

Frontend
   ↓
FastAPI
   ↓
Query Embedding
   ↓
Qdrant Retrieval
   ↓
FlashRank
   ↓
Ollama
   ↓
AI Response
   ↓
Frontend

Synchronization

POST /sync

Frontend
   ↓
FastAPI
   ↓
Pending Memories
   ↓
Cloud Qdrant Simulation
   ↓
Update Sync State

📁 Project Structure

QuadNode-Hackathon/
│
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── context/
│   │   ├── data/
│   │   ├── pages/
│   │   └── utils/
│   ├── public/
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
│
└── backend/
    └── backend/
        ├── main.py
        ├── ingest.py
        ├── search.py
        ├── requirements.txt
        ├── qdrant_edge/
        ├── qdrant_cloud_sim/
        └── audit.log

🚀 Getting Started

Prerequisites

Install:

Python 3.13+

Node.js

npm

Ollama

Frontend

git clone https://github.com/codemasteryash/quadnode-frontend.git
cd quadnode-frontend
npm install

Create .env:

VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_USE_MOCK=false

Start:

npm run dev

Backend

Clone:

git clone https://github.com/aryanbansal9/QuadNode.git
cd QuadNode

Install:

pip install -r requirements.txt
pip install qdrant-client ollama flashrank

Start Ollama:

ollama serve

Pull the model if needed:

ollama pull llama3.1

Start FastAPI:

python -m uvicorn backend.main:app --reload

Backend runs at:

http://127.0.0.1:8000

🧪 Hackathon Demo Flow

1. Open Landing Page
          ↓
2. Launch Edge Console
          ↓
3. Create a Memory
          ↓
4. Memory becomes PENDING
          ↓
5. Ask AI about the memory
          ↓
6. AI retrieves local memory
          ↓
7. Simulate Cloud OFFLINE
          ↓
8. Ask AI again
          ↓
9. AI STILL WORKS locally
          ↓
10. Restore connectivity
          ↓
11. Run SYNC
          ↓
12. PENDING → SYNCED

Final lifecycle

CREATE
   ↓
PRIVACY SCAN
   ↓
EMBED
   ↓
EDGE MEMORY
   ↓
PENDING
   ↓
CLOUD UNAVAILABLE
   ↓
LOCAL AI CONTINUES
   ↓
CONNECTIVITY RESTORED
   ↓
SYNC
   ↓
SYNCED

🔐 Security & Privacy Philosophy

QuadNode follows an Edge-first approach.

DATA
 │
 ▼
EDGE
 │
 ├── Sensitive
 │      ↓
 │  Stay Local
 │
 └── Eligible
        ↓
      Sync

The backend also maintains an audit log using SHA-256-based logging for system operations.

🔮 Future Roadmap

Potential extensions include:

☁️ Real Cloud Deployment

Replace the local cloud simulation with a real remote Qdrant deployment.

📱 Multi-Device Edge Network

Allow multiple Edge nodes to exchange memories.

🧠 Advanced Conflict Resolution

Support richer conflict detection and resolution for independently modified memories.

🔐 Hardware-Backed Security

Integrate TPM or secure-enclave capabilities for sensitive deployments.

📡 Intermittent Connectivity Optimization

Optimize synchronization for extremely unreliable networks.

🧠 More Advanced Local Models

Support specialized local models depending on deployment requirements.

🎯 Target Applications

QuadNode can be adapted to environments where connectivity is unreliable or sensitive information should remain local.

🏭 Industrial Maintenance

🚆 Railway Infrastructure

🚑 Disaster Response

⛏️ Mining

🌾 Smart Agriculture

🏥 Field Healthcare

🧠 Core Design Principle

Traditional architecture:

             CLOUD
               │
               ▼
        ┌─────────────┐
        │ AI + Memory │
        └─────────────┘
               ▲
               │
             Network
               ▲
               │
             Device

QuadNode:

             CLOUD
               ▲
               │
          Synchronization
               │
               ▼
       ┌─────────────────┐
       │   EDGE NODE     │
       │                 │
       │ Memory          │
       │ Retrieval       │
       │ Privacy         │
       │ AI Reasoning    │
       └─────────────────┘
               │
               ▼
              USER

The cloud becomes a synchronization partner, rather than a single point of dependency for every interaction.

🏆 Why QuadNode?

AI systems shouldn't become useless simply because the network disappears.

QuadNode provides a different model:

              ┌─────────────────┐
              │     QUADNODE    │
              └────────┬────────┘
                       │
       ┌───────────────┼───────────────┐
       │               │               │
       ▼               ▼               ▼
   REMEMBER         REASON          PROTECT
       │               │               │
       ▼               ▼               ▼
   Edge Memory      Local AI       Privacy
       │               │               │
       └───────────────┼───────────────┘
                       │
                       ▼
                 SYNCHRONIZE
                 WHEN ONLINE

Cloud-connected when possible.

Edge-intelligent when necessary.

Private by design.

👥 Team

Built as a hackathon project focused on bringing AI memory and reasoning to the edge.

Contributors

Yash Gupta — Frontend Engineering, UI/UX, Edge Intelligence Console

Aryan Bansal — Backend / Edge AI Architecture

📜 License

This project is developed as a hackathon prototype.

⭐ QuadNode in One Sentence

QuadNode is an offline-first Edge AI memory platform that lets intelligent systems remember, retrieve, and reason locally — and synchronize with the cloud when connectivity returns.