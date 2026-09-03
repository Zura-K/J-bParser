from __future__ import annotations

import json
import logging
import os
import struct
import time
from collections.abc import Callable, Iterable

import valkey

from library.env import load_project_env

logger = logging.getLogger("xvalkey")

connection_retry_attempts = 3
retry_base_delay_seconds = 0.2

_empty_sentinel = "\x00xvalkey:empty\x00"


def _text(value: bytes | str) -> str:
    return value.decode() if isinstance(value, bytes) else value


def _text_or_none(value: bytes | None) -> str | None:
    return None if value is None else _text(value)


def _text_list(values: list) -> list[str]:
    return [_text(value) for value in values]


def _text_set(values: set | list) -> set[str]:
    return {_text(value) for value in values}


def _collection_or_none(raw: bytes | None):
    if raw is None:
        return None
    text = _text(raw)
    return None if text == _empty_sentinel else json.loads(text)


def _pack_vector(vector: Iterable[float]) -> bytes:
    values = list(vector)
    return struct.pack(f"<{len(values)}f", *values)


def _unpack_vector(blob: bytes) -> list[float]:
    return list(struct.unpack(f"<{len(blob) // 4}f", blob))


def _encode_hash_fields(fields: dict) -> dict:
    fields = dict(fields)
    vector = fields.pop("vector", None)
    mapping = {name: str(value) for name, value in fields.items()}
    if vector is not None:
        mapping["vector"] = _pack_vector(vector)
    return mapping


def _decode_hash_fields(raw_hash: dict) -> dict:
    fields = {}
    for name_bytes, value in raw_hash.items():
        name = name_bytes.decode()
        fields[name] = _unpack_vector(value) if name == "vector" else value.decode()
    return fields


def _hash_or_none(raw_hash: dict) -> dict | None:
    return _decode_hash_fields(raw_hash) if raw_hash else None


class XValkeyCommands:
    def __init__(self, execute: Callable, prefix: str):
        self._execute = execute
        self._prefix = prefix

    def _prefixed(self, key: str) -> str:
        return self._prefix + key

    def _unprefixed(self, key: str) -> str:
        return key[len(self._prefix):]

    def get(self, key: str) -> str | None:
        return self._execute("get", self._prefixed(key), transform=_text_or_none)

    def set(self, key: str, value, ttl_seconds: int | None = None):
        return self._execute("set", self._prefixed(key), value, ex=ttl_seconds)

    def set_if_absent(self, key: str, value, ttl_seconds: int | None = None) -> bool:
        return self._execute(
            "set", self._prefixed(key), value, nx=True, ex=ttl_seconds, transform=bool
        )

    def get_bytes(self, key: str) -> bytes | None:
        return self._execute("get", self._prefixed(key))

    def set_bytes(self, key: str, value: bytes, ttl_seconds: int | None = None):
        return self._execute("set", self._prefixed(key), value, ex=ttl_seconds)

    def delete(self, *keys: str):
        return self._execute("delete", *(self._prefixed(key) for key in keys))

    def exists(self, key: str) -> bool:
        return self._execute("exists", self._prefixed(key), transform=bool)

    def increment(self, key: str, amount: int = 1) -> int:
        return self._execute("incrby", self._prefixed(key), amount)

    def expire(self, key: str, seconds: int):
        return self._execute("expire", self._prefixed(key), seconds)

    def persist(self, key: str):
        return self._execute("persist", self._prefixed(key))

    def apply_ttl(self, key: str, ttl_seconds: int | None):
        if ttl_seconds is None:
            return self.persist(key)
        return self.expire(key, ttl_seconds)

    def ttl(self, key: str) -> int:
        return self._execute("ttl", self._prefixed(key))

    def rename_key(self, source: str, target: str):
        return self._execute("rename", self._prefixed(source), self._prefixed(target))

    def set_collection(self, key: str, value, ttl_seconds: int | None = None):
        payload = json.dumps(value, ensure_ascii=False) if value else _empty_sentinel
        return self.set(key, payload, ttl_seconds)

    def get_collection(self, key: str):
        return self._execute("get", self._prefixed(key), transform=_collection_or_none)

    def set_hash(self, key: str, fields: dict, ttl_seconds: int | None = None):
        self._execute("hset", self._prefixed(key), mapping=_encode_hash_fields(fields))
        return self.apply_ttl(key, ttl_seconds)

    def get_hash(self, key: str) -> dict | None:
        return self._execute("hgetall", self._prefixed(key), transform=_hash_or_none)

    def delete_hash_fields(self, key: str, *names: str):
        return self._execute("hdel", self._prefixed(key), *names)

    def add_to_set(self, key: str, *members: str, ttl_seconds: int | None = None):
        self._execute("sadd", self._prefixed(key), *members)
        return self.apply_ttl(key, ttl_seconds)

    def remove_from_set(self, key: str, *members: str):
        return self._execute("srem", self._prefixed(key), *members)

    def set_members(self, key: str) -> set[str]:
        return self._execute("smembers", self._prefixed(key), transform=_text_set)

    def in_set(self, key: str, member: str) -> bool:
        return self._execute("sismember", self._prefixed(key), member, transform=bool)

    def add_scored(self, key: str, mapping: dict):
        return self._execute("zadd", self._prefixed(key), mapping)

    def range_by_score(self, key: str, low, high, limit: int | None = None) -> list[str]:
        window = {} if limit is None else {"start": 0, "num": limit}
        return self._execute(
            "zrangebyscore", self._prefixed(key), low, high, transform=_text_list, **window
        )

    def trim_by_score(self, key: str, low, high):
        return self._execute("zremrangebyscore", self._prefixed(key), low, high)

    def append_to_list(self, key: str, *values):
        return self._execute("rpush", self._prefixed(key), *values)

    def remove_from_list(self, key: str, value, count: int = 1):
        return self._execute("lrem", self._prefixed(key), count, value)

    def move_blocking(
        self, source: str, destination: str, timeout_seconds: float
    ) -> str | None:
        return self._execute(
            "blmove",
            self._prefixed(source),
            self._prefixed(destination),
            timeout_seconds,
            "LEFT",
            "RIGHT",
            transform=_text_or_none,
        )

    def move_list_item(self, source: str, destination: str) -> str | None:
        return self._execute(
            "lmove",
            self._prefixed(source),
            self._prefixed(destination),
            "LEFT",
            "RIGHT",
            transform=_text_or_none,
        )

    def merge_sets(self, destination: str, *sources: str):
        prefixed = [self._prefixed(key) for key in (destination, *sources)]
        return self._execute("sunionstore", self._prefixed(destination), prefixed)


class XValkey:
    def __init__(self, url: str, namespace: str = "", trace: bool = False):
        self._client = valkey.Valkey.from_url(url, decode_responses=False)
        self._commands = XValkeyCommands(
            self._run_command, f"{namespace}:" if namespace else ""
        )
        self._trace = trace
        self._trace_log: list[tuple[str, float]] = []
        self._memo: dict = {}

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)
        if hasattr(self._commands, name):
            return getattr(self._commands, name)
        return getattr(self._client, name)

    def _with_retry(self, run: Callable):
        delay = retry_base_delay_seconds
        for attempt in range(connection_retry_attempts):
            try:
                return run()
            except (valkey.exceptions.ConnectionError, valkey.exceptions.TimeoutError):
                if attempt == connection_retry_attempts - 1:
                    raise
                logger.warning("connection error, retrying in %.1fs", delay)
                time.sleep(delay)
                delay *= 2

    def _record(self, label: str, seconds: float) -> None:
        if self._trace:
            self._trace_log.append((label, seconds))
            logger.debug("%s took %.4fs", label, seconds)

    def _run_command(self, command: str, *args, transform=None, **kwargs):
        method = getattr(self._client, command)
        started = time.monotonic()
        result = self._with_retry(lambda: method(*args, **kwargs))
        self._record(command, time.monotonic() - started)
        return transform(result) if transform is not None else result

    def trace_log(self) -> list[tuple[str, float]]:
        return list(self._trace_log)

    def reset_trace(self) -> None:
        self._trace_log.clear()

    def remember(self, key: str, ttl_seconds: int | None, producer: Callable):
        if key in self._memo:
            return self._memo[key]
        raw = self._commands.get(key)
        if raw is not None:
            value = None if raw == _empty_sentinel else json.loads(raw)
        else:
            value = producer()
            self._commands.set_collection(key, value, ttl_seconds)
            if not value:
                value = None
        self._memo[key] = value
        return value

    def forget(self, key: str) -> None:
        self._memo.pop(key, None)
        self._commands.delete(key)

    def clear_memo(self) -> None:
        self._memo.clear()

    def scan_keys(self, pattern: str, count: int = 200) -> list[str]:
        found = []
        cursor = 0
        while True:
            cursor, batch = self._run_command(
                "scan", cursor, match=self._commands._prefixed(pattern), count=count
            )
            found.extend(self._commands._unprefixed(_text(key)) for key in batch)
            if cursor == 0:
                return found

    def scope_key(self, scope: str, *parts) -> str:
        return ":".join([scope, *(str(part) for part in parts)])

    def clean_scope(self, scope: str) -> int:
        prefix = f"{scope}:"
        for memo_key in [key for key in self._memo if key.startswith(prefix)]:
            del self._memo[memo_key]
        found = self.scan_keys(f"{scope}:*")
        if found:
            self._commands.delete(*found)
        return len(found)

    def pipeline(self) -> XValkeyPipeline:
        return XValkeyPipeline(self)


class XValkeyPipeline:
    def __init__(self, owner: XValkey):
        self._owner = owner
        self._queued: list[tuple[str, tuple, dict, Callable | None]] = []
        self._commands = XValkeyCommands(
            self._queue_command, owner._commands._prefix
        )

    def __getattr__(self, name: str):
        if name.startswith("_"):
            raise AttributeError(name)
        if hasattr(self._commands, name):
            return getattr(self._commands, name)

        def queue_raw(*args, **kwargs):
            self._queued.append((name, args, kwargs, None))

        return queue_raw

    def _queue_command(self, command: str, *args, transform=None, **kwargs):
        self._queued.append((command, args, kwargs, transform))

    def execute(self) -> list:
        queued = self._queued
        self._queued = []

        def run():
            pipe = self._owner._client.pipeline()
            for command, args, kwargs, _ in queued:
                getattr(pipe, command)(*args, **kwargs)
            return pipe.execute()

        started = time.monotonic()
        results = self._owner._with_retry(run)
        commands = ",".join(dict.fromkeys(command for command, _, _, _ in queued))
        self._owner._record(
            f"pipeline[{len(queued)}]:{commands}", time.monotonic() - started
        )
        return [
            transform(result) if transform is not None else result
            for (_, _, _, transform), result in zip(queued, results)
        ]


load_project_env()

xvalkey = XValkey(
    url=os.environ.get("VALKEY_URL", "valkey://localhost:6379/0"),
    namespace=os.environ.get("VALKEY_NAMESPACE", ""),
    trace=os.environ.get("VALKEY_TRACE", "") == "1",
)
