import os

max_body_words = int(os.environ.get("MAX_BODY_WORDS", "500"))
min_keep_chars = 400

boilerplate_markers = [
    "equal opportunity employer",
    "equal employment opportunity",
    "equal opportunities employer",
    "affirmative action",
    "reasonable accommodation",
    "e-verify",
    "privacy policy",
    "privacy notice",
    "about us",
    "about the company",
    "about our company",
    "who we are",
    "why join us",
    "why you'll love working here",
    "what we offer",
    "our benefits",
    "benefits include",
    "benefits and perks",
    "perks and benefits",
    "compensation and benefits",
    "commitment to diversity",
    "diversity, equity",
    "diversity and inclusion",
]


def clean_body(text: str) -> str:
    lowered = text.lower()
    cut = len(text)
    for marker in boilerplate_markers:
        position = lowered.find(marker, min_keep_chars)
        if position != -1:
            cut = min(cut, position)
    words = text[:cut].split()
    return " ".join(words[:max_body_words])
