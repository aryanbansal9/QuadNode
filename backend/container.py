"""Wires everything together. All heavy parts are injectable so tests (and a
future Qdrant-Edge store) can replace them."""
from __future__ import annotations

from dataclasses import dataclass

from qdrant_client import QdrantClient

from .audit import AuditLog
from .config import Config
from .retrieval import Retriever
from .service import MemoryService
from .store import MemoryStore
from .sync import Connectivity, SyncEngine


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

    # EDGE: embedded, in-process, on disk. (Swap point for a Qdrant Edge EdgeShard adapter.)
    edge_client = edge_client or QdrantClient(path=str(cfg.edge_path))
    remote = bool(cfg.cloud_url)
    if cloud_client is None:
        cloud_client = (QdrantClient(url=cfg.cloud_url, api_key=cfg.cloud_api_key, timeout=cfg.cloud_timeout)
                        if remote else QdrantClient(path=str(cfg.cloud_local_path)))

    edge = MemoryStore(edge_client, cfg.collection, cfg.embed_dim, "edge")
    cloud = MemoryStore(cloud_client, cfg.collection, cfg.embed_dim, "cloud", remote=remote)
    edge.ensure()
    if not remote:
        cloud.ensure()           # simulator lives on local disk; a real server is ensured on first sync

    conn = Connectivity(cloud)
    return Container(cfg, audit, edge, cloud, embedder, privacy, reranker,
                     Retriever(cfg, edge, embedder, reranker),
                     MemoryService(cfg, edge, embedder, privacy, audit),
                     conn, SyncEngine(cfg, edge, cloud, conn, audit), llm)
