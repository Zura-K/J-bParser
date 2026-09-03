import hashlib
import re


def make_fingerprint(company: str, title: str, location: str) -> str:
    parts = [_normalize(company), _normalize(title), _normalize(location)]
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:20]


def _normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()
