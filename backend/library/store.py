import gzip
import os
import struct
import time
from collections.abc import Container, Iterable

import valkey

from library import keys

listing_ttl_seconds = 30 * 86400
raw_ttl_seconds = 3 * 86400

client = valkey.Valkey.from_url(
    os.environ.get("VALKEY_URL", "valkey://localhost:6379/0"),
    decode_responses=False,
)


def _pack_vector(vector: Iterable[float]) -> bytes:
    values = list(vector)
    return struct.pack(f"<{len(values)}f", *values)


def _unpack_vector(blob: bytes) -> list[float]:
    return list(struct.unpack(f"<{len(blob) // 4}f", blob))


def _encode_fields(fields: dict) -> dict:
    fields = dict(fields)
    vector = fields.pop("vector", None)
    mapping = {name: str(value) for name, value in fields.items()}
    if vector is not None:
        mapping["vector"] = _pack_vector(vector)
    return mapping


def _decode_fields(raw_hash: dict) -> dict:
    fields = {}
    for name_bytes, value in raw_hash.items():
        name = name_bytes.decode()
        fields[name] = _unpack_vector(value) if name == "vector" else value.decode()
    return fields


def _load_hash(key: str) -> dict | None:
    raw_hash = client.hgetall(key)
    return _decode_fields(raw_hash) if raw_hash else None


def save_listing(listing_id: str, fields: dict) -> None:
    key = keys.listing(listing_id)
    pipe = client.pipeline()
    pipe.hset(key, mapping=_encode_fields(fields))
    pipe.expire(key, listing_ttl_seconds)
    pipe.zadd(keys.listings, {listing_id: float(fields["ingested_at"])})
    pipe.sadd(keys.fingerprints, fields["fingerprint"])
    pipe.zremrangebyscore(keys.listings, "-inf", time.time() - listing_ttl_seconds)
    pipe.execute()


def load_listing(listing_id: str) -> dict | None:
    return _load_hash(keys.listing(listing_id))


def find_candidates(
    ingested_before: float,
    excluded_keywords: Iterable[str] = (),
    dismissed_fingerprints: Container[str] = frozenset(),
    locations: Iterable[str] = (),
) -> list[dict]:
    listing_ids = client.zrangebyscore(keys.listings, "-inf", ingested_before)
    pipe = client.pipeline()
    for listing_id in listing_ids:
        pipe.hgetall(keys.listing(listing_id.decode()))
    lowered_excluded = [keyword.lower() for keyword in excluded_keywords]
    lowered_locations = [location.lower() for location in locations]
    candidates = []
    for listing_id, raw_hash in zip(listing_ids, pipe.execute()):
        if not raw_hash:
            continue
        fields = _decode_fields(raw_hash)
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
        fields["listing_id"] = listing_id.decode()
        candidates.append(fields)
    return candidates


def fingerprint_seen(fingerprint: str) -> bool:
    return bool(client.sismember(keys.fingerprints, fingerprint))


def save_raw(url_hash: str, body: bytes) -> None:
    client.set(keys.raw(url_hash), gzip.compress(body), ex=raw_ttl_seconds)


def load_raw(url_hash: str) -> bytes | None:
    blob = client.get(keys.raw(url_hash))
    return gzip.decompress(blob) if blob is not None else None


def push_ingest(item: str) -> None:
    client.rpush(keys.queue_ingest, item)


def claim_ingest(worker_id: str, timeout_seconds: float = 5.0) -> str | None:
    item = client.blmove(
        keys.queue_ingest,
        keys.queue_processing(worker_id),
        timeout_seconds,
        "LEFT",
        "RIGHT",
    )
    return item.decode() if item is not None else None


def ack_ingest(worker_id: str, item: str) -> None:
    client.lrem(keys.queue_processing(worker_id), 1, item)


def requeue_processing(worker_id: str) -> int:
    moved = 0
    while (
        client.lmove(keys.queue_processing(worker_id), keys.queue_ingest, "LEFT", "RIGHT")
        is not None
    ):
        moved += 1
    return moved


def save_source_state(source_key: str, fields: dict) -> None:
    client.hset(keys.source(source_key), mapping=_encode_fields(fields))


def load_source_state(source_key: str) -> dict | None:
    return _load_hash(keys.source(source_key))


def save_user(user_id: str, fields: dict, ttl_seconds: int | None = None) -> None:
    key = keys.user(user_id)
    pipe = client.pipeline()
    pipe.hset(key, mapping=_encode_fields(fields))
    _write_with_ttl(pipe, key, ttl_seconds)


def load_user(user_id: str) -> dict | None:
    return _load_hash(keys.user(user_id))


def save_user_email(email: str, user_id: str) -> None:
    client.set(keys.user_by_email(email), user_id)


def load_user_by_email(email: str) -> str | None:
    user_id = client.get(keys.user_by_email(email))
    return user_id.decode() if user_id is not None else None


def save_session(token: str, user_id: str, ttl_seconds: int) -> None:
    client.set(keys.session(token), user_id, ex=ttl_seconds)


def load_session(token: str) -> str | None:
    user_id = client.get(keys.session(token))
    return user_id.decode() if user_id is not None else None


def delete_session(token: str) -> None:
    client.delete(keys.session(token))


def merge_user(source_user_id: str, target_user_id: str) -> None:
    for profile_id in list_profiles(source_user_id):
        target_key = keys.profile(target_user_id, profile_id)
        client.rename(keys.profile(source_user_id, profile_id), target_key)
        client.persist(target_key)
    source_dismissed = keys.dismissed(source_user_id)
    target_dismissed = keys.dismissed(target_user_id)
    if client.exists(source_dismissed):
        client.sunionstore(target_dismissed, [target_dismissed, source_dismissed])
        client.delete(source_dismissed)
        client.persist(target_dismissed)
    client.delete(keys.user(source_user_id))


def count_embed(user_id: str) -> int:
    key = keys.embed_count(user_id)
    count = client.incr(key)
    if count == 1:
        client.expire(key, 86400)
    return count


def _write_with_ttl(pipe, key: str, ttl_seconds: int | None) -> None:
    if ttl_seconds is not None:
        pipe.expire(key, ttl_seconds)
    else:
        pipe.persist(key)
    pipe.execute()


def save_profile(
    user_id: str, profile_id: str, fields: dict, ttl_seconds: int | None = None
) -> None:
    key = keys.profile(user_id, profile_id)
    pipe = client.pipeline()
    pipe.hset(key, mapping=_encode_fields(fields))
    _write_with_ttl(pipe, key, ttl_seconds)


def load_profile(user_id: str, profile_id: str) -> dict | None:
    return _load_hash(keys.profile(user_id, profile_id))


def list_profiles(user_id: str) -> dict[str, dict]:
    prefix = keys.profile(user_id, "")
    profiles = {}
    for key_bytes in client.scan_iter(match=keys.profile(user_id, "*")):
        profile_id = key_bytes.decode()[len(prefix):]
        profiles[profile_id] = _load_hash(key_bytes.decode())
    return profiles


def delete_profile(user_id: str, profile_id: str) -> None:
    client.delete(keys.profile(user_id, profile_id))


def mark_dismissed(
    user_id: str, fingerprint: str, ttl_seconds: int | None = None
) -> None:
    key = keys.dismissed(user_id)
    pipe = client.pipeline()
    pipe.sadd(key, fingerprint)
    _write_with_ttl(pipe, key, ttl_seconds)


def load_dismissed(user_id: str) -> set[str]:
    return {member.decode() for member in client.smembers(keys.dismissed(user_id))}
