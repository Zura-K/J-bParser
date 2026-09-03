import re
import time
from urllib.parse import urlencode

import httpx

from components.sources import handlers

search_endpoint = "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search"
posting_endpoint = "https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/"
user_agent = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)


class SoftBlocked(RuntimeError):
    pass


class LinkedinHandler:
    def __init__(self):
        self.min_request_gap_seconds = 4.0
        self.max_detail_fetches = 25
        self.max_search_pages = 4
        self.page_size = 25
        self.default_recency_seconds = 172800
        self.last_request_at = 0.0

    def fetch(self, config: dict) -> list[tuple[str, bytes]]:
        recency = int(config.get("recency_seconds", self.default_recency_seconds))
        max_pages = int(config.get("max_pages", self.max_search_pages))
        pages = []
        job_ids = []
        seen_ids = set()
        for page_index in range(max_pages):
            query = urlencode(
                {
                    "keywords": config["keywords"],
                    "location": config["location"],
                    "f_TPR": f"r{recency}",
                    "start": page_index * self.page_size,
                }
            )
            search_url = f"{search_endpoint}?{query}"
            body = self._throttled_get(search_url)
            pages.append((search_url, body))
            new_ids = [
                job_id for job_id in self._job_ids(body) if job_id not in seen_ids
            ]
            if not new_ids:
                break
            seen_ids.update(new_ids)
            job_ids.extend(new_ids)
        for job_id in job_ids[: self.max_detail_fetches]:
            detail_url = posting_endpoint + job_id
            pages.append((detail_url, self._throttled_get(detail_url)))
        return pages

    def parse(self, config: dict, pages: list[tuple[str, bytes]]) -> list[dict]:
        cards = []
        bodies = {}
        for url, body in pages:
            if url.startswith(posting_endpoint):
                bodies[url.removeprefix(posting_endpoint)] = self._parse_detail(body)
            else:
                cards.extend(self._parse_cards(body))
        for card in cards:
            card["body"] = bodies.get(card.pop("job_id"), "")
        return cards

    def _throttled_get(self, url: str) -> bytes:
        wait = self.last_request_at + self.min_request_gap_seconds - time.monotonic()
        if wait > 0:
            time.sleep(wait)
        self.last_request_at = time.monotonic()
        response = httpx.get(
            url, headers={"user-agent": user_agent}, timeout=30, follow_redirects=True
        )
        if response.status_code == 999:
            raise SoftBlocked("linkedin returned 999 (soft block), backing off")
        if response.status_code in (403, 429):
            return self._playwright_get(url)
        response.raise_for_status()
        return response.content

    def _playwright_get(self, url: str) -> bytes:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch()
            page = browser.new_page(user_agent=user_agent)
            page.goto(url, wait_until="domcontentloaded")
            content = page.content()
            browser.close()
        return content.encode()

    def _job_ids(self, body: bytes) -> list[str]:
        return [card["job_id"] for card in self._parse_cards(body)]

    def _parse_cards(self, body: bytes) -> list[dict]:
        from selectolax.parser import HTMLParser

        cards = {}
        tree = HTMLParser(body)
        for node in tree.css("div.base-card") or tree.css("li"):
            urn = node.attributes.get("data-entity-urn", "") or ""
            link = node.css_first("a.base-card__full-link") or node.css_first("a")
            title = node.css_first("h3.base-search-card__title") or node.css_first("h3")
            company = node.css_first("h4.base-search-card__subtitle") or node.css_first("h4")
            location = node.css_first("span.job-search-card__location")
            if link is None or title is None:
                continue
            href = link.attributes.get("href", "") or ""
            match = re.search(r"(\d{7,})", urn) or re.search(r"-(\d{7,})", href)
            if match is None:
                continue
            cards.setdefault(
                match.group(1),
                {
                    "job_id": match.group(1),
                    "title": title.text(strip=True),
                    "company": company.text(strip=True) if company else "",
                    "location": location.text(strip=True) if location else "",
                    "url": href.split("?")[0],
                    "posted_at": self._card_posted_at(node),
                },
            )
        return list(cards.values())

    def _card_posted_at(self, node) -> float:
        time_node = node.css_first("time")
        if time_node is not None:
            from components.sources.handlers.ats import iso_to_epoch

            return iso_to_epoch(time_node.attributes.get("datetime", "") or "")
        return time.time()

    def _parse_detail(self, body: bytes) -> str:
        from selectolax.parser import HTMLParser

        tree = HTMLParser(body)
        description = tree.css_first("div.show-more-less-html__markup")
        if description is not None:
            return description.text(separator=" ", strip=True)
        return handlers.html_to_text(body.decode(errors="replace"))


handler = LinkedinHandler()
