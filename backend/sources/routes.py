import os

from fastapi import APIRouter, Depends, HTTPException

from auth.identity import resolve_user_id
from library import store
from sources import ingest
from sources.catalog import sources

router = APIRouter()
manual_run_cooldown_seconds = int(os.environ.get("MANUAL_RUN_COOLDOWN_SECONDS", "300"))


@router.get("/api/sources")
def source_status(user_id: str = Depends(resolve_user_id)) -> dict:
    rows = []
    for config in sources:
        state = store.load_source_state(config["key"]) or {}
        rows.append(
            {
                "key": config["key"],
                "handler": config["handler"],
                "company": config.get("company", ""),
                "region": config.get("region", ""),
                "active": config.get("active", True),
                "next_run_at": float(state.get("next_run_at", 0)),
                "last_run_at": float(state.get("last_run_at", 0)),
                "last_status": state.get("last_status", "never run"),
                "last_error": state.get("last_error", ""),
                "stored": int(float(state.get("stored", 0))),
                "skipped": int(float(state.get("skipped", 0))),
            }
        )
    return {"sources": rows}


@router.post("/api/sources/run")
def run_sources(user_id: str = Depends(resolve_user_id)) -> dict:
    if not store.acquire_manual_run(manual_run_cooldown_seconds):
        raise HTTPException(
            status_code=429,
            detail=f"manual run is on cooldown ({manual_run_cooldown_seconds}s)",
        )
    return {"queued": ingest.queue_all()}
