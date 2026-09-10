import io
import json
import os
from pathlib import Path

import jinja2

from components.sources import extract

resume_model = os.environ.get("RESUME_MODEL", "claude-opus-5")
top_bullets_per_role = 3

template_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(Path(__file__).parent / "templates"),
    autoescape=True,
)


def select_content(profile: dict, vacancy: dict) -> tuple[dict, dict]:
    vacancy_skills = extract.extract_skills(
        vacancy.get("title", "") + "\n" + vacancy.get("body", "")
    )
    wanted = {skill.lower() for skill in vacancy_skills}
    owned = {skill.lower() for skill in profile.get("skills", [])}
    experience = []
    for entry in profile.get("experience", []):
        bullets = sorted(
            entry.get("bullets", []),
            key=lambda bullet: -_overlap(bullet, wanted),
        )
        for bullet in bullets:
            owned.update(skill.lower() for skill in bullet.get("skills", []))
        experience.append({**entry, "bullets": bullets})
    matched = [skill for skill in vacancy_skills if skill.lower() in owned]
    missing = [skill for skill in vacancy_skills if skill.lower() not in owned]
    score = (
        round(100 * len(matched) / len(vacancy_skills), 1) if vacancy_skills else 0.0
    )
    coverage = {"matched": matched, "missing": missing, "score": score}
    return {**profile, "experience": experience}, coverage


def _overlap(bullet: dict, wanted: set[str]) -> int:
    return len(wanted & {skill.lower() for skill in bullet.get("skills", [])})


def rewrite_summary(profile: dict, vacancy: dict) -> dict:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return profile
    import anthropic

    top = [
        (entry_index, bullet_index, bullet.get("text", ""))
        for entry_index, entry in enumerate(profile.get("experience", []))
        for bullet_index, bullet in enumerate(
            entry.get("bullets", [])[:top_bullets_per_role]
        )
    ]
    prompt = (
        "Rephrase parts of a resume so they read well for this vacancy:\n"
        f"{vacancy.get('title', '')} at {vacancy.get('company', '')}\n"
        f"{vacancy.get('body', '')[:1500]}\n\n"
        "Hard constraint: reword only. Never add skills, employers, roles, "
        "dates, numbers, or any fact absent from the source text, and never "
        "drop factual content. Keep each bullet one sentence, tightened.\n\n"
        f"Summary:\n{profile.get('summary', '')}\n\n"
        "Bullets:\n"
        + "\n".join(f"{number}. {text}" for number, (_, _, text) in enumerate(top, 1))
        + "\n\nAnswer with JSON only, no markdown fences: "
        '{"summary": "...", "bullets": ["..."]} '
        f"with exactly {len(top)} bullets, reworded in the given order."
    )
    try:
        response = anthropic.Anthropic().messages.create(
            model=resume_model,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIError:
        return profile
    reply = next(
        (block.text for block in response.content if block.type == "text"), ""
    )
    raw = reply.strip().removeprefix("```json").removeprefix("```")
    raw = raw.removesuffix("```").strip()
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return profile
    experience = [
        {**entry, "bullets": [dict(bullet) for bullet in entry.get("bullets", [])]}
        for entry in profile.get("experience", [])
    ]
    rewritten = parsed.get("bullets", [])
    if isinstance(rewritten, list) and len(rewritten) == len(top):
        for (entry_index, bullet_index, _), new_text in zip(top, rewritten):
            if isinstance(new_text, str) and new_text.strip():
                experience[entry_index]["bullets"][bullet_index]["text"] = (
                    new_text.strip()
                )
    summary = parsed.get("summary", "")
    if not isinstance(summary, str) or not summary.strip():
        summary = profile.get("summary", "")
    return {**profile, "summary": summary.strip(), "experience": experience}


def render_pdf(resume_data: dict, template_name: str) -> bytes:
    import weasyprint

    html = template_env.get_template(f"{template_name}.html").render(
        _template_view(resume_data)
    )
    return weasyprint.HTML(string=html).write_pdf()


def _template_view(resume_data: dict) -> dict:
    experience = []
    for entry in resume_data.get("experience", []):
        job = {
            **entry,
            "bullets": [
                bullet.get("text", "") if isinstance(bullet, dict) else bullet
                for bullet in entry.get("bullets", [])
            ],
        }
        if not job.get("end"):
            job.pop("end", None)
        experience.append(job)
    return {**resume_data, "experience": experience}


def pdf_first_page_png(pdf_blob: bytes) -> bytes:
    import pypdfium2

    document = pypdfium2.PdfDocument(pdf_blob)
    try:
        image = document[0].render(scale=2).to_pil()
    finally:
        document.close()
    buffer = io.BytesIO()
    image.save(buffer, format="PNG")
    return buffer.getvalue()
