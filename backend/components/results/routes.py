import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from components.auth.identity import quotas_for_user, resolve_user_id
from components.library import ranking, store
from components.results import reasons

router = APIRouter()


class DismissPayload(BaseModel):
    fingerprint: str


remote_mode_hints = {
    "yes": "remote",
    "remote": "remote",
    "no": "onsite",
    "onsite": "onsite",
    "on-site": "onsite",
    "office": "onsite",
    "hybrid": "hybrid",
}


def split_csv(value: str) -> list[str]:
    return [part.strip() for part in value.split(",") if part.strip()]


def remote_modes_from_profile(value: str) -> list[str]:
    return [
        remote_mode_hints[part.lower()]
        for part in split_csv(value)
        if part.lower() in remote_mode_hints
    ]


@router.get("/api/search/{profile_id}")
def search(profile_id: str, user_id: str = Depends(resolve_user_id)) -> dict:
    profile = store.load_profile(user_id, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="no such profile")
    vector = profile.get("vector")
    if not vector:
        raise HTTPException(status_code=400, detail="profile has no description")
    quotas = quotas_for_user(user_id)
    candidates = store.find_candidates(
        posted_before=time.time() - quotas.delay_hours * 3600,
        excluded_keywords=split_csv(profile.get("excluded", "")),
        dismissed_fingerprints=store.load_dismissed(user_id),
        locations=split_csv(profile.get("locations", "")),
        seniorities=split_csv(profile.get("seniority", "")),
        remote_modes=remote_modes_from_profile(profile.get("remote", "")),
    )
    scored = ranking.score_candidates(vector, candidates)[: quotas.max_results]
    reason_map = {}
    if quotas.llm_reasons and reasons.reasons_enabled():
        reason_map = reasons.generate_reasons(
            profile.get("description", ""), scored[:20]
        )
    return {
        "results": [
            {
                "fingerprint": item["fingerprint"],
                "title": item.get("title", ""),
                "company": item.get("company", ""),
                "location": item.get("location", ""),
                "url": item.get("url", ""),
                "source": item.get("source", ""),
                "posted_at": float(item.get("posted_at", 0)),
                "snippet": item.get("body", "")[:300],
                "score": round(item["score"], 4),
                "reason": reason_map.get(item["fingerprint"], ""),
            }
            for item in scored
        ]
    }


@router.post("/api/dismiss")
def dismiss(payload: DismissPayload, user_id: str = Depends(resolve_user_id)) -> dict:
    quotas = quotas_for_user(user_id)
    store.mark_dismissed(user_id, payload.fingerprint, quotas.record_ttl_seconds)
    return {"ok": True}
