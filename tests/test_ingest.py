import json
import time

import pytest

from library import ranking, store
from sources import clean, extract, handlers, ingest, reparse


@pytest.fixture(autouse=True)
def fake_embed(monkeypatch):
    monkeypatch.setattr(ranking, "embed_text", lambda text: [1.0, float(len(text) % 7)])
    monkeypatch.setattr(
        ranking,
        "embed_texts",
        lambda texts: [[1.0, float(len(text) % 7)] for text in texts],
    )


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
    listing_id = store.find_candidates(posted_before=2**33)[0]["listing_id"]
    listing = store.load_listing(listing_id)
    assert listing["title"] == "Fake Engineer"
    assert listing["vector"]


def test_dedupe_skips_second_run(fake_source):
    ingest.run_source(fake_source)
    ingest.run_source(fake_source)
    state = store.load_source_state("fake:test")
    assert state["stored"] == "0"
    assert state["skipped"] == "1"
    assert len(store.find_candidates(posted_before=2**33)) == 1


def test_reparse_uses_stored_raw_only(fake_source, monkeypatch):
    ingest.run_source(fake_source)
    for candidate in store.find_candidates(posted_before=2**33):
        store.client.delete(f"Listing:{candidate['listing_id']}")
    store.client.delete("Listings")

    def no_network(config):
        raise AssertionError("reparse must not fetch")

    monkeypatch.setattr(handlers, "fetch", no_network)
    monkeypatch.setattr(reparse.ingest, "sources", [fake_source])
    stored, skipped = reparse.reparse("fake:test")
    assert (stored, skipped) == (1, 0)
    assert len(store.find_candidates(posted_before=2**33)) == 1


def fake_listing(**overrides):
    return {
        "title": "Fake Engineer",
        "company": "Fakeco",
        "location": "Remote",
        "url": "https://fake.example/jobs/1",
        "posted_at": time.time() - 3600,
        "body": "A fake job for testing the pipeline.",
        **overrides,
    }


def test_update_in_place_keeps_ingested_at(fake_source):
    assert ingest.store_parsed("fake:test", [fake_listing()]) == (1, 0)
    listing_id = store.find_candidates(posted_before=2**33)[0]["listing_id"]
    first = store.load_listing(listing_id)

    assert ingest.store_parsed("fake:test", [fake_listing()]) == (0, 1)
    assert store.load_listing(listing_id)["ingested_at"] == first["ingested_at"]

    changed = fake_listing(body="A rewritten job description.")
    assert ingest.store_parsed("fake:test", [changed]) == (1, 0)
    updated = store.load_listing(listing_id)
    assert updated["body"] == "A rewritten job description."
    assert updated["ingested_at"] == first["ingested_at"]


def test_expired_listing_can_be_reingested(fake_source):
    assert ingest.store_parsed("fake:test", [fake_listing()]) == (1, 0)
    listing_id = store.find_candidates(posted_before=2**33)[0]["listing_id"]
    store.client.delete(f"Listing:{listing_id}")
    assert ingest.store_parsed("fake:test", [fake_listing()]) == (1, 0)
    assert store.load_listing(listing_id)["title"] == "Fake Engineer"


def test_old_postings_dropped_at_parse_time(fake_source):
    ancient = fake_listing(posted_at=time.time() - 60 * 86400)
    assert ingest.store_parsed("fake:test", [ancient]) == (0, 1)
    assert store.find_candidates(posted_before=2**33) == []


def test_structured_fields_stored_on_listing(fake_source):
    item = fake_listing(
        title="Senior Backend Engineer",
        body="Full-time role building services in Python.",
    )
    assert ingest.store_parsed("fake:test", [item]) == (1, 0)
    listing = store.find_candidates(posted_before=2**33)[0]
    assert listing["seniority"] == "senior"
    assert listing["remote_mode"] == "remote"
    assert listing["employment_type"] == "full_time"


def test_clean_body_strips_boilerplate_and_truncates():
    requirements = "You will build backend services in Python and Postgres. " * 12
    body = requirements + "We are proud to be an Equal Opportunity Employer and more."
    cleaned = clean.clean_body(body)
    assert "equal opportunity" not in cleaned.lower()
    assert "backend services" in cleaned

    long_body = "word " * (clean.max_body_words * 3)
    assert len(clean.clean_body(long_body).split()) == clean.max_body_words


def test_extract_fields():
    assert extract.extract_fields(
        "Senior Backend Engineer", "Remote - EMEA", "Full-time position."
    ) == {"seniority": "senior", "remote_mode": "remote", "employment_type": "full_time"}
    assert extract.extract_fields(
        "Engineering Intern", "Berlin", "A part-time hybrid arrangement."
    ) == {"seniority": "intern", "remote_mode": "hybrid", "employment_type": "part_time"}
    assert extract.extract_fields("Software Engineer", "Berlin", "Great job.") == {
        "seniority": "",
        "remote_mode": "",
        "employment_type": "",
    }


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
    parsed = handlers.parse(
        {"handler": "greenhouse", "board": "acme", "company": "Acme Inc"},
        [("u", greenhouse_body)],
    )
    assert parsed[0]["company"] == "Acme Inc"

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


def test_linkedin_paginates_until_no_new_ids(monkeypatch):
    from sources.handlers import linkedin

    search_html = b"""
    <div class="base-card" data-entity-urn="urn:li:jobPosting:1234567890">
      <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/x-1234567890">link</a>
      <h3 class="base-search-card__title">Engineer</h3>
    </div>
    """
    handler = linkedin.LinkedinHandler()

    def fake_get(url):
        if url.startswith(linkedin.posting_endpoint):
            return b'<div class="show-more-less-html__markup">body</div>'
        if "start=0" in url:
            return search_html
        return b"<ul></ul>"

    monkeypatch.setattr(handler, "_throttled_get", fake_get)
    pages = handler.fetch({"handler": "linkedin", "keywords": "x", "location": "y"})
    search_urls = [
        url for url, _ in pages if not url.startswith(linkedin.posting_endpoint)
    ]
    detail_urls = [url for url, _ in pages if url.startswith(linkedin.posting_endpoint)]
    assert len(search_urls) == 2
    assert all("f_TPR=r172800" in url for url in search_urls)
    assert "start=25" in search_urls[1]
    assert detail_urls == [linkedin.posting_endpoint + "1234567890"]


def test_linkedin_999_raises_soft_block(monkeypatch):
    import httpx

    from sources.handlers import linkedin

    handler = linkedin.LinkedinHandler()
    handler.min_request_gap_seconds = 0.0
    monkeypatch.setattr(
        linkedin.httpx,
        "get",
        lambda url, **kwargs: httpx.Response(
            999, request=httpx.Request("GET", url)
        ),
    )
    with pytest.raises(linkedin.SoftBlocked):
        handler._throttled_get("https://www.linkedin.com/jobs-guest/x")
