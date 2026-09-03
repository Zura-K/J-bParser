import re
import secrets
import time

from fastapi import Header, HTTPException

from components.library import limits, store

session_ttl_seconds = 30 * 86400
anon_id_pattern = re.compile(r"[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}")


def touch_user(user_id: str) -> dict | None:
    user = store.load_user(user_id)
    if user is None:
        return None
    quotas = limits.limits_for(user["tier"])
    store.save_user(
        user_id, {"last_seen_at": time.time()}, quotas.record_ttl_seconds
    )
    return user


def resolve_user_id(
    authorization: str | None = Header(default=None),
    x_anon_id: str | None = Header(default=None),
) -> str:
    if authorization is not None and authorization.startswith("Bearer "):
        user_id = store.load_session(authorization.removeprefix("Bearer "))
        if user_id is None:
            raise HTTPException(status_code=401, detail="invalid session")
        touch_user(user_id)
        return user_id
    if x_anon_id is not None:
        if anon_id_pattern.fullmatch(x_anon_id) is None:
            raise HTTPException(status_code=400, detail="invalid anonymous id")
        if touch_user(x_anon_id) is None:
            now = time.time()
            store.save_user(
                x_anon_id,
                {"tier": "Anonymous", "created_at": now, "last_seen_at": now},
                limits.limits_for("Anonymous").record_ttl_seconds,
            )
        return x_anon_id
    raise HTTPException(status_code=401, detail="no credentials")


def quotas_for_user(user_id: str) -> limits.Quotas:
    user = store.load_user(user_id) or {}
    return limits.limits_for(user.get("tier", "Anonymous"))


def open_session(user_id: str) -> str:
    token = secrets.token_urlsafe(32)
    store.save_session(token, user_id, session_ttl_seconds)
    return token
