"""
Redis Streams consumer factory.
Each worker process calls run_consumer() for its assigned topics,
dispatches to registered handler functions, and acknowledges on success.
"""
from __future__ import annotations

import logging
import signal
import sys
from typing import Callable

logger = logging.getLogger(__name__)

HandlerFn = Callable[[dict], None]


def run_consumer(
    topics: list[str],
    handler: HandlerFn,
    group_id: str = "analytics-workers",
    consumer_name: str = "worker-0",
) -> None:
    """
    Block forever, consuming messages from Redis Streams `topics` and dispatching to `handler`.
    Handles graceful shutdown on SIGINT / SIGTERM.
    """
    from messaging.redis_queue import (
        acknowledge,
        consume_one_batch,
        ensure_consumer_groups,
    )

    ensure_consumer_groups(topics)

    running = True

    def _shutdown(signum, frame):
        nonlocal running
        logger.info("Shutdown signal received — stopping consumer.")
        running = False
        sys.exit(0)

    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    logger.info("Redis consumer started. Listening on topics: %s", topics)

    while running:
        try:
            batch = consume_one_batch(topics, consumer_name=consumer_name)
            for topic, entry_id, payload in batch:
                logger.info("Received message from topic=%s entry_id=%s", topic, entry_id)
                try:
                    handler(payload)
                    acknowledge(topic, entry_id)
                except Exception as exc:
                    logger.exception("Handler error for topic %s: %s", topic, exc)
        except Exception as exc:
            if running:
                logger.exception("Consumer poll error: %s", exc)
