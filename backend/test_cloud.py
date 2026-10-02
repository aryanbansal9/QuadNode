"""Direct diagnostic script to test Qdrant Cloud upsert with a valid UUID."""
from __future__ import annotations

import os
import time
import uuid
from dotenv import load_dotenv
from qdrant_client import QdrantClient
from qdrant_client.http import models

load_dotenv()

def test_push():
    url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY")
    collection_name = "edge"

    print(f"Connecting to Cloud -> {url}")
    client = QdrantClient(url=url, api_key=api_key)

    # 1. Check current count
    try:
        count_res = client.count(collection_name, exact=True)
        print(f"Current Cloud Point Count: {count_res.count}")
    except Exception as e:
        print(f"Error connecting or reading count: {e}")
        return

    # 2. Force-upsert a test point using a VALID UUID
    test_id = str(uuid.uuid4())
    test_vector = [0.1] * 384  # Dummy dense vector matching 384 dim
    test_payload = {
        "text": "Direct cloud test insertion payload with valid UUID",
        "source": "test_script.txt",
        "sync_status": "SYNCED",
        "updated_at": time.time(),
        "deleted": False
    }

    print(f"Attempting direct test upsert with ID {test_id}...")
    try:
        client.upsert(
            collection_name=collection_name,
            points=[
                models.PointStruct(
                    id=test_id,
                    vector={"dense": test_vector},
                    payload=test_payload
                )
            ]
        )
        print("SUCCESS: Test point upserted successfully to Qdrant Cloud!")
    except Exception as e:
        print(f"FAILED TO UPSERT TO CLOUD: {e}")

    # 3. Verify new count
    new_count = client.count(collection_name, exact=True)
    print(f"New Cloud Point Count: {new_count.count}")

if __name__ == "__main__":
    test_push()