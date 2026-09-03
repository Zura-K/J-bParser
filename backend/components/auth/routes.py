import time
import uuid

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from components.auth.identity import anon_id_pattern, open_session, resolve_user_id
from components.library import limits, store

router = APIRouter()
hasher = PasswordHasher()


class Credentials(BaseModel):
    email: str
    password: str


@router.post("/api/auth/register")
def register(
    payload: Credentials, x_anon_id: str | None = Header(default=None)
) -> dict:
    email = payload.email.strip().lower()
    if store.load_user_by_email(email) is not None:
        raise HTTPException(status_code=409, detail="email already registered")
    user_id = str(uuid.uuid4())
    now = time.time()
    store.save_user(
        user_id,
        {
            "tier": "Free",
            "email": email,
            "password_hash": hasher.hash(payload.password),
            "created_at": now,
            "last_seen_at": now,
        },
    )
    store.save_user_email(email, user_id)
    if x_anon_id is not None and anon_id_pattern.fullmatch(x_anon_id) is not None:
        store.merge_user(x_anon_id, user_id)
    return {"token": open_session(user_id), "tier": "Free"}


@router.post("/api/auth/login")
def login(payload: Credentials) -> dict:
    email = payload.email.strip().lower()
    user_id = store.load_user_by_email(email)
    user = store.load_user(user_id) if user_id is not None else None
    if user is None:
        raise HTTPException(status_code=401, detail="bad credentials")
    try:
        hasher.verify(user["password_hash"], payload.password)
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="bad credentials")
    return {"token": open_session(user_id), "tier": user["tier"]}


@router.post("/api/auth/logout")
def logout(authorization: str | None = Header(default=None)) -> dict:
    if authorization is not None and authorization.startswith("Bearer "):
        store.delete_session(authorization.removeprefix("Bearer "))
    return {"ok": True}


@router.get("/api/me")
def me(user_id: str = Depends(resolve_user_id)) -> dict:
    user = store.load_user(user_id) or {}
    tier = user.get("tier", "Anonymous")
    return {
        "tier": tier,
        "email": user.get("email"),
        "max_profiles": limits.limits_for(tier).max_profiles,
    }
