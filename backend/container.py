"""Wires everything together. Strictly locked to 'quadnode_memory' collection."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()  # Ensure environment variables are loaded

from qdrant_client import QdrantClient

from .audit import AuditLog
from .config import Config
from .retrieval import Retriever
from .service import MemoryService
from .store import MemoryStore
from .sync import Connectivity, SyncEngine

log = logging.getLogger("quadnode.container")


@dataclass
class Container:
    cfg: Config
    audit: AuditLog
    edge: MemoryStore
    cloud: MemoryStore
    embedder: object
    privacy: object
    reranker: object
    retriever: Retriever
    memory: MemoryService
    conn: Connectivity
    sync: SyncEngine
    llm: object | None


def build(cfg: Config | None = None, *, embedder=None, reranker=None, privacy=None, llm=None,
          edge_client: QdrantClient | None = None, cloud_client: QdrantClient | None = None) -> Container:
    cfg = cfg or Config.from_env()
    cfg.device_dir.mkdir(parents=True, exist_ok=True)
    audit = AuditLog(cfg.audit_path)

    if embedder is None:
        from .embeddings import FastEmbedder
        embedder = FastEmbedder(cfg)
    if reranker is None:
        from .embeddings import FlashReranker
        reranker = FlashReranker(cfg)
    if privacy is None:
        from .privacy import GlinerDetector, PrivacyGuard
        det = GlinerDetector(cfg.gliner_model, cfg.gliner_threshold, str(cfg.models_dir)) if cfg.use_gliner else None
        privacy = PrivacyGuard(det, cfg.privacy_fail_closed)
    if llm is None:
        from .llm import LLM
        llm = LLM(cfg)

    # =================================================================
    # FORCE THE EXACT COLLECTION NAME FOR BOTH LOCAL AND CLOUD
    TARGET_COLLECTION = "quadnode_memory"
    # =================================================================

    # EDGE: Embedded local vector storage on disk
    edge_client = edge_client or QdrantClient(path=str(cfg.edge_path))
    
    # CLOUD: Fetch explicitly from env
    cloud_url = os.getenv("QDRANT_URL") or cfg.cloud_url
    cloud_key = os.getenv("QDRANT_API_KEY") or cfg.cloud_api_key

    if cloud_client is None:
        log.info(f"Connecting to Qdrant Cloud Cluster -> URL: {cloud_url}")
        cloud_client = QdrantClient(
            url=cloud_url,
            api_key=cloud_key,
            timeout=cfg.cloud_timeout
        )

    # Initialize stores with the locked TARGET_COLLECTION
    edge = MemoryStore(edge_client, TARGET_COLLECTION, cfg.embed_dim, "edge", remote=False)
    cloud = MemoryStore(cloud_client, TARGET_COLLECTION, cfg.embed_dim, "cloud", remote=True)
    
    # Ensure collections exist
    edge.ensure()
    try:
        cloud.ensure()
    except Exception as e:
        log.warning(f"Cloud collection verify skipped (offline): {e}")

    conn = Connectivity(cloud)
    return Container(cfg, audit, edge, cloud, embedder, privacy, reranker,
                     Retriever(cfg, edge, embedder, reranker),
                     MemoryService(cfg, edge, embedder, privacy, audit),
                     conn, SyncEngine(cfg, edge, cloud, conn, audit), llm)