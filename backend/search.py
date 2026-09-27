from pathlib import Path
from fastembed import TextEmbedding
from qdrant_edge import EdgeShard, QueryRequest, Query

BASE_DIR = Path(__file__).parent
STORAGE_PATH = str(BASE_DIR / "qdrant_storage")

print("1. Loading AI Embedding Model...")
dense_model = TextEmbedding("nomic-ai/nomic-embed-text-v1.5")

print("2. Connecting to Local Memory Engine...")
shard = EdgeShard.load(STORAGE_PATH)

def search_memory(query_text: str):
    print(f"\n========================================")
    print(f"🔍 QUERY: '{query_text}'")
    
    # 1. Embed the query
    raw_dense = list(dense_model.embed([query_text]))[0]
    optimized_dense = raw_dense[:256].tolist() 
    
    # 2. The Official, Stable Qdrant Edge Syntax
    request = QueryRequest(
        query=Query.Nearest(optimized_dense, using="dense"),
        limit=2,
        with_payload=True
    )
    
    # Execute the query flawlessly
    results = shard.query(request)
    
    # 3. Display Results
    print("========================================")
    
    # FIX: Loop over the results list directly!
    for idx, hit in enumerate(results):
        print(f"\n--- Result {idx+1} (Match Score: {hit.score:.4f}) ---")
        print(f"Text: {hit.payload['text']}")
        
        if not hit.payload.get('sync_allowed', True):
            print("🛡️ STATUS: SECURE LOCAL-ONLY (Will not sync to cloud)")
        else:
            print("☁️ STATUS: SYNC ENABLED")

if __name__ == "__main__":
    search_memory("What frontend technologies are powering this app?")
    search_memory("Did anyone save the AWS credentials?")