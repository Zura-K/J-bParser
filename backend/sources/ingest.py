import hashlib
import json
import os
import time

from library import dedupe, ranking, store
from library.valkey import x_valkey
from sources import clean, extract, handlers
from sources.catalog import sources

max_backoff_seconds = 86400
max_listing_age_days = float(os.environ.get("MAX_LISTING_AGE_DAYS", "45"))


def url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def find_source(source_key: str) -> dict | None:
    for config in sources:
        if config["key"] == source_key:
            return config
    return None


def _queue_source(config: dict, now: float) -> None:
    store.save_source_state(
        config["key"], {"next_run_at": now + config["poll_minutes"] * 60}
    )
    store.push_ingest(config["key"])


def schedule_due(now: float | None = None) -> list[str]:
    now = time.time() if now is None else now
    queued = []
    for config in sources:
        if not config.get("active", True):
            continue
        state = store.load_source_state(config["key"]) or {}
        if float(state.get("next_run_at", 0)) <= now:
            _queue_source(config, now)
            queued.append(config["key"])
    return queued


def queue_all(now: float | None = None) -> list[str]:
    now = time.time() if now is None else now
    queued = []
    for config in sources:
        if not config.get("active", True):
            continue
        _queue_source(config, now)
        queued.append(config["key"])
    return queued


def store_parsed(source_key: str, listings: list[dict]) -> tuple[int, int]:
    stored = 0
    skipped = 0
    now = time.time()
    posted_cutoff = now - max_listing_age_days * 86400
    seen_this_run = set()
    pending = []
    for item in listings:
        posted_at = float(item.get("posted_at") or 0)
        if posted_at and posted_at < posted_cutoff:
            skipped += 1
            continue
        fingerprint = dedupe.make_fingerprint(
            item["company"], item["title"], item["location"]
        )
        if fingerprint in seen_this_run:
            skipped += 1
            continue
        seen_this_run.add(fingerprint)
        item = {**item, "body": clean.clean_body(item.get("body", ""))}
        existing = store.load_listing(fingerprint)
        if existing is not None:
            unchanged = all(
                existing.get(name, "") == str(item.get(name, ""))
                for name in ("title", "location", "body")
            )
            if unchanged:
                skipped += 1
                continue
        ingested_at = now if existing is None else float(existing["ingested_at"])
        pending.append((fingerprint, ingested_at, item))
    vectors = ranking.embed_texts(
        [item["title"] + "\n" + item["body"] for _, _, item in pending]
    )
    for (fingerprint, ingested_at, item), vector in zip(pending, vectors):
        store.save_listing(
            fingerprint,
            {
                **item,
                **extract.extract_fields(
                    item["title"], item.get("location", ""), item["body"]
                ),
                "source": source_key,
                "ingested_at": ingested_at,
                "fingerprint": fingerprint,
                "vector": vector,
            },
        )
        stored += 1
    return stored, skipped


def run_source(config: dict) -> None:
    x_valkey.clear_memo()
    pages = handlers.fetch(config)
    for url, body in pages:
        store.save_raw(url_hash(url), body)
    listings = handlers.parse(config, pages)
    stored, skipped = store_parsed(config["key"], listings)
    store.save_source_state(
        config["key"],
        {
            "raw_urls": json.dumps([url for url, _ in pages]),
            "last_run_at": time.time(),
            "last_status": "ok",
            "last_error": "",
            "stored": stored,
            "skipped": skipped,
            "failures": 0,
        },
    )


def record_failure(config: dict, error: Exception) -> None:
    state = store.load_source_state(config["key"]) or {}
    failures = int(float(state.get("failures", 0))) + 1
    backoff = min(config["poll_minutes"] * 60 * 2**failures, max_backoff_seconds)
    store.save_source_state(
        config["key"],
        {
            "last_run_at": time.time(),
            "last_status": "error",
            "last_error": str(error)[:500],
            "failures": failures,
            "next_run_at": time.time() + backoff,
        },
    )


def main() -> None:
    ranking.load_model()
    worker_id = os.environ.get("WORKER_ID", "worker-1")
    store.requeue_processing(worker_id)
    while True:
        schedule_due()
        source_key = store.claim_ingest(worker_id, timeout_seconds=5)
        if source_key is None:
            continue
        config = find_source(source_key)
        if config is not None:
            try:
                run_source(config)
            except Exception as error:
                record_failure(config, error)
        store.ack_ingest(worker_id, source_key)


if __name__ == "__main__":
    main()
