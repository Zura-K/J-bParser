from fastapi import APIRouter, Depends

from auth.identity import resolve_user_id
from library import store
from sources.catalog import sources

router = APIRouter()


@router.get("/api/sources")
def source_status(user_id: str = Depends(resolve_user_id)) -> dict:
    rows = []
    for config in sources:
        state = store.load_source_state(config["key"]) or {}
        rows.append(
            {
                "key": config["key"],
                "handler": config["handler"],
                "next_run_at": float(state.get("next_run_at", 0)),
                "last_run_at": float(state.get("last_run_at", 0)),
                "last_status": state.get("last_status", "never run"),
                "last_error": state.get("last_error", ""),
                "stored": int(float(state.get("stored", 0))),
                "skipped": int(float(state.get("skipped", 0))),
            }
        )
    return {"sources": rows}
