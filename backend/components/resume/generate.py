import io
import json
import os
import re
from pathlib import Path

import jinja2

from components.sources import extract

resume_model = os.environ.get("RESUME_MODEL", "claude-opus-5")
top_bullets_per_role = 3

template_env = jinja2.Environment(
    loader=jinja2.FileSystemLoader(Path(__file__).parent / "templates"),
    autoescape=True,
)

default_widgets = [
    {"id": "summary", "on": True, "side": False},
    {"id": "experience", "on": True, "side": False},
    {"id": "skills", "on": True, "side": True},
    {"id": "education", "on": True, "side": True},
    {"id": "languages", "on": True, "side": True},
    {"id": "certifications", "on": False, "side": True},
    {"id": "projects", "on": False, "side": False},
]

default_template = {
    "preset": "classic",
    "columns": 1,
    "font": "sans",
    "accent": "#111827",
    "density": "normal",
    "header_align": "left",
    "title_style": "underline",
}

template_choices = {
    "columns": (1, 2),
    "font": ("sans", "serif"),
    "density": ("compact", "normal", "airy"),
    "header_align": ("left", "center"),
    "title_style": ("underline", "caps", "bar"),
}

font_stacks = {
    "sans": '"Noto Sans", "DejaVu Sans", "Noto Sans Georgian", Arial, sans-serif',
    "serif": '"Noto Serif", "DejaVu Serif", "Noto Serif Georgian", Georgia, serif',
}

densities = {
    "compact": {"font_size": "9.5pt", "line_height": "1.32", "section_gap": "4mm", "entry_gap": "2.5mm", "header_gap": "5mm"},
    "normal": {"font_size": "10.5pt", "line_height": "1.4", "section_gap": "5.5mm", "entry_gap": "3.5mm", "header_gap": "7mm"},
    "airy": {"font_size": "10.5pt", "line_height": "1.55", "section_gap": "7.5mm", "entry_gap": "5mm", "header_gap": "9mm"},
}

accent_pattern = re.compile(r"^#[0-9a-fA-F]{6}$")


def bullet_text(bullet) -> str:
    return bullet.get("text", "") if isinstance(bullet, dict) else str(bullet)


def profile_text(profile: dict) -> str:
    parts = [profile.get("summary", "")]
    for entry in profile.get("experience", []) + profile.get("projects", []):
        parts.append(entry.get("summary", ""))
        parts.extend(bullet_text(bullet) for bullet in entry.get("bullets", []))
    parts.extend(item.get("name", "") for item in profile.get("certifications", []))
    return "\n".join(parts)


def select_content(
    profile: dict, vacancy: dict, reorder_skills: bool = True
) -> tuple[dict, dict]:
    vacancy_skills = extract.extract_skills(
        vacancy.get("title", "") + "\n" + vacancy.get("body", "")
    )
    wanted = {skill.lower() for skill in vacancy_skills}
    owned = {skill.lower() for skill in profile.get("skills", [])}
    owned.update(skill.lower() for skill in extract.extract_skills(profile_text(profile)))
    experience = []
    for entry in profile.get("experience", []):
        bullets = sorted(
            entry.get("bullets", []),
            key=lambda bullet: -_overlap(bullet_text(bullet), wanted),
        )
        experience.append({**entry, "bullets": bullets})
    matched = [skill for skill in vacancy_skills if skill.lower() in owned]
    missing = [skill for skill in vacancy_skills if skill.lower() not in owned]
    score = (
        round(100 * len(matched) / len(vacancy_skills), 1) if vacancy_skills else 0.0
    )
    skills = list(profile.get("skills", []))
    if reorder_skills:
        matched_lower = {skill.lower() for skill in matched}
        skills = [skill for skill in skills if skill.lower() in matched_lower] + [
            skill for skill in skills if skill.lower() not in matched_lower
        ]
    coverage = {"matched": matched, "missing": missing, "score": score}
    return {**profile, "experience": experience, "skills": skills}, coverage


def _overlap(text: str, wanted: set[str]) -> int:
    return len(wanted & {skill.lower() for skill in extract.extract_skills(text)})


def rewrite_summary(profile: dict, vacancy: dict) -> dict:
    if not os.environ.get("ANTHROPIC_API_KEY"):
        return profile
    import anthropic

    top = [
        (entry_index, bullet_index, bullet_text(bullet))
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
        {**entry, "bullets": list(entry.get("bullets", []))}
        for entry in profile.get("experience", [])
    ]
    rewritten = parsed.get("bullets", [])
    if isinstance(rewritten, list) and len(rewritten) == len(top):
        for (entry_index, bullet_index, _), new_text in zip(top, rewritten):
            if isinstance(new_text, str) and new_text.strip():
                bullets = experience[entry_index]["bullets"]
                if isinstance(bullets[bullet_index], dict):
                    bullets[bullet_index] = {**bullets[bullet_index], "text": new_text.strip()}
                else:
                    bullets[bullet_index] = new_text.strip()
    summary = parsed.get("summary", "")
    if not isinstance(summary, str) or not summary.strip():
        summary = profile.get("summary", "")
    return {**profile, "summary": summary.strip(), "experience": experience}


def template_settings(profile: dict) -> dict:
    stored = profile.get("template") or {}
    settings = dict(default_template)
    for key, choices in template_choices.items():
        if stored.get(key) in choices:
            settings[key] = stored[key]
    if accent_pattern.match(str(stored.get("accent", ""))):
        settings["accent"] = stored["accent"]
    if isinstance(stored.get("preset"), str):
        settings["preset"] = stored["preset"]
    return settings


def widget_layout(profile: dict) -> list[dict]:
    defaults = {widget["id"]: widget for widget in default_widgets}
    ordered = []
    for widget in profile.get("widgets") or []:
        if widget.get("id") in defaults and widget["id"] not in {w["id"] for w in ordered}:
            base = defaults[widget["id"]]
            ordered.append({
                "id": widget["id"],
                "on": bool(widget.get("on", base["on"])),
                "side": bool(widget.get("side", base["side"])),
            })
    seen = {widget["id"] for widget in ordered}
    ordered.extend(dict(widget) for widget in default_widgets if widget["id"] not in seen)
    return ordered


def render_pdf(resume_data: dict, template_name: str) -> bytes:
    import weasyprint

    html = template_env.get_template(f"{template_name}.html").render(
        _template_view(resume_data)
    )
    return weasyprint.HTML(string=html).write_pdf()


def _template_view(resume_data: dict) -> dict:
    settings = template_settings(resume_data)
    density = densities[settings["density"]]
    title_style = settings["title_style"]
    tpl = {
        **settings,
        **density,
        "font_stack": font_stacks[settings["font"]],
        "h2_color": "#6b7280" if title_style == "caps" else settings["accent"],
        "header_border": "0.6pt solid #e5e7eb" if title_style == "caps" else "",
    }
    widgets = [widget for widget in widget_layout(resume_data) if widget["on"]]
    if settings["columns"] == 2:
        main_sections = [w["id"] for w in widgets if not w["side"]]
        side_sections = [w["id"] for w in widgets if w["side"]]
    else:
        main_sections = [w["id"] for w in widgets]
        side_sections = []
    experience = []
    for entry in resume_data.get("experience", []):
        dates = entry.get("dates") or " – ".join(
            part for part in (entry.get("start", ""), entry.get("end") or "Present") if part
        )
        experience.append({
            **entry,
            "dates": dates,
            "bullets": [bullet_text(bullet) for bullet in entry.get("bullets", [])],
        })
    projects = [
        {**entry, "bullets": [bullet_text(bullet) for bullet in entry.get("bullets", [])]}
        for entry in resume_data.get("projects", [])
    ]
    return {
        **resume_data,
        "experience": experience,
        "projects": projects,
        "tpl": tpl,
        "main_sections": main_sections,
        "side_sections": side_sections,
    }


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
