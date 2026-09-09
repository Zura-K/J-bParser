from fastapi import APIRouter, Depends, HTTPException, Response
from jinja2 import TemplateNotFound
from pydantic import BaseModel

from components.auth.identity import resolve_user_id
from components.resume import generate
from library import store

router = APIRouter()


class BulletPayload(BaseModel):
    text: str = ""
    skills: list[str] = []


class ExperiencePayload(BaseModel):
    company: str = ""
    role: str = ""
    start: str = ""
    end: str = ""
    bullets: list[BulletPayload] = []


class MasterProfilePayload(BaseModel):
    full_name: str = ""
    title: str = ""
    contact: dict[str, str] = {}
    summary: str = ""
    experience: list[ExperiencePayload] = []
    skills: list[str] = []
    education: list[dict] = []


@router.get("/api/resume/profile")
def get_master_profile(user_id: str = Depends(resolve_user_id)) -> dict:
    profile = store.load_master_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="no master profile")
    return {"profile": profile}


@router.put("/api/resume/profile")
def put_master_profile(
    payload: MasterProfilePayload, user_id: str = Depends(resolve_user_id)
) -> dict:
    store.save_master_profile(user_id, payload.model_dump())
    return {"ok": True}


@router.post("/api/resume/{vacancy_id}")
def build_resume(
    vacancy_id: str,
    template: str = "default",
    user_id: str = Depends(resolve_user_id),
) -> dict:
    profile = store.load_master_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="no master profile")
    vacancy = store.load_listing(vacancy_id)
    if vacancy is None:
        raise HTTPException(status_code=404, detail="no such vacancy")
    tailored, coverage = generate.select_content(profile, vacancy)
    tailored = generate.rewrite_summary(tailored, vacancy)
    try:
        pdf_blob = generate.render_pdf(tailored, template)
    except TemplateNotFound:
        raise HTTPException(status_code=404, detail="no such template")
    store.save_resume(user_id, vacancy_id, tailored)
    store.save_resume_pdf(user_id, vacancy_id, pdf_blob)
    return {"coverage": coverage, "resume": tailored}


@router.get("/api/resume/{vacancy_id}/pdf")
def download_resume_pdf(
    vacancy_id: str, user_id: str = Depends(resolve_user_id)
) -> Response:
    pdf_blob = store.load_resume_pdf(user_id, vacancy_id)
    if pdf_blob is None:
        raise HTTPException(status_code=404, detail="no resume generated")
    return Response(
        content=pdf_blob,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="resume-{vacancy_id}.pdf"'
        },
    )


@router.get("/api/resume/{vacancy_id}/preview.png")
def preview_resume(
    vacancy_id: str, user_id: str = Depends(resolve_user_id)
) -> Response:
    png_blob = store.load_resume_png(user_id, vacancy_id)
    if png_blob is None:
        pdf_blob = store.load_resume_pdf(user_id, vacancy_id)
        if pdf_blob is None:
            raise HTTPException(status_code=404, detail="no resume generated")
        png_blob = generate.pdf_first_page_png(pdf_blob)
        store.save_resume_png(user_id, vacancy_id, png_blob)
    return Response(content=png_blob, media_type="image/png")
