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
LOG_PATH = BASE_DIR / "audit.log"

logging.basicConfig(
    filename=str(LOG_PATH), level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)

app = FastAPI(title="QuadNode Apex Edge Intelligence")

# 1. Initialize Neural Models
print("Booting QuadNode Apex Architecture...")
dense_model = TextEmbedding("nomic-ai/nomic-embed-text-v1.5")
reranker = Ranker(model_name="ms-marco-MiniLM-L-12-v2", cache_dir=str(BASE_DIR / "qdrant_storage"))
ner_model = GLiNER.from_pretrained("urchade/gliner_mediumv2.1")
SENSITIVE_LABELS = ["API Key", "Password", "Secret", "Token", "Credential", "PII"]

# 2. Dual-Database Architecture (Edge vs Cloud Simulation)
EDGE_DB_PATH = str(BASE_DIR / "qdrant_edge")
CLOUD_DB_PATH = str(BASE_DIR / "qdrant_cloud_sim")
COLLECTION_NAME = "quadnode_memory"

os.makedirs(EDGE_DB_PATH, exist_ok=True)
os.makedirs(CLOUD_DB_PATH, exist_ok=True)

edge_db = QdrantClient(path=EDGE_DB_PATH)
cloud_db = QdrantClient(path=CLOUD_DB_PATH) # Simulates central server for hackathon demo

SEMANTIC_CACHE = {}

class ChatRequest(BaseModel):
    query: str

class IngestRequest(BaseModel):
    text: str
    source: str = "manual_entry"

class RerankPayload:
    def __init__(self, query, passages):
        self.query = query
        self.passages = passages

def log_audit(event_type: str, details: str):
    proof_hash = hashlib.sha256(f"{time.time()}-{event_type}-{details}".encode()).hexdigest()
    logging.info(f"EVENT: {event_type} | DETAILS: {details} | HASH: {proof_hash}")

@app.on_event("startup")
async def startup_event():
    for db in [edge_db, cloud_db]:
        if not db.collection_exists(COLLECTION_NAME):
            db.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=VectorParams(size=256, distance=Distance.COSINE)
            )
    print("Edge Database, Cloud Server (Simulated), & AI Pipeline Online.")

@app.get("/status")
def system_status():
    """Provides live telemetry for the React Frontend Dashboard."""
    edge_count = edge_db.count(collection_name=COLLECTION_NAME).count
    cloud_count = cloud_db.count(collection_name=COLLECTION_NAME).count
    
    pending = edge_db.count(collection_name=COLLECTION_NAME, count_filter=Filter(
        must=[FieldCondition(key="sync_status", match=MatchValue(value="PENDING"))]
    )).count
    
    local_only = edge_db.count(collection_name=COLLECTION_NAME, count_filter=Filter(
        must=[FieldCondition(key="sync_status", match=MatchValue(value="LOCAL_ONLY"))]
    )).count

    return {
        "status": "ONLINE",
        "edge_memories": edge_count,
        "cloud_memories": cloud_count,
        "pending_sync": pending,
        "local_only_secured": local_only,
        "cache_size": len(SEMANTIC_CACHE)
    }

@app.post("/ingest")
def ingest_memory(req: IngestRequest):
    """Creates local memory with rich metadata and Edge-to-Cloud routing logic."""
    print(f"\n[+] Ingesting: Scanning for privacy risks...")
    
    # Zero-Shot Privacy Guardrail
    entities = ner_model.predict_entities(req.text, SENSITIVE_LABELS)
    sync_status = "LOCAL_ONLY" if entities else "PENDING"
    
    optimized_dense = list(dense_model.embed([req.text]))[0][:256].tolist()
    point_id = str(uuid.uuid4())
    
    payload = {
        "text": req.text,
        "source": req.source,
        "sync_status": sync_status,
        "timestamp": time.time()
    }
    
    edge_db.upsert(
        collection_name=COLLECTION_NAME,
        points=[PointStruct(id=point_id, vector=optimized_dense, payload=payload)]
    )
    
    log_audit("INGESTION", f"ID: {point_id} | Status: {sync_status}")
    print(f"[+] Memory Committed. State: {sync_status}")
    return {"status": "success", "id": point_id, "sync_state": sync_status}

@app.post("/sync")
def synchronize_edge_to_cloud():
    """Simulates internet restoration: Pushes PENDING data to Cloud, locks LOCAL_ONLY."""
    print("\n[~] Internet Connection Detected. Initiating Edge-to-Cloud Sync...")
    
    pending_points = edge_db.scroll(
        collection_name=COLLECTION_NAME,
        scroll_filter=Filter(must=[FieldCondition(key="sync_status", match=MatchValue(value="PENDING"))]),
        limit=100,
        with_payload=True,
        with_vectors=True
    )[0]
    
    if not pending_points:
        return {"status": "success", "synced_count": 0, "message": "All edge data is fully synchronized."}
    
    synced_ids = []
    for point in pending_points:
        # Push to Cloud DB
        cloud_db.upsert(
            collection_name=COLLECTION_NAME,
            points=[PointStruct(id=point.id, vector=point.vector, payload=point.payload)]
        )
        
        # Update Local Edge DB to SYNCED
        updated_payload = point.payload.copy()
        updated_payload["sync_status"] = "SYNCED"
        edge_db.set_payload(collection_name=COLLECTION_NAME, payload=updated_payload, points=[point.id])
        synced_ids.append(point.id)
        log_audit("CLOUD_SYNC", f"Successfully federated memory ID: {point.id}")

    print(f"[~] Sync Complete. {len(synced_ids)} memories pushed to cloud.")
    return {"status": "success", "synced_count": len(synced_ids), "synced_ids": synced_ids}

@app.post("/chat")
def chat_with_memory(req: ChatRequest):
    """Retrieves context from Edge DB (Allows reading LOCAL_ONLY for local intelligence)."""
    start_time = time.time()
    query_clean = req.query.strip().lower()
    
    if query_clean in SEMANTIC_CACHE:
        return {"response": SEMANTIC_CACHE[query_clean], "cache_hit": True, "time_ms": round((time.time() - start_time) * 1000, 2)}

    optimized_dense = list(dense_model.embed([req.query]))[0][:256].tolist() 
    
    # Notice: NO FILTER. The local AI can read all data (SYNCED, PENDING, and LOCAL_ONLY).
    results = edge_db.query_points(
        collection_name=COLLECTION_NAME,
        query=optimized_dense,
        limit=10, 
        with_payload=True
    ).points
    
    if not results:
        return {"response": "I have no memory regarding this on the edge device.", "sources": []}
    
    passages = [{"id": hit.id, "text": hit.payload.get('text', '')} for hit in results]
    reranked_results = reranker.rerank(RerankPayload(query=req.query, passages=passages))
    
    top_k = [f"- {doc['text']} [Confidence: {doc['score']:.4f}]" for doc in reranked_results[:3] if doc['score'] > 0.05]
    
    if not top_k:
        return {"response": "Context found, but confidence too low to answer securely.", "sources": []}
        
    system_prompt = f"You are an offline Edge AI. Use ONLY these verified local memories:\n{chr(10).join(top_k)}"
    
    response = ollama.chat(model='llama3.1', messages=[
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': req.query}
    ], options={'temperature': 0.1})
    
    final_answer = response['message']['content']
    SEMANTIC_CACHE[query_clean] = final_answer
    
    log_audit("INFERENCE", f"Edge reasoning completed in {round((time.time() - start_time) * 1000, 2)}ms")
    return {
        "response": final_answer, 
        "sources": top_k,
        "cache_hit": False,
        "time_ms": round((time.time() - start_time) * 1000, 2)
    }