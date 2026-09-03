import os

reason_model = os.environ.get("REASON_MODEL", "claude-opus-5")


def reasons_enabled() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def generate_reasons(description: str, results: list[dict]) -> dict[str, str]:
    if not results:
        return {}
    import anthropic

    lines = [
        f"{index}. {item['title']} at {item['company']} ({item['location']}): "
        f"{item.get('body', '')[:400]}"
        for index, item in enumerate(results, start=1)
    ]
    prompt = (
        "A job seeker describes themselves as:\n"
        f"{description}\n\n"
        "For each job below, write one short line on why it fits or does not fit "
        "this person. Answer with exactly one numbered line per job, in order, "
        "formatted as 'N. reason'.\n\n" + "\n".join(lines)
    )
    try:
        response = anthropic.Anthropic().messages.create(
            model=reason_model,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError:
        return {}
    text = next(
        (block.text for block in response.content if block.type == "text"), ""
    )
    reasons = {}
    for line in text.splitlines():
        number, _, reason = line.strip().partition(".")
        if number.isdigit() and 1 <= int(number) <= len(results):
            reasons[results[int(number) - 1]["fingerprint"]] = reason.strip()
    return reasons
