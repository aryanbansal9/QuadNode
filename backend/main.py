from fastapi import FastAPI
import os
from pathlib import Path
from qdrant_edge import EdgeShard, EdgeConfig, EdgeVectorParams, EdgeSparseVectorParams, Distance, Modifier

app = FastAPI(title="QuadNode Edge AI Sidecar")

BASE_DIR = Path(__file__).parent
STORAGE_PATH = str(BASE_DIR / "qdrant_storage")

shard = None

@app.on_event("startup")
async def startup_event():
    global shard
    print("Initializing Qdrant Edge Memory...")
    
    if not os.path.exists(STORAGE_PATH):
        print("Creating new EdgeShard with Hybrid Search capabilities...")
        
        os.makedirs(STORAGE_PATH, exist_ok=True)
        
        shard = EdgeShard.create(
            STORAGE_PATH,
            EdgeConfig(
                vectors={
                    "dense": EdgeVectorParams(size=256, distance=Distance.Cosine)
                },
                sparse_vectors={
                    "sparse": EdgeSparseVectorParams(modifier=Modifier.Idf)
                }
            )
        )
    else:
        print("Loading existing EdgeShard...")
        shard = EdgeShard.load(STORAGE_PATH)
        
    print("Semantic Memory Engine Online. Zero-latency retrieval enabled.")

@app.get("/health")
def health_check():
    return {"status": "active", "memory_engine": "Qdrant Edge connected"}