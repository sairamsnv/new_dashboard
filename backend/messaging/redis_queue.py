"""
Redis Streams-based job queue — replaces Kafka.

Why Redis Streams over Kafka:
  - 1 container instead of 3 (Zookeeper + Kafka + Kafka UI)
  - ~500MB RAM instead of ~2GB
  - No partition rebalancing delays
  - No offset reset issues on restart (consumer group tracks position natively)
  - Built-in result caching via Redis hash

Stream naming:  stream:{topic}   e.g.  stream:file-uploaded
Consumer group: analytics-workers (same as before)

Producer: XADD  — append message to stream
Consumer: XREADGROUP — blocking read, acknowledges on success
Cache:    SETEX  — store job result for 1 hour (3600s)
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

CONSUMER_GROUP = "analytics-workers"
STREAM_PREFIX = "stream:"
RESULT_TTL_SECONDS = 3600  # cache AI results for 1 hour
BLOCK_MS = 5000            # blocking read timeout

_redis_client = None


def _get_redis():
    """
    Lazy singleton Redis client with automatic reconnection.

    redis-py's from_url() does NOT open a connection immediately — the pool
    connects on first command.  If that first command fails (e.g. DNS not yet
    ready during container startup) we reset the singleton so the next call
    creates a fresh pool and retries the DNS lookup.
    """
    global _redis_client
    if _redis_client is None:
        import redis as _redis

        url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
        _redis_client = _redis.from_url(url, decode_responses=True)
        logger.info("Redis client connected to %s", url)
    return _redis_client


def _reset_redis():
    """Discard the cached client so the next _get_redis() call creates a new one."""
    global _redis_client
    try:
        if _redis_client:
            _redis_client.close()
    except Exception:
        pass
    _redis_client = None


def _stream_key(topic: str) -> str:
    return f"{STREAM_PREFIX}{topic}"


# ─── Producer ────────────────────────────────────────────────────────────────

def publish(topic: str, message: dict[str, Any]) -> str:
    """
    Publish a message to a Redis Stream.
    All values are JSON-serialised because Redis Streams store strings.

    Returns the stream entry ID (e.g. '1700000000000-0').
    """
    r = _get_redis()
    key = _stream_key(topic)

    # Redis Streams store flat string key-value pairs — wrap payload as JSON
    entry = {"payload": json.dumps(message, default=str)}
    entry_id = r.xadd(key, entry)
    logger.debug("Published to %s entry_id=%s", key, entry_id)
    return entry_id


# ─── Consumer group bootstrap ────────────────────────────────────────────────

def ensure_consumer_groups(topics: list[str], max_retries: int = 10, retry_delay: float = 2.0) -> None:
    """
    Create consumer groups for each topic stream if they don't exist yet.
    Uses '$' as start ID so the group only reads NEW messages (no backlog replay).

    Retries up to max_retries times with retry_delay seconds between attempts.
    This handles the common Docker startup race where Redis DNS isn't ready
    the instant the worker container starts.
    """
    import time

    for attempt in range(1, max_retries + 1):
        try:
            r = _get_redis()
            for topic in topics:
                key = _stream_key(topic)
                try:
                    r.xgroup_create(key, CONSUMER_GROUP, id="$", mkstream=True)
                    logger.info("Created consumer group '%s' for stream '%s'", CONSUMER_GROUP, key)
                except Exception as exc:
                    if "BUSYGROUP" in str(exc):
                        logger.debug("Consumer group already exists for '%s' — OK", key)
                    else:
                        raise  # re-raise so the outer retry catches it
            return  # all groups created (or already existed)
        except Exception as exc:
            _reset_redis()  # discard broken pool so next attempt makes a fresh connection
            if attempt < max_retries:
                logger.warning(
                    "ensure_consumer_groups attempt %d/%d failed (%s). Retrying in %.0fs…",
                    attempt, max_retries, exc, retry_delay,
                )
                time.sleep(retry_delay)
            else:
                logger.error(
                    "ensure_consumer_groups failed after %d attempts: %s",
                    max_retries, exc,
                )


# ─── Consumer ────────────────────────────────────────────────────────────────

def consume_one_batch(
    topics: list[str],
    consumer_name: str,
    count: int = 5,
) -> list[tuple[str, str, dict]]:
    """
    Blocking read of up to `count` messages across all topic streams.

    Returns list of (topic, entry_id, payload_dict).
    Blocks for BLOCK_MS ms if no messages available (non-busy wait).
    """
    r = _get_redis()
    streams = {_stream_key(t): ">" for t in topics}

    try:
        results = r.xreadgroup(
            CONSUMER_GROUP,
            consumer_name,
            streams,
            count=count,
            block=BLOCK_MS,
        )
    except Exception as exc:
        logger.debug("xreadgroup error: %s", exc)
        return []

    if not results:
        return []

    messages = []
    for stream_key, entries in results:
        # Strip 'stream:' prefix to recover topic name
        topic = stream_key.removeprefix(STREAM_PREFIX)
        for entry_id, fields in entries:
            try:
                payload = json.loads(fields.get("payload", "{}"))
                messages.append((topic, entry_id, payload))
            except json.JSONDecodeError as exc:
                logger.error("Bad JSON in stream %s entry %s: %s", stream_key, entry_id, exc)
    return messages


def acknowledge(topic: str, entry_id: str) -> None:
    """Acknowledge a processed message (removes it from the PEL)."""
    r = _get_redis()
    r.xack(_stream_key(topic), CONSUMER_GROUP, entry_id)


# ─── Result cache ─────────────────────────────────────────────────────────────

def cache_result(key: str, result: dict[str, Any], ttl: int = RESULT_TTL_SECONDS) -> None:
    """Store a job result in Redis for fast repeated reads."""
    r = _get_redis()
    r.setex(f"result:{key}", ttl, json.dumps(result, default=str))


def get_cached_result(key: str) -> dict[str, Any] | None:
    """Return a cached result or None if missing / expired."""
    r = _get_redis()
    raw = r.get(f"result:{key}")
    if raw:
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return None
    return None


def close() -> None:
    """Close the Redis connection (call on worker shutdown)."""
    global _redis_client
    if _redis_client:
        _redis_client.close()
        _redis_client = None
