import os
from pathlib import Path
from fastembed import TextEmbedding, SparseTextEmbedding
from gliner import GLiNER
from qdrant_edge import EdgeShard, Point, UpdateOperation, SparseVector

BASE_DIR = Path(__file__).parent
STORAGE_PATH = str(BASE_DIR / "qdrant_storage")

print("1. Loading AI Models into System CPU RAM...")
# Matryoshka Dense Embedder (Truncates to 256 dimensions to save RAM)
dense_model = TextEmbedding("nomic-ai/nomic-embed-text-v1.5")

# BM25 Sparse Embedder for exact keyword matching
sparse_model = SparseTextEmbedding("Qdrant/bm25")

# GLiNER for zero-shot privacy detection
privacy_model = GLiNER.from_pretrained("urchade/gliner_small-v2.1")

# Load our local EdgeShard memory
print("2. Connecting to local Qdrant EdgeShard...")
shard = EdgeShard.load(STORAGE_PATH)

def process_and_store(doc_id: int, text: str):
    print(f"\nProcessing Document {doc_id}...")
    
    # --- PRIVACY ROUTING ---
    labels = ["password", "api key", "secret", "confidential"]
    entities = privacy_model.predict_entities(text, labels)
    
    sync_allowed = len(entities) == 0
    
    if not sync_allowed:
        print(f"🔒 SENSITIVE DATA DETECTED: {[e['text'] for e in entities]}. Tagging for Local-Only storage.")
    else:
        print(f"✅ Safe for edge-to-cloud synchronization.")

    # --- HYBRID EMBEDDINGS ---
    raw_dense = list(dense_model.embed([text]))[0]
    optimized_dense = raw_dense[:256].tolist() 
    
    sparse_result = list(sparse_model.embed([text]))[0]
    
    # --- LOCAL MEMORY INSERTION ---
    point = Point(
        id=doc_id,
        vector={
            "dense": optimized_dense,
            "sparse": SparseVector(
                indices=sparse_result.indices.tolist(), 
                values=sparse_result.values.tolist()
            )
        },
        payload={
            "text": text,
            "sync_allowed": sync_allowed
        }
    )
    
    shard.update(UpdateOperation.upsert_points([point]))
    print(f"Successfully inserted into Qdrant Edge.")

if __name__ == "__main__":
    process_and_store(1, "The new UI components for QuadNode are built with React and Tauri.")
    process_and_store(2, "AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE. Do not commit this to GitHub.")