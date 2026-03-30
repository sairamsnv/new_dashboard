"""
Message producer — publishes async jobs to Redis Streams.
All Django views call publish() to dispatch work without blocking HTTP.
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def publish(topic: str, message: dict[str, Any]) -> str:
    """
    Publish a JSON message to the given Redis Stream topic.
    Returns the Redis stream entry ID.
    Raises an exception if Redis is unreachable (caller should handle gracefully).
    """
    from messaging.redis_queue import publish as _redis_publish
    entry_id = _redis_publish(topic, message)
    logger.debug("Published to topic=%s entry_id=%s", topic, entry_id)
    return entry_id


def close() -> None:
    from messaging.redis_queue import close as _redis_close
    _redis_close()
