"""Central configuration. Everything is overridable via environment variables so a
second "device" can be started with:  QN_DEVICE_ID=EDGE-B QN_PORT=8001 ..."""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent


def _get(name: str, default: str | None = None) -> str | None:
    return os.environ.get(f"QN_{name}", default)


def _bool(name: str, default: bool) -> bool:
    v = _get(name)
    return default if v is None else v.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Config:
    device_id: str = "EDGE-A"
    data_dir: Path = BASE_DIR / "data"
    models_dir: Path = BASE_DIR / "models"          # shared model cache (pre-download for offline use)
    collection: str = "quadnode_memory"

    # --- models -------------------------------------------------------------
    dense_model: str = "nomic-ai/nomic-embed-text-v1.5"
    sparse_model: str = "Qdrant/bm25"
    rerank_model: str = "ms-marco-MiniLM-L-12-v2"
    gliner_model: str = "urchade/gliner_mediumv2.1"
    embed_dim: int = 256                            # Matryoshka truncation of nomic's 768
    use_gliner: bool = True
    privacy_fail_closed: bool = True                # detector down => keep data local
    gliner_threshold: float = 0.6

    # --- chunking -----------------------------------------------------------
    chunk_words: int = 170                          # stays under GLiNER's ~384 token window
    chunk_overlap_words: int = 30
    max_upload_mb: int = 25

    # --- retrieval ----------------------------------------------------------
    candidates: int = 20                            # per-branch prefetch and rerank pool
    context_k: int = 4                              # passages given to the LLM
    rerank_min_score: float = 0.05                  # below this a passage is "not evidence"

    # --- LLM ----------------------------------------------------------------
    llm_model: str | None = None                    # None => auto-pick by VRAM
    llm_num_ctx: int = 4096

    # --- cloud / sync -------------------------------------------------------
    cloud_url: str | None = None                    # e.g. http://localhost:6333 (real Qdrant Server)
    cloud_api_key: str | None = None
    cloud_timeout: float = 3.0
    cloud_local_path: Path | None = None            # fallback simulator (single process only)
    sync_interval: float = 10.0
    pull_batch: int = 200
    conflict_policy: str = "manual"                 # "manual" | "lww" (last-writer-wins)

    @property
    def device_dir(self) -> Path:
        return self.data_dir / self.device_id

    @property
    def edge_path(self) -> Path:
        return self.device_dir / "edge"

    @property
    def audit_path(self) -> Path:
        return self.device_dir / "audit.jsonl"

    @property
    def state_path(self) -> Path:
        return self.device_dir / "sync_state.json"

    @classmethod
    def from_env(cls) -> "Config":
        d = cls()
        data_dir = Path(_get("DATA_DIR", str(d.data_dir)))
        return cls(
            device_id=_get("DEVICE_ID", d.device_id),
            data_dir=data_dir,
            models_dir=Path(_get("MODELS_DIR", str(d.models_dir))),
            use_gliner=_bool("USE_GLINER", d.use_gliner),
            privacy_fail_closed=_bool("PRIVACY_FAIL_CLOSED", d.privacy_fail_closed),
            llm_model=_get("LLM_MODEL"),
            cloud_url=_get("CLOUD_URL"),
            cloud_api_key=_get("CLOUD_API_KEY"),
            cloud_local_path=Path(_get("CLOUD_LOCAL_PATH", str(data_dir / "cloud_sim"))),
            sync_interval=float(_get("SYNC_INTERVAL", str(d.sync_interval))),
            conflict_policy=_get("CONFLICT_POLICY", d.conflict_policy),
        )
