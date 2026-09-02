import json

import pytest

from library import ranking, store
from sources import handlers, ingest, reparse


@pytest.fixture(autouse=True)
def fake_embed(monkeypatch):
    monkeypatch.setattr(ranking, "embed_text", lambda text: [1.0, float(len(text) % 7)])


@pytest.fixture()
def fake_source(monkeypatch):
    config = {"key": "fake:test", "handler": "fake", "poll_minutes": 60}
    monkeypatch.setattr(ingest, "sources", [config])
    return config


def test_schedule_loop_and_pipeline(fake_source):
    assert ingest.schedule_due(now=100.0) == ["fake:test"]
    assert ingest.schedule_due(now=200.0) == []
    assert ingest.schedule_due(now=100.0 + 61 * 60) == ["fake:test"]
    worker_id = "w1"
    claimed = store.claim_ingest(worker_id, timeout_seconds=1)
    assert claimed == "fake:test"
    ingest.run_source(fake_source)
    store.ack_ingest(worker_id, claimed)
    state = store.load_source_state("fake:test")
    assert state["last_status"] == "ok"
    assert state["stored"] == "1"
    listing_id = store.find_candidates(ingested_before=2**33)[0]["listing_id"]
    listing = store.load_listing(listing_id)
    assert listing["title"] == "Fake Engineer"
    assert listing["vector"]


def test_dedupe_skips_second_run(fake_source):
    ingest.run_source(fake_source)
    ingest.run_source(fake_source)
    state = store.load_source_state("fake:test")
    assert state["stored"] == "0"
    assert state["skipped"] == "1"
    assert len(store.find_candidates(ingested_before=2**33)) == 1


def test_reparse_uses_stored_raw_only(fake_source, monkeypatch):
    ingest.run_source(fake_source)
    store.client.delete("Fingerprints")
    for candidate in store.find_candidates(ingested_before=2**33):
        store.client.delete(f"Listing:{candidate['listing_id']}")
    store.client.delete("Listings")

    def no_network(config):
        raise AssertionError("reparse must not fetch")

    monkeypatch.setattr(handlers, "fetch", no_network)
    monkeypatch.setattr(reparse.ingest, "sources", [fake_source])
    stored, skipped = reparse.reparse("fake:test")
    assert (stored, skipped) == (1, 0)
    assert len(store.find_candidates(ingested_before=2**33)) == 1


def test_record_failure_backs_off(fake_source):
    ingest.record_failure(fake_source, RuntimeError("boom"))
    first = store.load_source_state("fake:test")
    ingest.record_failure(fake_source, RuntimeError("boom"))
    second = store.load_source_state("fake:test")
    assert first["last_status"] == "error"
    assert float(second["next_run_at"]) > float(first["next_run_at"])
    assert second["failures"] == "2"


def test_ats_parsers():
    greenhouse_body = json.dumps(
        {
            "jobs": [
                {
                    "title": "Engineer",
                    "location": {"name": "Berlin"},
                    "absolute_url": "https://example.com/1",
                    "updated_at": "2026-01-01T00:00:00+00:00",
                    "content": "&lt;p&gt;Hello &amp; welcome&lt;/p&gt;",
                }
            ]
        }
    ).encode()
    parsed = handlers.parse(
        {"handler": "greenhouse", "board": "acme"}, [("u", greenhouse_body)]
    )
    assert parsed[0]["company"] == "acme"
    assert parsed[0]["body"] == "Hello & welcome"

    lever_body = json.dumps(
        [
            {
                "text": "Engineer",
                "categories": {"location": "Remote"},
                "hostedUrl": "https://example.com/2",
                "createdAt": 1700000000000,
                "descriptionPlain": "plain body",
            }
        ]
    ).encode()
    parsed = handlers.parse({"handler": "lever", "org": "acme"}, [("u", lever_body)])
    assert parsed[0]["posted_at"] == 1700000000.0
    assert parsed[0]["body"] == "plain body"

    ashby_body = json.dumps(
        {
            "jobs": [
                {
                    "title": "Engineer",
                    "location": "NYC",
                    "jobUrl": "https://example.com/3",
                    "publishedAt": "2026-01-01T00:00:00Z",
                    "descriptionHtml": "<p>html body</p>",
                    "isListed": True,
                },
                {"title": "Hidden", "isListed": False},
            ]
        }
    ).encode()
    parsed = handlers.parse({"handler": "ashby", "org": "acme"}, [("u", ashby_body)])
    assert len(parsed) == 1
    assert parsed[0]["body"] == "html body"


def test_linkedin_parse_joins_cards_and_details():
    from sources.handlers import linkedin

    search_html = b"""
    <ul>
      <li>
        <div class="base-card" data-entity-urn="urn:li:jobPosting:1234567890">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/x-1234567890?refId=1">link</a>
          <h3 class="base-search-card__title">Engineer</h3>
          <h4 class="base-search-card__subtitle">Acme</h4>
          <span class="job-search-card__location">Berlin</span>
          <time datetime="2026-01-01">a</time>
        </div>
      </li>
    </ul>
    """
    detail_html = b'<div class="show-more-less-html__markup"><p>Job body here</p></div>'
    pages = [
        ("https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?x", search_html),
        ("https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/1234567890", detail_html),
    ]
    parsed = linkedin.handler.parse({"handler": "linkedin"}, pages)
    assert len(parsed) == 1
    assert parsed[0]["title"] == "Engineer"
    assert parsed[0]["company"] == "Acme"
    assert parsed[0]["url"] == "https://www.linkedin.com/jobs/view/x-1234567890"
    assert parsed[0]["body"] == "Job body here"
