"""
Kafka handlers for AI tasks:
- AI_INSIGHTS: generate insights for a dataset
- AI_WIDGET_BUILD: prompt → widget JSON config
- AI_NL_QUERY: natural language → SQL → result
- AI_GRAPH_SUGGESTIONS: suggest charts for a dataset
"""
from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def _update_ai_job(job_id: int, status: str, result: dict = None, error: str = '') -> None:
    from ai_engine.models import AIJob
    try:
        job = AIJob.objects.get(pk=job_id)
        job.status = status
        if result is not None:
            job.result = result
        if error:
            job.error_message = error
        job.save(update_fields=['status', 'result', 'error_message', 'updated_at'])
    except Exception as exc:
        logger.error("Failed to update AIJob %s: %s", job_id, exc)


def handle_ai_insights(payload: dict[str, Any]) -> None:
    """Generate auto insights for a dataset slug."""
    job_id = payload.get('job_id')
    dataset_slug = payload.get('dataset_slug')

    _update_ai_job(job_id, 'running')
    try:
        from ai_engine.services.insight_generator import generate_insights
        result = generate_insights(dataset_slug)
        _update_ai_job(job_id, 'done', result=result)
    except Exception as exc:
        logger.exception("AI insights failed for job %s: %s", job_id, exc)
        _update_ai_job(job_id, 'error', error=str(exc))
        raise


def handle_ai_widget_build(payload: dict[str, Any]) -> None:
    """Convert a user prompt into a widget config JSON."""
    job_id = payload.get('job_id')
    prompt = payload.get('prompt')
    dataset_slug = payload.get('dataset_slug')

    _update_ai_job(job_id, 'running')
    try:
        from ai_engine.services.widget_builder import build_widget
        result = build_widget(prompt, dataset_slug)
        _update_ai_job(job_id, 'done', result=result)
    except Exception as exc:
        logger.exception("AI widget build failed for job %s: %s", job_id, exc)
        _update_ai_job(job_id, 'error', error=str(exc))
        raise


def handle_ai_nl_query(payload: dict[str, Any]) -> None:
    """Convert natural language to SQL, run it, return rows + chart config."""
    job_id = payload.get('job_id')
    question = payload.get('question')
    dataset_slug = payload.get('dataset_slug')

    _update_ai_job(job_id, 'running')
    try:
        from ai_engine.services.nl_query_handler import handle_nl_query
        result = handle_nl_query(question, dataset_slug)
        _update_ai_job(job_id, 'done', result=result)
    except Exception as exc:
        logger.exception("AI NL query failed for job %s: %s", job_id, exc)
        _update_ai_job(job_id, 'error', error=str(exc))
        raise


def handle_ai_graph_suggestions(payload: dict[str, Any]) -> None:
    """Suggest chart types for a dataset based on column profiles."""
    job_id = payload.get('job_id')
    dataset_slug = payload.get('dataset_slug')

    _update_ai_job(job_id, 'running')
    try:
        from ai_engine.services.graph_suggester import suggest_graphs
        result = suggest_graphs(dataset_slug)
        _update_ai_job(job_id, 'done', result=result)
    except Exception as exc:
        logger.exception("AI graph suggestions failed for job %s: %s", job_id, exc)
        _update_ai_job(job_id, 'error', error=str(exc))
        raise
