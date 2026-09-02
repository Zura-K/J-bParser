import json
import time

default_listings = [
    {
        "title": "Fake Engineer",
        "company": "Fakeco",
        "location": "Remote",
        "url": "https://fake.example/jobs/1",
        "posted_at": 0.0,
        "body": "A fake job for testing the pipeline.",
    }
]


def fetch(config: dict) -> list[tuple[str, bytes]]:
    listings = config.get("listings", default_listings)
    return [(f"fake://{config['key']}", json.dumps(listings).encode())]


def parse(config: dict, pages: list[tuple[str, bytes]]) -> list[dict]:
    listings = []
    for _, body in pages:
        for item in json.loads(body):
            listings.append({**item, "posted_at": item.get("posted_at") or time.time()})
    return listings
