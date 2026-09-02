import time
import uuid

import pytest
from fastapi.testclient import TestClient

import api
from library import ranking, store

client = TestClient(api.app)


@pytest.fixture(autouse=True)
def fake_embed(monkeypatch):
    monkeypatch.setattr(ranking, "embed_text", lambda text: [1.0, 0.0])


def anon_headers():
    return {"x-anon-id": str(uuid.uuid4())}


def seed_listing(fingerprint, age_hours, vector, title="Engineer", body="Python work"):
    store.save_listing(
        fingerprint,
        {
            "title": title,
            "company": "Acme",
            "location": "Berlin",
            "url": f"https://example.com/{fingerprint}",
            "source": "fake:test",
            "posted_at": 1700000000.0,
            "ingested_at": time.time() - age_hours * 3600,
            "body": body,
            "vector": vector,
            "fingerprint": fingerprint,
        },
    )


def test_missing_credentials_rejected():
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers={"x-anon-id": "Listing:*"}).status_code == 400


def test_anonymous_flow_search_and_dismiss():
    headers = anon_headers()
    assert client.get("/api/me", headers=headers).json()["tier"] == "Anonymous"
    seed_listing("fp-close", age_hours=100, vector=[1.0, 0.0])
    seed_listing("fp-far", age_hours=100, vector=[0.0, 1.0])
    seed_listing("fp-fresh", age_hours=1, vector=[1.0, 0.0])
    created = client.post(
        "/api/profiles", json={"description": "python backend"}, headers=headers
    )
    profile_id = created.json()["profile_id"]
    results = client.get(f"/api/search/{profile_id}", headers=headers).json()["results"]
    assert [item["fingerprint"] for item in results] == ["fp-close", "fp-far"]
    assert results[0]["score"] > results[1]["score"]
    client.post("/api/dismiss", json={"fingerprint": "fp-close"}, headers=headers)
    results = client.get(f"/api/search/{profile_id}", headers=headers).json()["results"]
    assert [item["fingerprint"] for item in results] == ["fp-far"]


def test_anonymous_profile_cap():
    headers = anon_headers()
    assert (
        client.post(
            "/api/profiles", json={"description": "one"}, headers=headers
        ).status_code
        == 200
    )
    assert (
        client.post(
            "/api/profiles", json={"description": "two"}, headers=headers
        ).status_code
        == 403
    )


def test_embed_rate_limit():
    headers = anon_headers()
    created = client.post(
        "/api/profiles", json={"description": "start"}, headers=headers
    )
    profile_id = created.json()["profile_id"]
    responses = [
        client.put(
            f"/api/profiles/{profile_id}",
            json={"description": f"try {attempt}"},
            headers=headers,
        ).status_code
        for attempt in range(12)
    ]
    assert 429 in responses


def test_register_claims_anonymous_state():
    headers = anon_headers()
    created = client.post(
        "/api/profiles", json={"description": "python"}, headers=headers
    )
    profile_id = created.json()["profile_id"]
    client.post("/api/dismiss", json={"fingerprint": "fp-x"}, headers=headers)
    registered = client.post(
        "/api/auth/register",
        json={"email": "A@B.c", "password": "hunter22"},
        headers=headers,
    )
    token = registered.json()["token"]
    auth = {"authorization": f"Bearer {token}"}
    assert client.get("/api/me", headers=auth).json() == {
        "tier": "Free",
        "email": "a@b.c",
        "max_profiles": 3,
    }
    profiles = client.get("/api/profiles", headers=auth).json()["profiles"]
    assert profile_id in profiles
    assert store.load_dismissed(store.load_user_by_email("a@b.c")) == {"fp-x"}
    assert store.load_user(headers["x-anon-id"]) is None
    assert (
        client.post(
            "/api/auth/register",
            json={"email": "a@b.c", "password": "other"},
        ).status_code
        == 409
    )


def test_login_logout():
    client.post(
        "/api/auth/register",
        json={"email": "x@y.z", "password": "hunter22"},
        headers=anon_headers(),
    )
    assert (
        client.post(
            "/api/auth/login", json={"email": "x@y.z", "password": "wrong"}
        ).status_code
        == 401
    )
    token = client.post(
        "/api/auth/login", json={"email": "x@y.z", "password": "hunter22"}
    ).json()["token"]
    auth = {"authorization": f"Bearer {token}"}
    assert client.get("/api/me", headers=auth).json()["email"] == "x@y.z"
    client.post("/api/auth/logout", headers=auth)
    assert client.get("/api/me", headers=auth).status_code == 401


def test_tier_freshness_gating():
    seed_listing("fp-recent", age_hours=30, vector=[1.0, 0.0])
    headers = anon_headers()
    created = client.post(
        "/api/profiles", json={"description": "python"}, headers=headers
    )
    profile_id = created.json()["profile_id"]
    anon_results = client.get(f"/api/search/{profile_id}", headers=headers).json()[
        "results"
    ]
    assert anon_results == []
    token = client.post(
        "/api/auth/register",
        json={"email": "f@f.f", "password": "hunter22"},
        headers=headers,
    ).json()["token"]
    auth = {"authorization": f"Bearer {token}"}
    free_results = client.get(f"/api/search/{profile_id}", headers=auth).json()[
        "results"
    ]
    assert [item["fingerprint"] for item in free_results] == ["fp-recent"]


def test_sources_status():
    headers = anon_headers()
    rows = client.get("/api/sources", headers=headers).json()["sources"]
    assert {row["key"] for row in rows} == {
        "greenhouse:gitlab",
        "greenhouse:cloudflare",
        "lever:plaid",
        "ashby:linear",
        "linkedin:guest",
    }
    assert rows[0]["last_status"] == "never run"
