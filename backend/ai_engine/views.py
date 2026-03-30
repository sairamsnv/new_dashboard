"""
AI Engine API views:
- POST /api/ai/insights/           → auto insights for a dataset (async via Redis)
- POST /api/ai/graph-suggestions/  → ranked chart suggestions (async via Redis)
- POST /api/ai/nl-query/           → natural language → SQL → results (sync or async)
- POST /api/ai/widget-build/       → prompt → widget JSON (sync or async)
- GET  /api/ai/jobs/<id>/          → poll AI job status
"""
from __future__ import annotations

import logging

from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from ai_engine.models import AIJob

logger = logging.getLogger(__name__)


def _create_ai_job(job_type: str, payload: dict) -> AIJob:
    return AIJob.objects.create(job_type=job_type, payload=payload)


def _dispatch_or_inline(job: AIJob, handler_fn) -> None:
    """Publish to Redis Streams; fall back to inline processing if Redis unavailable."""
    from messaging import topics as T
    topic_map = {
        AIJob.TYPE_INSIGHTS: T.AI_INSIGHTS,
        AIJob.TYPE_GRAPH_SUGGESTIONS: T.AI_GRAPH_SUGGESTIONS,
        AIJob.TYPE_NL_QUERY: T.AI_NL_QUERY,
        AIJob.TYPE_WIDGET_BUILD: T.AI_WIDGET_BUILD,
    }
    topic = topic_map.get(job.job_type)

    try:
        from messaging.producer import publish
        publish(topic, {'job_id': job.pk, **job.payload})
    except Exception as exc:
        logger.warning("Redis unavailable (%s). Running AI task inline.", exc)
        try:
            handler_fn({'job_id': job.pk, **job.payload})
        except Exception as inline_exc:
            logger.error("Inline AI task failed: %s", inline_exc)


@api_view(['POST'])
def ai_insights(request):
    """
    POST /api/ai/insights/
    Body: {dataset_slug: str}
    Returns job_id. Poll /api/ai/jobs/<id>/ for results.
    """
    dataset_slug = request.data.get('dataset_slug')
    if not dataset_slug:
        return Response({'detail': '`dataset_slug` is required.'}, status=status.HTTP_400_BAD_REQUEST)

    job = _create_ai_job(AIJob.TYPE_INSIGHTS, {'dataset_slug': dataset_slug})

    from messaging.handlers.ai_tasks import handle_ai_insights
    _dispatch_or_inline(job, handle_ai_insights)

    job.refresh_from_db()
    return Response(
        {'job_id': job.pk, 'status': job.status, 'result': job.result if job.status == 'done' else None},
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['POST'])
def ai_graph_suggestions(request):
    """
    POST /api/ai/graph-suggestions/
    Body: {dataset_slug: str}
    """
    dataset_slug = request.data.get('dataset_slug')
    if not dataset_slug:
        return Response({'detail': '`dataset_slug` is required.'}, status=status.HTTP_400_BAD_REQUEST)

    job = _create_ai_job(AIJob.TYPE_GRAPH_SUGGESTIONS, {'dataset_slug': dataset_slug})

    from messaging.handlers.ai_tasks import handle_ai_graph_suggestions
    _dispatch_or_inline(job, handle_ai_graph_suggestions)

    job.refresh_from_db()
    return Response(
        {'job_id': job.pk, 'status': job.status, 'result': job.result if job.status == 'done' else None},
        status=status.HTTP_202_ACCEPTED,
    )


@api_view(['POST'])
def ai_nl_query(request):
    """
    POST /api/ai/nl-query/
    Body: {question: str, dataset_slug: str}
    Runs synchronously (fast enough for interactive use).
    """
    question = request.data.get('question', '').strip()
    dataset_slug = request.data.get('dataset_slug', '').strip()

    if not question:
        return Response({'detail': '`question` is required.'}, status=status.HTTP_400_BAD_REQUEST)
    if not dataset_slug:
        return Response({'detail': '`dataset_slug` is required.'}, status=status.HTTP_400_BAD_REQUEST)

    from ai_engine.services.nl_query_handler import handle_nl_query
    try:
        result = handle_nl_query(question, dataset_slug)
    except Exception as exc:
        logger.exception("NL query error: %s", exc)
        return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    if 'error' in result:
        return Response(result, status=status.HTTP_400_BAD_REQUEST)
    return Response(result)


@api_view(['POST'])
def ai_widget_build(request):
    """
    POST /api/ai/widget-build/
    Body: {prompt: str, dataset_slug?: str}
    Runs synchronously for real-time chat UX.
    """
    prompt = request.data.get('prompt', '').strip()
    dataset_slug = request.data.get('dataset_slug', '').strip() or None

    if not prompt:
        return Response({'detail': '`prompt` is required.'}, status=status.HTTP_400_BAD_REQUEST)

    from ai_engine.services.widget_builder import build_widget
    try:
        widget = build_widget(prompt, dataset_slug)
    except Exception as exc:
        logger.exception("Widget build error: %s", exc)
        return Response({'detail': str(exc)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response(widget)


@api_view(['GET'])
def ai_job_status(request, job_id: int):
    """GET /api/ai/jobs/<job_id>/ — poll AI job status."""
    try:
        job = AIJob.objects.get(pk=job_id)
    except AIJob.DoesNotExist:
        return Response({'detail': 'Job not found.'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'job_id': job.pk,
        'job_type': job.job_type,
        'status': job.status,
        'result': job.result if job.status == 'done' else None,
        'error': job.error_message if job.status == 'error' else None,
        'created_at': job.created_at,
        'updated_at': job.updated_at,
    })
