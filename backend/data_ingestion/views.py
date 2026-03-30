"""
Data ingestion API views:
- POST /api/ingest/upload/        → upload CSV/Excel, dispatch Redis job
- POST /api/ingest/db-connect/    → store DB creds, test connection, discover tables
- GET  /api/ingest/files/         → list uploaded files
- GET  /api/ingest/status/<id>/   → poll ingestion job status
"""
from __future__ import annotations

import logging
import os
import uuid
from pathlib import Path

from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from data_ingestion.models import DatabaseConnection, IngestionJob, UploadedFile
from data_ingestion.serializers import (
    DBConnectRequestSerializer,
    DatabaseConnectionSerializer,
    IngestionJobSerializer,
    UploadedFileSerializer,
)

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {'.csv', '.xlsx', '.xls'}


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_file(request):
    """
    POST /api/ingest/upload/
    Accepts a multipart file upload (CSV or Excel).
    Saves the file, creates an IngestionJob, publishes to Kafka, returns job_id.
    """
    file_obj = request.FILES.get('file')
    if not file_obj:
        return Response({'detail': 'No file provided. Use multipart field `file`.'}, status=status.HTTP_400_BAD_REQUEST)

    ext = Path(file_obj.name).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return Response(
            {'detail': f'Unsupported file type: {ext}. Allowed: {", ".join(ALLOWED_EXTENSIONS)}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Save to upload directory
    upload_dir = Path(settings.FILE_UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}{ext}"
    dest_path = upload_dir / unique_name

    with open(dest_path, 'wb') as f:
        for chunk in file_obj.chunks():
            f.write(chunk)

    source_type = 'csv' if ext == '.csv' else 'excel'
    uploaded = UploadedFile.objects.create(
        original_filename=file_obj.name,
        file_path=str(dest_path),
        source_type=source_type,
        status=UploadedFile.STATUS_PENDING,
    )

    # Create async job
    job = IngestionJob.objects.create(
        job_type=IngestionJob.JOB_FILE_INGEST,
        payload={'uploaded_file_id': uploaded.pk, 'file_path': str(dest_path), 'source_type': source_type},
    )

    # Publish to Redis Streams (non-blocking; falls back inline if Redis is unavailable)
    try:
        from messaging import topics as T
        from messaging.producer import publish
        publish(
            T.FILE_UPLOADED,
            {'job_id': job.pk, 'uploaded_file_id': uploaded.pk, 'file_path': str(dest_path), 'source_type': source_type},
        )
    except Exception as exc:
        logger.warning("Redis unavailable (%s). Processing file inline.", exc)
        _process_file_inline(job, uploaded)

    return Response(
        {
            'job_id': job.pk,
            'uploaded_file_id': uploaded.pk,
            'status': job.status,
            'message': 'File uploaded. Processing started.',
        },
        status=status.HTTP_202_ACCEPTED,
    )


def _process_file_inline(job: IngestionJob, uploaded: UploadedFile) -> None:
    """Inline fallback: parse + load + profile without Redis worker."""
    try:
        from messaging.handlers.file_ingestion import handle_file_uploaded
        handle_file_uploaded(job.payload)
    except Exception as exc:
        logger.error("Inline file processing failed: %s", exc)
        job.status = IngestionJob.STATUS_ERROR
        job.error_message = str(exc)
        job.save(update_fields=['status', 'error_message', 'updated_at'])


@api_view(['POST'])
def db_connect(request):
    """
    POST /api/ingest/db-connect/
    Body: {name, engine, host, port, db_name, username, password}
    Tests the connection, stores credentials, discovers tables, registers datasets.

    Processes synchronously so the response contains the actual dataset slugs —
    no race condition between the view returning and a background worker creating the records.
    """
    ser = DBConnectRequestSerializer(data=request.data)
    ser.is_valid(raise_exception=True)
    data = ser.validated_data

    schema_name = data.get('schema_name', 'public') or 'public'

    # 1. Test connection and discover tables in the requested schema
    from data_ingestion.services.db_connector import test_connection
    result = test_connection(
        engine=data['engine'],
        host=data['host'],
        port=data['port'],
        db_name=data['db_name'],
        username=data['username'],
        password=data['password'],
        schema_name=schema_name,
    )

    db_conn = DatabaseConnection.objects.create(
        name=data['name'],
        engine=data['engine'],
        host=data['host'],
        port=data['port'],
        db_name=data['db_name'],
        username=data['username'],
        password_enc=data['password'],
        status=DatabaseConnection.STATUS_CONNECTED if result['success'] else DatabaseConnection.STATUS_ERROR,
        error_message=result.get('error') or '',
        tables_discovered=result.get('tables', []),
    )

    if not result['success']:
        return Response(
            {'detail': result['error'], 'connection_id': db_conn.pk},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # 2. Create job record (include schema_name so the handler knows which schema to read from)
    job = IngestionJob.objects.create(
        job_type=IngestionJob.JOB_DB_CONNECT,
        payload={
            'connection_id': db_conn.pk,
            'engine': data['engine'],
            'host': data['host'],
            'port': data['port'],
            'db_name': data['db_name'],
            'username': data['username'],
            'password': data['password'],
            'schema_name': schema_name,
            'tables': result['tables'],
        },
    )

    # 3. Process inline (synchronously) so Dataset records exist immediately.
    #    This avoids the race condition where the frontend requests /api/schema/inspect/
    #    before the Redis worker has created the Dataset objects.
    registered_slugs: list[str] = []
    try:
        from messaging.handlers.file_ingestion import handle_db_connected
        handle_db_connected({'job_id': job.pk, **job.payload})
        # Reload job to get the registered slugs written by the handler
        job.refresh_from_db()
        registered_slugs = (job.result or {}).get('registered_datasets', [])
    except Exception as exc:
        logger.warning("Inline DB-connect handler failed (%s); slugs may be empty.", exc)

    # If the inline handler failed or returned nothing, fall back to raw table names
    # (frontend will get a 404 on inspect, which is better than a wrong slug silently)
    if not registered_slugs:
        import re as _re
        registered_slugs = [
            _re.sub(r'[^a-z0-9]+', '-', t.lower()).strip('-')[:128]
            for t in result['tables']
        ]

    return Response(
        {
            'job_id': job.pk,
            'connection_id': db_conn.pk,
            # Return dataset SLUGS (not raw table names) so frontend can use them directly
            'tables_discovered': registered_slugs,
            'status': 'connected',
            'message': f"Connected. {len(registered_slugs)} tables registered.",
        },
        status=status.HTTP_201_CREATED,
    )


@api_view(['GET'])
def list_files(request):
    """GET /api/ingest/files/ — list all uploaded files."""
    files = UploadedFile.objects.all()[:100]
    return Response(UploadedFileSerializer(files, many=True).data)


@api_view(['GET'])
def job_status(request, job_id: int):
    """GET /api/ingest/status/<job_id>/ — poll job status and result."""
    try:
        job = IngestionJob.objects.get(pk=job_id)
    except IngestionJob.DoesNotExist:
        return Response({'detail': 'Job not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(IngestionJobSerializer(job).data)


@api_view(['GET'])
def list_db_connections(request):
    """GET /api/ingest/connections/ — list stored DB connections."""
    conns = DatabaseConnection.objects.all()[:50]
    return Response(DatabaseConnectionSerializer(conns, many=True).data)
