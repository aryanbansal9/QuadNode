import sys
import os
from pathlib import Path

from fastapi import FastAPI
from pydantic import BaseModel
from fastembed import TextEmbedding
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
import ollama

BASE_DIR = Path(__file__).resolve().parent
STORAGE_PATH = str(BASE_DIR / "qdrant_storage")

app = FastAPI(title="QuadNode Edge AI Sidecar")

print("Booting Edge Intelligence Architecture...")
dense_model = TextEmbedding("nomic-ai/nomic-embed-text-v1.5")

shard = None

class ChatRequest(BaseModel):
    query: str

@app.on_event("startup")
async def startup_event():
    global shard
    os.makedirs(STORAGE_PATH, exist_ok=True)
    shard = QdrantClient(path=STORAGE_PATH)
    print("Semantic Memory Engine Online.")

@app.post("/chat")
def chat_with_memory(req: ChatRequest):
    print(f"\n[1] User Query Received: {req.query}")
    
    # 1. Retrieve Semantic Memories
    raw_dense = list(dense_model.embed([req.query]))[0]
    optimized_dense = raw_dense[:256].tolist() 
    
    # Dynamically grab your collection name so we don't need hardcoded configs
    collections = shard.get_collections().collections
    if not collections:
        return {"query": req.query, "response": "Database empty.", "sources": []}
    
    collection_name = collections[0].name
    
    # Native Qdrant Search with Privacy Filter
    results = shard.query_points(
        collection_name=collection_name,
        query=optimized_dense,
        using="dense",
        limit=2,
        query_filter=Filter(
            must=[
                FieldCondition(
                    key="sync_allowed",
                    match=MatchValue(value=True)
                )
            ]
        ),
        with_payload=True
    ).points
    
    # 2. Assemble Context
    context_blocks = []
    for hit in results:
        text = hit.payload.get('text', str(hit.payload))
        context_blocks.append(f"- {text}")
    
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