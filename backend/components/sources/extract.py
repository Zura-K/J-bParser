import re

seniority_rules = [
    ("intern", r"\bintern(ship)?\b"),
    ("lead", r"\b(principal|staff|lead|head of|director)\b"),
    ("senior", r"\b(senior|sr\.?)\b"),
    ("junior", r"\b(junior|jr\.?|entry[ -]level|graduate)\b"),
    ("mid", r"\b(mid[ -]level|intermediate)\b"),
]

remote_mode_rules = [
    ("hybrid", r"\bhybrid\b"),
    ("onsite", r"\b(on[ -]?site|in[ -]office|office[ -]based)\b"),
    ("remote", r"\b(remote|work[ -]from[ -]home|distributed team)\b"),
]

employment_type_rules = [
    ("internship", r"\binternship\b"),
    ("part_time", r"\bpart[ -]time\b"),
    ("contract", r"\b(contract(or)?|freelance|temporary)\b"),
    ("full_time", r"\bfull[ -]time\b"),
]


def extract_fields(title: str, location: str, body: str) -> dict:
    title_lower = title.lower()
    location_lower = location.lower()
    body_lower = body.lower()
    return {
        "seniority": _first_match(seniority_rules, [title_lower]),
        "remote_mode": _first_match(
            remote_mode_rules, [title_lower + " " + location_lower, body_lower]
        ),
        "employment_type": _first_match(
            employment_type_rules, [title_lower, body_lower]
        ),
    }


def _first_match(rules: list[tuple[str, str]], texts: list[str]) -> str:
    for text in texts:
        for value, pattern in rules:
            if re.search(pattern, text):
                return value
    return ""
