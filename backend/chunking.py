"""Sentence-aware chunking with word-level overlap.

Chunks are small on purpose: (1) the embedder sees focused text, (2) GLiNER's
window is ~384 tokens so every chunk is fully scanned for secrets, and (3) the
local-vs-sync decision is made per chunk, so one leaked password no longer
quarantines a whole 40-page PDF."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

_SENT = re.compile(r"(?<=[.!?])\s+(?=[A-Z0-9\"'(\[])")
_PARA = re.compile(r"\n\s*\n")


@dataclass(frozen=True)
class Chunk:
    index: int
    text: str
    page: int | None = None


def _wc(s: str) -> int:
    return len(s.split())


def _units(text: str, max_words: int) -> Iterable[str]:
    """Yield sentence-ish units, hard-splitting any unit longer than max_words."""
    for para in _PARA.split(text.replace("\r\n", "\n")):
        para = re.sub(r"[ \t]+", " ", para.replace("\n", " ")).strip()
        if not para:
            continue
        for sent in _SENT.split(para):
            words = sent.split()
            if len(words) <= max_words:
                if words:
                    yield " ".join(words)
            else:
                for i in range(0, len(words), max_words):
                    yield " ".join(words[i:i + max_words])


def chunk_text(text: str, max_words: int = 170, overlap_words: int = 30,
               page: int | None = None, start_index: int = 0) -> list[Chunk]:
    chunks: list[Chunk] = []
    cur: list[str] = []
    cur_words = 0
    fresh = 0                       # words added since last emit (avoid overlap-only tail chunks)

    def emit() -> None:
        nonlocal cur, cur_words, fresh
        chunks.append(Chunk(start_index + len(chunks), " ".join(cur), page))
        keep: list[str] = []
        kept = 0
        for u in reversed(cur):     # carry trailing sentences as overlap
            if kept + _wc(u) > overlap_words:
                break
            keep.insert(0, u)
            kept += _wc(u)
        cur, cur_words, fresh = keep, kept, 0

    for u in _units(text, max_words):
        w = _wc(u)
        if cur and cur_words + w > max_words:
            emit()
            if cur_words + w > max_words:   # overlap + unit still too big: drop overlap
                cur, cur_words = [], 0
        cur.append(u)
        cur_words += w
        fresh += w
    if cur and fresh:
        emit()
    return chunks


def chunk_segments(segments: Iterable[tuple[int | None, str]], max_words: int = 170,
                   overlap_words: int = 30) -> list[Chunk]:
    """segments = [(page_number_or_None, text), ...] -> globally indexed chunks."""
    out: list[Chunk] = []
    for page, text in segments:
        out.extend(chunk_text(text, max_words, overlap_words, page, start_index=len(out)))
    return out
