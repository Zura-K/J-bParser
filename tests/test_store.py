import time

import pytest

from library import store
from library.valkey import x_valkey


def make_listing(**overrides):
    fields = {
        "title": "Backend Engineer",
        "company": "Acme",
        "location": "Berlin, Germany",
        "url": "https://example.com/jobs/1",
        "source": "greenhouse:acme",
        "ingested_at": time.time() - 7 * 86400,
        "body": "Build services in Python.",
        "vector": [0.1, 0.2, 0.3],
        "fingerprint": "fp-1",
    }
    fields.update(overrides)
    return fields


def test_listing_round_trip():
    store.save_listing("l1", make_listing())
    loaded = store.load_listing("l1")
    assert loaded["title"] == "Backend Engineer"
    assert loaded["company"] == "Acme"
    assert loaded["vector"] == pytest.approx([0.1, 0.2, 0.3])
    assert store.load_listing("missing") is None


def test_find_candidates_applies_filters():
    now = time.time()
    store.save_listing("fresh", make_listing(fingerprint="fp-fresh", ingested_at=now))
    store.save_listing(
        "dismissed", make_listing(fingerprint="fp-dismissed", ingested_at=now - 86400)
    )
    store.save_listing(
        "excluded",
        make_listing(
            fingerprint="fp-excluded", ingested_at=now - 86400, body="Senior PHP developer"
        ),
    )
    store.save_listing(
        "elsewhere",
        make_listing(fingerprint="fp-elsewhere", ingested_at=now - 86400, location="Tokyo"),
    )
    store.save_listing("good", make_listing(fingerprint="fp-good", ingested_at=now - 86400))
    candidates = store.find_candidates(
        posted_before=now - 3600,
        excluded_keywords=["php"],
        dismissed_fingerprints={"fp-dismissed"},
        locations=["berlin"],
    )
    assert [candidate["listing_id"] for candidate in candidates] == ["good"]
    assert candidates[0]["vector"] == pytest.approx([0.1, 0.2, 0.3])


def test_find_candidates_without_filters_orders_by_age():
    now = time.time()
    store.save_listing("older", make_listing(fingerprint="fp-a", ingested_at=now - 200))
    store.save_listing("newer", make_listing(fingerprint="fp-b", ingested_at=now - 100))
    candidates = store.find_candidates(posted_before=now)
    assert [candidate["listing_id"] for candidate in candidates] == ["older", "newer"]


def test_find_candidates_prefers_posted_at_over_ingested_at():
    now = time.time()
    store.save_listing(
        "backfilled",
        make_listing(fingerprint="fp-old", ingested_at=now, posted_at=now - 10 * 86400),
    )
    store.save_listing(
        "brand_new",
        make_listing(fingerprint="fp-new", ingested_at=now, posted_at=now),
    )
    candidates = store.find_candidates(posted_before=now - 86400)
    assert [candidate["listing_id"] for candidate in candidates] == ["backfilled"]


def test_find_candidates_structured_filters():
    now = time.time()
    store.save_listing(
        "senior_remote",
        make_listing(
            fingerprint="fp-sr",
            ingested_at=now - 86400,
            seniority="senior",
            remote_mode="remote",
        ),
    )
    store.save_listing(
        "junior_onsite",
        make_listing(
            fingerprint="fp-jo",
            ingested_at=now - 7200,
            seniority="junior",
            remote_mode="onsite",
        ),
    )
    store.save_listing(
        "unlabeled", make_listing(fingerprint="fp-un", ingested_at=now - 3600)
    )
    candidates = store.find_candidates(
        posted_before=now, seniorities=["senior"], remote_modes=["remote"]
    )
    assert [candidate["listing_id"] for candidate in candidates] == [
        "senior_remote",
        "unlabeled",
    ]


def test_raw_round_trip():
    body = b"<html>jobs</html>"
    store.save_raw("hash1", body)
    assert store.load_raw("hash1") == body
    assert store.load_raw("missing") is None


def test_queue_claim_ack_requeue():
    store.push_ingest("item-1")
    store.push_ingest("item-2")
    assert store.claim_ingest("w1", timeout_seconds=1) == "item-1"
    store.ack_ingest("w1", "item-1")
    assert store.claim_ingest("w1", timeout_seconds=1) == "item-2"
    assert store.requeue_processing("w1") == 1
    assert store.claim_ingest("w2", timeout_seconds=1) == "item-2"


def test_user_email_and_session():
    store.save_user("u1", {"tier": "Anonymous", "created_at": 1.0, "last_seen_at": 1.0})
    assert store.load_user("u1")["tier"] == "Anonymous"
    assert store.load_user("missing") is None
    store.save_user_email("a@b.c", "u1")
    assert store.load_user_by_email("a@b.c") == "u1"
    assert store.load_user_by_email("x@y.z") is None
    store.save_session("tok", "u1", ttl_seconds=60)
    assert store.load_session("tok") == "u1"
    store.delete_session("tok")
    assert store.load_session("tok") is None


def test_user_ttl_set_and_cleared():
    store.save_user("u1", {"tier": "Anonymous"}, ttl_seconds=60)
    assert x_valkey.ttl("User:u1") > 0
    store.save_user("u1", {"tier": "Free"})
    assert x_valkey.ttl("User:u1") == -1


def test_profiles():
    store.save_profile("u1", "p1", {"keywords": "python", "vector": [1.0, 2.0]})
    store.save_profile("u1", "p2", {"keywords": "golang"})
    store.save_profile("u2", "p1", {"keywords": "rust"})
    loaded = store.load_profile("u1", "p1")
    assert loaded["keywords"] == "python"
    assert loaded["vector"] == pytest.approx([1.0, 2.0])
    assert set(store.list_profiles("u1")) == {"p1", "p2"}
    store.delete_profile("u1", "p2")
    assert set(store.list_profiles("u1")) == {"p1"}
    assert store.load_profile("u1", "p2") is None


def test_merge_user_repoints_state():
    store.save_user("anon", {"tier": "Anonymous"}, ttl_seconds=60)
    store.save_profile("anon", "p1", {"keywords": "python"}, ttl_seconds=60)
    store.mark_dismissed("anon", "fp-1", ttl_seconds=60)
    store.save_user("acct", {"tier": "Free"})
    store.mark_dismissed("acct", "fp-2")
    store.merge_user("anon", "acct")
    assert store.load_user("anon") is None
    assert store.list_profiles("anon") == {}
    assert store.load_profile("acct", "p1")["keywords"] == "python"
    assert x_valkey.ttl("Profile:acct:p1") == -1
    assert store.load_dismissed("acct") == {"fp-1", "fp-2"}
    assert x_valkey.ttl("Dismissed:acct") == -1


def test_embed_count_increments_daily():
    assert store.embed_count("u1") == 0
    store.bump_embed_count("u1")
    assert store.embed_count("u1") == 1
    store.bump_embed_count("u1")
    assert store.embed_count("u1") == 2
    assert store.embed_count("u2") == 0
    assert x_valkey.ttl("EmbedCount:u1") > 0


def test_dismissed():
    store.mark_dismissed("u1", "fp-1")
    store.mark_dismissed("u1", "fp-2")
    store.mark_dismissed("u1", "fp-2")
    assert store.load_dismissed("u1") == {"fp-1", "fp-2"}
    assert store.load_dismissed("u2") == set()
