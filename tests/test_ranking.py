import pytest

from library import dedupe, ranking
from library.limits import limits_for


def test_score_candidates_sorts_by_similarity():
    profile_vector = [1.0, 0.0]
    candidates = [
        {"fingerprint": "far", "vector": [0.0, 1.0]},
        {"fingerprint": "near", "vector": [1.0, 0.1]},
        {"fingerprint": "mid", "vector": [1.0, 1.0]},
        {"fingerprint": "no-vector"},
    ]
    scored = ranking.score_candidates(profile_vector, candidates)
    assert [item["fingerprint"] for item in scored] == ["near", "mid", "far"]
    assert scored[0]["score"] == pytest.approx(1 / (1.01**0.5))


def test_cosine_handles_zero_vector():
    assert ranking.cosine([0.0, 0.0], [1.0, 1.0]) == 0.0


def test_fingerprint_normalizes():
    a = dedupe.make_fingerprint("Acme, Inc.", "Senior Engineer", "Berlin")
    b = dedupe.make_fingerprint("acme inc", "senior   engineer!", " berlin ")
    c = dedupe.make_fingerprint("acme inc", "junior engineer", "berlin")
    assert a == b
    assert a != c


def test_limits_tiers():
    # TEMPORARY: tiers are unlocked — every tier grants full access.
    full = limits_for("Paid")
    assert limits_for("Anonymous") == full
    assert limits_for("Free") == full
    assert limits_for("garbage") == full
    assert full.llm_reasons
    assert full.delay_hours == 0
    assert full.max_profiles == 10
    assert full.record_ttl_seconds is None
