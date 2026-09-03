import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from components.auth.identity import quotas_for_user, resolve_user_id
from components.library import ranking, store

router = APIRouter()


class ProfilePayload(BaseModel):
    keywords: str = ""
    excluded: str = ""
    locations: str = ""
    remote: str = ""
    seniority: str = ""
    description: str = ""


def write_profile(user_id: str, profile_id: str, payload: ProfilePayload) -> dict:
    quotas = quotas_for_user(user_id)
    fields = payload.model_dump()
    if payload.description.strip():
        stored = store.load_profile(user_id, profile_id)
        needs_embed = (
            stored is None
            or stored.get("description") != payload.description
            or "vector" not in stored
        )
        if needs_embed:
            if store.embed_count(user_id) >= quotas.profile_embeds_per_day:
                raise HTTPException(status_code=429, detail="embedding limit reached")
            fields["vector"] = ranking.embed_text(payload.description)
            store.bump_embed_count(user_id)
    store.save_profile(user_id, profile_id, fields, quotas.record_ttl_seconds)
    return {"profile_id": profile_id}


@router.get("/api/profiles")
def list_profiles(user_id: str = Depends(resolve_user_id)) -> dict:
    profiles = store.list_profiles(user_id)
    for fields in profiles.values():
        fields.pop("vector", None)
    return {"profiles": profiles}


@router.post("/api/profiles")
def create_profile(
    payload: ProfilePayload, user_id: str = Depends(resolve_user_id)
) -> dict:
    quotas = quotas_for_user(user_id)
    if len(store.list_profiles(user_id)) >= quotas.max_profiles:
        raise HTTPException(status_code=403, detail="profile limit reached")
    return write_profile(user_id, uuid.uuid4().hex[:8], payload)


@router.put("/api/profiles/{profile_id}")
def update_profile(
    profile_id: str, payload: ProfilePayload, user_id: str = Depends(resolve_user_id)
) -> dict:
    if store.load_profile(user_id, profile_id) is None:
        raise HTTPException(status_code=404, detail="no such profile")
    return write_profile(user_id, profile_id, payload)


@router.delete("/api/profiles/{profile_id}")
def delete_profile(profile_id: str, user_id: str = Depends(resolve_user_id)) -> dict:
    store.delete_profile(user_id, profile_id)
    return {"ok": True}
