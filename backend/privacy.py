"""Layered sensitive-data gate. Decision is made PER CHUNK, before anything is
embedded or eligible to sync.

Layer 1  regex   - deterministic, catches structured secrets (AWS/GitHub/JWT/PEM...)
Layer 2  entropy - catches random-looking tokens no regex knows about
Layer 3  GLiNER  - zero-shot NER for free-text ("my password is...", addresses, IDs)

GLiNER is a fuzzy model and must not be the only gate, hence layers 1-2.
If the model is enabled but crashes, we FAIL CLOSED (chunk stays local)."""
from __future__ import annotations

import logging
import math
import re
from dataclasses import dataclass, field

log = logging.getLogger(__name__)


@dataclass(frozen=True)
class Finding:
    label: str
    kind: str                     # "secret" | "pii"
    source: str                   # regex | entropy | gliner | fail_closed
    score: float = 1.0
    span: tuple[int, int] | None = field(default=None, compare=False)


@dataclass
class Verdict:
    findings: list[Finding] = field(default_factory=list)

    @property
    def sensitive(self) -> bool:
        return bool(self.findings)

    @property
    def labels(self) -> list[str]:
        return sorted({f.label for f in self.findings})


def _luhn(s: str) -> bool:
    d = [int(c) for c in s if c.isdigit()]
    if not 13 <= len(d) <= 19:
        return False
    total = 0
    for i, x in enumerate(reversed(d)):
        if i % 2:
            x = x * 2 - 9 if x > 4 else x * 2
        total += x
    return total % 10 == 0


def _entropy(s: str) -> float:
    return -sum((s.count(c) / len(s)) * math.log2(s.count(c) / len(s)) for c in set(s))


# (label, kind, regex, optional validator)
_PATTERNS: list[tuple[str, str, re.Pattern, object]] = [
    ("aws_access_key", "secret", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b"), None),
    ("github_token", "secret", re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"), None),
    ("api_key_sk", "secret", re.compile(r"\bsk-[A-Za-z0-9_\-]{20,}\b"), None),
    ("google_api_key", "secret", re.compile(r"\bAIza[0-9A-Za-z_\-]{35}\b"), None),
    ("slack_token", "secret", re.compile(r"\bxox[baprs]-[A-Za-z0-9\-]{10,}\b"), None),
    ("jwt", "secret", re.compile(r"\beyJ[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\.[A-Za-z0-9_\-]{8,}\b"), None),
    ("private_key", "secret", re.compile(r"-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----"), None),
    ("credential_assignment", "secret", re.compile(
        r"(?i)\b(?:password|passwd|pwd|passcode|secret|api[_ -]?key|access[_ -]?token|auth[_ -]?token)"
        r"\b\s*(?:is|=|:)\s*['\"]?[^\s'\"]{4,}"), None),
    ("credit_card", "pii", re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)"), _luhn),
    ("aadhaar", "pii", re.compile(r"(?<!\d)[2-9]\d{3}[ -]\d{4}[ -]\d{4}(?!\d)|(?i:aadhaar)\D{0,15}\d{12}"), None),
    ("pan_card", "pii", re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"), None),
    ("email", "pii", re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}\b"), None),
    ("phone", "pii", re.compile(r"(?<![\d.])(?:\+91[\-\s]?)?[6-9]\d{9}(?!\d)|(?<!\w)\+\d{1,3}[\s\-]?\(?\d{2,4}\)?[\s\-]?\d{3,4}[\s\-]?\d{3,4}(?!\d)"), None),
]
_TOKEN = re.compile(r"[A-Za-z0-9_\-+/=]{24,}")


def scan_regex(text: str) -> list[Finding]:
    out: list[Finding] = []
    for label, kind, rx, validator in _PATTERNS:
        for m in rx.finditer(text):
            if validator and not validator(m.group(0)):
                continue
            out.append(Finding(label, kind, "regex", 1.0, m.span()))
    for m in _TOKEN.finditer(text):
        t = m.group(0)
        if any(c.isdigit() for c in t) and any(c.isalpha() for c in t) and _entropy(t) >= 4.0:
            out.append(Finding("high_entropy_token", "secret", "entropy", 0.8, m.span()))
    return out


class GlinerDetector:
    LABELS = {
        "api key": "secret", "password": "secret", "secret token": "secret", "private key": "secret",
        "credit card number": "pii", "bank account number": "pii", "national id number": "pii",
        "phone number": "pii", "email address": "pii", "home address": "pii",
    }

    def __init__(self, model_name: str, threshold: float = 0.6, cache_dir: str | None = None):
        from gliner import GLiNER
        kw = {"cache_dir": cache_dir} if cache_dir else {}
        self.model = GLiNER.from_pretrained(model_name, **kw)
        try:
            import torch
            if torch.cuda.is_available():
                self.model = self.model.to("cuda")
        except Exception:                                   # CPU is fine
            pass
        self.threshold = threshold
        self._labels = list(self.LABELS)

    def detect_many(self, texts: list[str]) -> list[list[Finding]]:
        batches = self.model.batch_predict_entities(
            texts, self._labels, threshold=self.threshold, flat_ner=True)
        return [[Finding(e["label"], self.LABELS.get(e["label"], "pii"), "gliner", float(e.get("score", 0)))
                 for e in ents] for ents in batches]


class PrivacyGuard:
    def __init__(self, gliner: GlinerDetector | None = None, fail_closed: bool = True):
        self.gliner, self.fail_closed = gliner, fail_closed

    def scan_many(self, texts: list[str]) -> list[Verdict]:
        verdicts = [Verdict(scan_regex(t)) for t in texts]
        if self.gliner and texts:
            try:
                for v, extra in zip(verdicts, self.gliner.detect_many(texts)):
                    v.findings.extend(extra)
            except Exception:
                log.exception("GLiNER failed")
                if self.fail_closed:
                    for v in verdicts:
                        v.findings.append(Finding("detector_unavailable", "secret", "fail_closed", 1.0))
        return verdicts

    def scan(self, text: str) -> Verdict:
        return self.scan_many([text])[0]

    @staticmethod
    def redact(text: str) -> str:
        spans = sorted((f.span, f.label) for f in scan_regex(text) if f.span)
        out, last = [], 0
        for (a, b), label in spans:
            if a < last:
                continue
            out.append(text[last:a])
            out.append(f"[REDACTED:{label}]")
            last = b
        out.append(text[last:])
        return "".join(out)
