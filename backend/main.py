from fastapi import FastAPI
from pydantic import BaseModel
from pathlib import Path
from fastembed import TextEmbedding
from qdrant_edge import EdgeShard, QueryRequest, Query
import ollama
import os

app = FastAPI(title="QuadNode Edge AI Sidecar")

BASE_DIR = Path(__file__).parent
STORAGE_PATH = str(BASE_DIR / "qdrant_storage")

print("Booting Edge Intelligence Architecture...")
dense_model = TextEmbedding("nomic-ai/nomic-embed-text-v1.5")
shard = None

class ChatRequest(BaseModel):
    query: str

@app.on_event("startup")
async def startup_event():
    global shard
    os.makedirs(STORAGE_PATH, exist_ok=True)
    shard = EdgeShard.load(STORAGE_PATH)
    print("Semantic Memory Engine Online.")

@app.post("/chat")
def chat_with_memory(req: ChatRequest):
    print(f"\n[1] User Query Received: {req.query}")
    
    # 1. Retrieve Semantic Memories
    raw_dense = list(dense_model.embed([req.query]))[0]
    optimized_dense = raw_dense[:256].tolist() 
    
    search_req = QueryRequest(
        query=Query.Nearest(optimized_dense, using="dense"),
        limit=2,
        with_payload=True
    )
    
    results = shard.query(search_req)
    hits = results[0] if isinstance(results, list) else getattr(results, "result", getattr(results, "hits", results))
    
    # 2. Assemble Context (Excluding highly sensitive data if needed, but here we feed it to the local LLM safely)
    context_blocks = []
    for hit in hits:
        context_blocks.append(f"- {hit.payload['text']}")
    
    context_str = "\n".join(context_blocks)
    print(f"[2] Context Retrieved:\n{context_str}")
    
    # 3. Prompt the Local LLM
    system_prompt = f"""You are the QuadNode Edge AI. Use the following retrieved memories to answer the user. 
    If the answer isn't in the memories, say you don't know.
    
    MEMORIES:
    {context_str}
    """
    
    print("[3] Generating Response via Llama-3.1 on RTX 4060...")
    response = ollama.chat(model='llama3.1', messages=[
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': req.query}
    ])
    
    final_answer = response['message']['content']
    print(f"[4] AI Response: {final_answer}")
    
    return {"query": req.query, "response": final_answer, "sources": context_blocks}