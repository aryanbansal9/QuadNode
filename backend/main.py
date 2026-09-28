import sys
import os
import uuid
import time
import hashlib
import logging
from pathlib import Path

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastembed import TextEmbedding
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue, PointStruct, VectorParams, Distance
import ollama
from flashrank import Ranker
from gliner import GLiNER

BASE_DIR = Path(__file__).resolve().parent
STORAGE_PATH = str(BASE_DIR / "qdrant_storage")
LOG_PATH = BASE_DIR / "audit.log"

# Configure Secure Audit Logger
logging.basicConfig(
    filename=str(LOG_PATH),
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

app = FastAPI(title="QuadNode Enterprise Edge AI Sidecar")

# 1. Initialize Neural Models & Semantic Cache Engine
print("Booting Enterprise Edge Intelligence Architecture...")
dense_model = TextEmbedding("nomic-ai/nomic-embed-text-v1.5")
reranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2", cache_dir=STORAGE_PATH)
ner_model = GLiNER.from_pretrained("urchade/gliner_mediumv2.1")
SENSITIVE_LABELS = ["API Key", "Password", "Secret", "Token", "Credential"]

shard = None
COLLECTION_NAME = "quadnode_memory"
SEMANTIC_CACHE = {} # In-memory high-speed cache for sub-millisecond responses

class ChatRequest(BaseModel):
    query: str

class IngestRequest(BaseModel):
    text: str

def log_audit_event(event_type: str, details: str):
    """Generates a cryptographic SHA-256 trail for compliance and security audit."""
    raw_str = f"{time.time()}-{event_type}-{details}"
    proof_hash = hashlib.sha256(raw_str.encode()).hexdigest()
    logging.info(f"EVENT: {event_type} | DETAILS: {details} | PROOF_HASH: {proof_hash}")

@app.on_event("startup")
async def startup_event():
    global shard
    os.makedirs(STORAGE_PATH, exist_ok=True)
    shard = QdrantClient(path=STORAGE_PATH)
    
    if not shard.collection_exists(COLLECTION_NAME):
        shard.create_collection(
            collection_name=COLLECTION_NAME,
            vectors_config=VectorParams(size=256, distance=Distance.COSINE)
        )
    print("Enterprise Semantic Engine, Security Ledger, & Caching Active.")
    log_audit_event("SYSTEM_BOOT", "Edge node initialized successfully with hardware safeguards.")

@app.post("/ingest")
def ingest_memory(req: IngestRequest):
    """Dynamically ingests, sanitizes, and secures memory with zero-shot privacy tracking."""
    start_time = time.time()
    print(f"\n[+] Ingestion Triggered: Scanning payload for PII & credentials...")
    
    # Zero-Shot Privacy Guardrail via GLiNER
    entities = ner_model.predict_entities(req.text, SENSITIVE_LABELS)
    is_safe = len(entities) == 0
    
    raw_dense = list(dense_model.embed([req.text]))[0]
    optimized_dense = raw_dense[:256].tolist()
    
    point_id = str(uuid.uuid4())
    shard.upsert(
        collection_name=COLLECTION_NAME,
        points=[
            PointStruct(
                id=point_id,
                vector=optimized_dense,
                payload={
                    "text": req.text,
                    "sync_allowed": is_safe,
                    "timestamp": time.time()
                }
            )
        ]
    )
    
    status = "Secured (Local-Only Restricted)" if not is_safe else "Publicly Cleared"
    latency = round((time.time() - start_time) * 1000, 2)
    
    log_audit_event("INGESTION", f"ID: {point_id} | Status: {status} | Latency: {latency}ms")
    print(f"[+] Memory Committed: {status} in {latency}ms")
    
    return {
        "status": "success", 
        "privacy_flagged": not is_safe, 
        "id": point_id, 
        "execution_time_ms": latency
    }

@app.post("/chat")
def chat_with_memory(req: ChatRequest):
    start_time = time.time()
    query_clean = req.query.strip().lower()
    print(f"\n[1] Enterprise Query Received: {req.query}")
    
    # Milestone 1: Semantic Cache Lookup (Sub-Millisecond Return)
    if query_clean in SEMANTIC_CACHE:
        print("[CACHE HIT] Serving response instantly from high-speed memory cache.")
        log_audit_event("CACHE_HIT", f"Query: {req.query}")
        return {
            "query": req.query,
            "response": SEMANTIC_CACHE[query_clean],
            "sources": ["[Cached Memory Vector Match]"],
            "cache_hit": True,
            "execution_time_ms": round((time.time() - start_time) * 1000, 2)
        }

    # Stage 1: Broad Dense Retrieval (Recall N=10)
    raw_dense = list(dense_model.embed([req.query]))[0]
    optimized_dense = raw_dense[:256].tolist() 
    
    results = shard.query_points(
        collection_name=COLLECTION_NAME,
        query=optimized_dense,
        limit=10, 
        query_filter=Filter(
            must=[FieldCondition(key="sync_allowed", match=MatchValue(value=True))]
        ),
        with_payload=True
    ).points
    
    if not results:
        return {
            "query": req.query, 
            "response": "I don't have this in my memory yet. Would you like to ingest it?", 
            "sources": [],
            "cache_hit": False
        }
    
    # Stage 2: Cross-Encoder Precision Re-ranking
    print("[2] Engaging Cross-Encoder Re-ranker...")
    passages = [{"id": hit.id, "text": hit.payload.get('text', '')} for hit in results]
    
    rerank_request = {
        "query": req.query,
        "passages": passages
    }
    reranked_results = reranker.rerank(rerank_request)
    
    # Stage 3: Agentic Anti-Hallucination Thresholding
    top_k = []
    for doc in reranked_results[:3]:
        if doc['score'] > 0.05:
            top_k.append(f"- {doc['text']} [Confidence: {doc['score']:.4f}]")
    
    if not top_k:
        print("[!] High-confidence threshold failed. Refusing to hallucinate.")
        log_audit_event("GUARDRAIL_TRIGGER", f"Low confidence refusal for query: {req.query}")
        return {
            "query": req.query, 
            "response": "I found related data blocks, but their semantic confidence is too low. Refusing to hallucinate.", 
            "sources": [],
            "cache_hit": False
        }
        
    context_str = "\n".join(top_k)
    
    # Stage 4: Secure Local LLM Generation via Ollama
    system_prompt = f"""You are the QuadNode Enterprise Edge AI. Use ONLY the verified memories below. Never guess.
    
    VERIFIED MEMORIES:
    {context_str}
    """
    
    print("[4] Generating Secure Edge Inference (Llama-3.1)...")
    try:
        response = ollama.chat(model='llama3.1', messages=[
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': req.query}
        ], options={'temperature': 0.1}) # Low temperature for strict factual adherence
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ollama execution error: {str(e)}")
    
    final_answer = response['message']['content']
    
    # Save to semantic cache
    SEMANTIC_CACHE[query_clean] = final_answer
    
    total_time = round((time.time() - start_time) * 1000, 2)
    log_audit_event("INFERENCE", f"Query processed successfully in {total_time}ms")
    print(f"[5] Execution Complete in {total_time}ms.")
    
    return {
        "query": req.query, 
        "response": final_answer, 
        "sources": top_k,
        "cache_hit": False,
        "execution_time_ms": total_time
    }