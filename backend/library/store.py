import gzip
import time
from collections.abc import Container, Iterable

from library import keys
from library.valkey import xvalkey

listing_ttl_seconds = 30 * 86400
raw_ttl_seconds = 3 * 86400


def save_listing(listing_id: str, fields: dict) -> None:
    freshness = float(fields.get("posted_at") or fields["ingested_at"])
    pipe = xvalkey.pipeline()
    pipe.set_hash(keys.listing(listing_id), fields, listing_ttl_seconds)
    pipe.add_scored(keys.listings, {listing_id: freshness})
    pipe.trim_by_score(keys.listings, "-inf", time.time() - listing_ttl_seconds)
    pipe.execute()


def load_listing(listing_id: str) -> dict | None:
    return xvalkey.get_hash(keys.listing(listing_id))


def find_candidates(
    posted_before: float,
    excluded_keywords: Iterable[str] = (),
    dismissed_fingerprints: Container[str] = frozenset(),
    locations: Iterable[str] = (),
    seniorities: Iterable[str] = (),
    remote_modes: Iterable[str] = (),
    employment_types: Iterable[str] = (),
) -> list[dict]:
    listing_ids = xvalkey.range_by_score(keys.listings, "-inf", posted_before)
    pipe = xvalkey.pipeline()
    for listing_id in listing_ids:
        pipe.get_hash(keys.listing(listing_id))
    lowered_excluded = [keyword.lower() for keyword in excluded_keywords]
    lowered_locations = [location.lower() for location in locations]
    wanted_seniorities = {value.lower() for value in seniorities}
    wanted_remote_modes = {value.lower() for value in remote_modes}
    wanted_employment_types = {value.lower() for value in employment_types}
    candidates = []
    for listing_id, fields in zip(listing_ids, pipe.execute()):
        if fields is None:
            continue
        if fields.get("fingerprint") in dismissed_fingerprints:
            continue
        text = (fields.get("title", "") + " " + fields.get("body", "")).lower()
        if any(keyword in text for keyword in lowered_excluded):
            continue
        listing_location = fields.get("location", "").lower()
        if lowered_locations and not any(
            location in listing_location for location in lowered_locations
        ):
            continue
        if _known_value_rejected(fields.get("seniority", ""), wanted_seniorities):
            continue
        if _known_value_rejected(fields.get("remote_mode", ""), wanted_remote_modes):
            continue
        if _known_value_rejected(
            fields.get("employment_type", ""), wanted_employment_types
        ):
            continue
        fields["listing_id"] = listing_id
        candidates.append(fields)
    return candidates


def _known_value_rejected(value: str, wanted: set[str]) -> bool:
    return bool(wanted) and value != "" and value.lower() not in wanted


def save_raw(url_hash: str, body: bytes) -> None:
    xvalkey.set_bytes(keys.raw(url_hash), gzip.compress(body), raw_ttl_seconds)


def load_raw(url_hash: str) -> bytes | None:
    blob = xvalkey.get_bytes(keys.raw(url_hash))
    return gzip.decompress(blob) if blob is not None else None


def acquire_manual_run(cooldown_seconds: int) -> bool:
    return xvalkey.set_if_absent(keys.manual_run, "1", cooldown_seconds)


def push_ingest(item: str) -> None:
    xvalkey.append_to_list(keys.queue_ingest, item)


def claim_ingest(worker_id: str, timeout_seconds: float = 5.0) -> str | None:
    return xvalkey.move_blocking(
        keys.queue_ingest, keys.queue_processing(worker_id), timeout_seconds
    )


def ack_ingest(worker_id: str, item: str) -> None:
    xvalkey.remove_from_list(keys.queue_processing(worker_id), item)


def requeue_processing(worker_id: str) -> int:
    moved = 0
    while (
        xvalkey.move_list_item(keys.queue_processing(worker_id), keys.queue_ingest)
        is not None
    ):
        moved += 1
    return moved


def save_source_state(source_key: str, fields: dict) -> None:
    xvalkey.set_hash(keys.source(source_key), fields)


def load_source_state(source_key: str) -> dict | None:
    return xvalkey.get_hash(keys.source(source_key))


def save_user(user_id: str, fields: dict, ttl_seconds: int | None = None) -> None:
    xvalkey.set_hash(keys.user(user_id), fields, ttl_seconds)


def load_user(user_id: str) -> dict | None:
    return xvalkey.get_hash(keys.user(user_id))


def save_user_email(email: str, user_id: str) -> None:
    xvalkey.set(keys.user_by_email(email), user_id)


def load_user_by_email(email: str) -> str | None:
    return xvalkey.get(keys.user_by_email(email))


def save_session(token: str, user_id: str, ttl_seconds: int) -> None:
    xvalkey.set(keys.session(token), user_id, ttl_seconds)


def load_session(token: str) -> str | None:
    return xvalkey.get(keys.session(token))


def delete_session(token: str) -> None:
    xvalkey.delete(keys.session(token))


def merge_user(source_user_id: str, target_user_id: str) -> None:
    for profile_id in list_profiles(source_user_id):
        target_key = keys.profile(target_user_id, profile_id)
        xvalkey.rename_key(keys.profile(source_user_id, profile_id), target_key)
        xvalkey.persist(target_key)
    source_dismissed = keys.dismissed(source_user_id)
    target_dismissed = keys.dismissed(target_user_id)
    if xvalkey.exists(source_dismissed):
        xvalkey.merge_sets(target_dismissed, source_dismissed)
        xvalkey.delete(source_dismissed)
        xvalkey.persist(target_dismissed)
    xvalkey.delete(keys.user(source_user_id))


def embed_count(user_id: str) -> int:
    raw = xvalkey.get(keys.embed_count(user_id))
    return 0 if raw is None else int(raw)


def bump_embed_count(user_id: str) -> None:
    key = keys.embed_count(user_id)
    if xvalkey.increment(key) == 1:
        xvalkey.expire(key, 86400)


def save_profile(
    user_id: str, profile_id: str, fields: dict, ttl_seconds: int | None = None
) -> None:
    xvalkey.set_hash(keys.profile(user_id, profile_id), fields, ttl_seconds)


def load_profile(user_id: str, profile_id: str) -> dict | None:
    return xvalkey.get_hash(keys.profile(user_id, profile_id))


def list_profiles(user_id: str) -> dict[str, dict]:
    prefix = keys.profile(user_id, "")
    profiles = {}
    for key in xvalkey.scan_keys(keys.profile(user_id, "*")):
        profiles[key[len(prefix):]] = xvalkey.get_hash(key)
    return profiles


def delete_profile(user_id: str, profile_id: str) -> None:
    xvalkey.delete(keys.profile(user_id, profile_id))


def mark_dismissed(
    user_id: str, fingerprint: str, ttl_seconds: int | None = None
) -> None:
    xvalkey.add_to_set(keys.dismissed(user_id), fingerprint, ttl_seconds=ttl_seconds)


def load_dismissed(user_id: str) -> set[str]:
    return xvalkey.set_members(keys.dismissed(user_id))
