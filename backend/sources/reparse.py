import json
import sys

from library import store
from sources import handlers, ingest


def reparse(source_key: str) -> tuple[int, int]:
    config = ingest.find_source(source_key)
    if config is None:
        raise SystemExit(f"unknown source {source_key}")
    state = store.load_source_state(source_key) or {}
    pages = []
    for url in json.loads(state.get("raw_urls", "[]")):
        body = store.load_raw(ingest.url_hash(url))
        if body is not None:
            pages.append((url, body))
    listings = handlers.parse(config, pages)
    return ingest.store_parsed(source_key, listings)


if __name__ == "__main__":
    stored, skipped = reparse(sys.argv[1])
    print(f"stored={stored} skipped={skipped}")
