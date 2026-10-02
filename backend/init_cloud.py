"""Standalone script to explicitly create and verify the collection in Qdrant Cloud."""
from __future__ import annotations

import os
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http import models

load_dotenv()

def create_cloud_collection() -> None:
    url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY")
    collection_name = "edge"  # Matches your app collection name
    
    if not url or not api_key:
        print("[ERROR] QDRANT_URL or QDRANT_API_KEY not found in environment variables!")
        return

    print(f"Connecting to Qdrant Cloud Cluster -> URL: {url}")
    client = QdrantClient(url=url, api_key=api_key)
    
    # Check or create collection
    if not client.collection_exists(collection_name):
        print(f"Collection '{collection_name}' does not exist. Creating it now...")
        client.create_collection(
            collection_name=collection_name,
            vectors_config={"dense": models.VectorParams(size=384, distance=models.Distance.COSINE)},
            sparse_vectors_config={"sparse": models.SparseVectorParams(modifier=models.Modifier.IDF)},
        )
        print(f"SUCCESS: Collection '{collection_name}' created successfully in Qdrant Cloud!")
    else:
        print(f"SUCCESS: Collection '{collection_name}' already exists in Qdrant Cloud.")
        
    # Print verification output
    collections = client.get_collections()
    print("Verified Cloud Collections:", collections)

if __name__ == "__main__":
    create_cloud_collection()