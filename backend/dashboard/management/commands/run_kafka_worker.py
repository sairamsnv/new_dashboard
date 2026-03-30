"""
Management command: run the Redis Streams worker.

Name kept as run_kafka_worker for backwards compatibility with docker-compose commands.

Usage:
  python manage.py run_kafka_worker            # all topics
  python manage.py run_kafka_worker --worker ingest
  python manage.py run_kafka_worker --worker ai
"""
from __future__ import annotations

import logging
import os
import signal
import sys
import uuid

from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)


def _dispatch(payload: dict, topic: str) -> None:
    """Route a Redis Streams message to the correct handler by topic name."""
    from messaging import topics as T

    if topic == T.FILE_UPLOADED:
        from messaging.handlers.file_ingestion import handle_file_uploaded
        handle_file_uploaded(payload)
    elif topic == T.DB_CONNECTED:
        from messaging.handlers.file_ingestion import handle_db_connected
        handle_db_connected(payload)
    elif topic == T.AI_INSIGHTS:
        from messaging.handlers.ai_tasks import handle_ai_insights
        handle_ai_insights(payload)
    elif topic == T.AI_WIDGET_BUILD:
        from messaging.handlers.ai_tasks import handle_ai_widget_build
        handle_ai_widget_build(payload)
    elif topic == T.AI_NL_QUERY:
        from messaging.handlers.ai_tasks import handle_ai_nl_query
        handle_ai_nl_query(payload)
    elif topic == T.AI_GRAPH_SUGGESTIONS:
        from messaging.handlers.ai_tasks import handle_ai_graph_suggestions
        handle_ai_graph_suggestions(payload)
    else:
        logger.warning("Unknown topic in message: %s", topic)


def _run_worker(topics: list[str]) -> None:
    """Block forever, consuming Redis Streams messages and dispatching to handlers."""
    from messaging.redis_queue import (
        acknowledge,
        consume_one_batch,
        ensure_consumer_groups,
    )

    ensure_consumer_groups(topics)

    # Unique consumer name per process to support multiple worker replicas
    consumer_name = f"worker-{os.getpid()}-{uuid.uuid4().hex[:6]}"
    logger.info("Redis worker '%s' listening on: %s", consumer_name, topics)

    running = True

    def _stop(sig, frame):
        nonlocal running
        logger.info("Shutdown signal received.")
        running = False
        sys.exit(0)

    signal.signal(signal.SIGINT, _stop)
    signal.signal(signal.SIGTERM, _stop)

    while running:
        try:
            batch = consume_one_batch(topics, consumer_name=consumer_name, count=5)
            for topic, entry_id, payload in batch:
                try:
                    _dispatch(payload, topic)
                    acknowledge(topic, entry_id)
                except Exception as exc:
                    logger.exception("Handler error for topic %s: %s", topic, exc)
                    # Do NOT acknowledge — message stays in PEL for retry
        except Exception as exc:
            if running:
                logger.exception("Consumer loop error: %s", exc)


class Command(BaseCommand):
    help = "Run the Redis Streams worker for analytics jobs"

    def add_arguments(self, parser):
        parser.add_argument(
            "--worker",
            choices=["all", "ingest", "ai"],
            default="all",
            help="Topics to listen on (default: all)",
        )

    def handle(self, *args, **options):
        from messaging import topics as T

        worker = options["worker"]
        if worker == "ingest":
            selected = [T.FILE_UPLOADED, T.DB_CONNECTED]
        elif worker == "ai":
            selected = [T.AI_INSIGHTS, T.AI_WIDGET_BUILD, T.AI_NL_QUERY, T.AI_GRAPH_SUGGESTIONS]
        else:
            selected = T.ALL_TOPICS

        self.stdout.write(self.style.SUCCESS(
            f"Starting Redis worker ({worker}) on topics: {selected}"
        ))
        _run_worker(selected)
