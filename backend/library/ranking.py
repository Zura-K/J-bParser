import math
from collections.abc import Sequence

model_name = "BAAI/bge-small-en-v1.5"
loaded_model = None


def load_model():
    global loaded_model
    if loaded_model is None:
        from sentence_transformers import SentenceTransformer

        loaded_model = SentenceTransformer(model_name, device="cpu")
    return loaded_model


def embed_text(text: str) -> list[float]:
    return [float(value) for value in load_model().encode(text, normalize_embeddings=True)]


def score_candidates(
    profile_vector: Sequence[float], candidates: list[dict]
) -> list[dict]:
    scored = []
    for candidate in candidates:
        vector = candidate.get("vector")
        if not vector:
            continue
        scored.append({**candidate, "score": cosine(profile_vector, vector)})
    scored.sort(key=lambda candidate: candidate["score"], reverse=True)
    return scored


def cosine(a: Sequence[float], b: Sequence[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)
