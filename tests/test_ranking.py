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
    anonymous = limits_for("Anonymous")
    free = limits_for("Free")
    paid = limits_for("Paid")
    assert anonymous.delay_hours > free.delay_hours > paid.delay_hours
    assert anonymous.max_profiles < free.max_profiles < paid.max_profiles
    assert anonymous.record_ttl_seconds == 90 * 86400
    assert free.record_ttl_seconds is None
    assert paid.llm_reasons and not free.llm_reasons
    assert limits_for("garbage") == anonymous
