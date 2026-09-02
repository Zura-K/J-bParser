import hashlib
import json
import os
import time

from library import dedupe, ranking, store
from sources import handlers
from sources.catalog import sources

max_backoff_seconds = 86400


def url_hash(url: str) -> str:
    return hashlib.sha256(url.encode()).hexdigest()[:16]


def find_source(source_key: str) -> dict | None:
    for config in sources:
        if config["key"] == source_key:
            return config
    return None


def schedule_due(now: float | None = None) -> list[str]:
    now = time.time() if now is None else now
    queued = []
    for config in sources:
        state = store.load_source_state(config["key"]) or {}
        if float(state.get("next_run_at", 0)) <= now:
            store.save_source_state(
                config["key"], {"next_run_at": now + config["poll_minutes"] * 60}
            )
            store.push_ingest(config["key"])
            queued.append(config["key"])
    return queued


def store_parsed(source_key: str, listings: list[dict]) -> tuple[int, int]:
    stored = 0
    skipped = 0
    now = time.time()
    for item in listings:
        fingerprint = dedupe.make_fingerprint(
            item["company"], item["title"], item["location"]
        )
        if store.fingerprint_seen(fingerprint):
            skipped += 1
            continue
        vector = ranking.embed_text(item["title"] + "\n" + item["body"])
        store.save_listing(
            fingerprint,
            {
                **item,
                "source": source_key,
                "ingested_at": now,
                "fingerprint": fingerprint,
                "vector": vector,
            },
        )
        stored += 1
    return stored, skipped


def run_source(config: dict) -> None:
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
