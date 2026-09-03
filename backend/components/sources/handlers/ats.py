import html
import json
import time
from datetime import datetime

import httpx

from components.sources import handlers


def fetch(config: dict) -> list[tuple[str, bytes]]:
    match config["handler"]:
        case "greenhouse":
            url = (
                "https://boards-api.greenhouse.io/v1/boards/"
                f"{config['board']}/jobs?content=true"
            )
        case "lever":
            url = f"https://api.lever.co/v0/postings/{config['org']}?mode=json"
        case "ashby":
            url = f"https://api.ashbyhq.com/posting-api/job-board/{config['org']}"
    response = httpx.get(url, timeout=30, follow_redirects=True)
    response.raise_for_status()
    return [(url, response.content)]


def parse(config: dict, pages: list[tuple[str, bytes]]) -> list[dict]:
    listings = []
    for _, body in pages:
        data = json.loads(body)
        match config["handler"]:
            case "greenhouse":
                listings.extend(_parse_greenhouse(config, data))
            case "lever":
                listings.extend(_parse_lever(config, data))
            case "ashby":
                listings.extend(_parse_ashby(config, data))
    return listings


def _parse_greenhouse(config: dict, data: dict) -> list[dict]:
    listings = []
    for job in data.get("jobs", []):
        listings.append(
            {
                "title": job.get("title", ""),
                "company": job.get("company_name")
                or config.get("company")
                or config["board"],
                "location": (job.get("location") or {}).get("name", ""),
                "url": job.get("absolute_url", ""),
                "posted_at": iso_to_epoch(
                    job.get("first_published") or job.get("updated_at") or ""
                ),
                "body": handlers.html_to_text(html.unescape(job.get("content", ""))),
            }
        )
    return listings


def _parse_lever(config: dict, data: list) -> list[dict]:
    listings = []
    for posting in data:
        body = posting.get("descriptionPlain") or handlers.html_to_text(
            posting.get("description", "")
        )
        listings.append(
            {
                "title": posting.get("text", ""),
                "company": config.get("company") or config["org"],
                "location": (posting.get("categories") or {}).get("location", ""),
                "url": posting.get("hostedUrl", ""),
                "posted_at": float(posting.get("createdAt", 0)) / 1000,
                "body": body,
            }
        )
    return listings


def _parse_ashby(config: dict, data: dict) -> list[dict]:
    listings = []
    for job in data.get("jobs", []):
        if not job.get("isListed", True):
            continue
        listings.append(
            {
                "title": job.get("title", ""),
                "company": config.get("company") or config["org"],
                "location": job.get("location", ""),
                "url": job.get("jobUrl") or job.get("applyUrl", ""),
                "posted_at": iso_to_epoch(job.get("publishedAt") or ""),
                "body": handlers.html_to_text(job.get("descriptionHtml", "")),
            }
        )
    return listings


def iso_to_epoch(value: str) -> float:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return time.time()
