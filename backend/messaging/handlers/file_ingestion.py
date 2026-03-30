"""
Worker handler: FILE_UPLOADED and DB_CONNECTED topics.

FILE_UPLOADED pipeline:
  Polars reads file → load to analytics_dashboard PG → DuckDB SUMMARIZE profile

DB_CONNECTED pipeline (ideal path — same as file upload):
  Polars reads sample from external DB (connectorx) → load to analytics_dashboard PG
  as a shadow table → DuckDB SUMMARIZE profile → same AI insights as file uploads

Both paths produce a Dataset with profiled ColumnMeta records, making them
interchangeable for the Insights, Charts, and Dashboard features.
"""
from __future__ import annotations

import logging
import re
import uuid
from pathlib import Path
from typing import Any

import django

logger = logging.getLogger(__name__)


def handle_file_uploaded(payload: dict[str, Any]) -> None:
    """
    Called by the Kafka consumer when a FILE_UPLOADED message arrives.
    Payload keys: job_id, uploaded_file_id, file_path, source_type
    """
    job_id = payload.get('job_id')
    file_id = payload.get('uploaded_file_id')
    file_path = payload.get('file_path')
    source_type = payload.get('source_type', 'csv')

    from data_ingestion.models import IngestionJob, UploadedFile

    job = IngestionJob.objects.get(pk=job_id)
    uploaded = UploadedFile.objects.get(pk=file_id)

    job.status = IngestionJob.STATUS_RUNNING
    job.save(update_fields=['status', 'updated_at'])
    uploaded.status = UploadedFile.STATUS_PROCESSING
    uploaded.save(update_fields=['status', 'updated_at'])

    try:
        from data_ingestion.services.file_parser import (
            extract_schema_from_df,
            load_dataframe_to_postgres,
            parse_csv,
            parse_excel,
        )

        # Step 1: Parse file
        df = parse_csv(file_path) if source_type == 'csv' else parse_excel(file_path)

        # Step 2: Create a unique PG table name
        table_name = _make_table_name(Path(file_path).stem)

        # Step 3: Load into PostgreSQL
        row_count = load_dataframe_to_postgres(df, table_name)

        # Step 4: Register as Dataset + profile columns via DuckDB (in-process, fast)
        from dashboard_meta.models import Dataset
        from dashboard_meta.services.column_profiler import profile_dataset_from_dataframe

        slug = _make_slug(table_name)
        # Remove existing dataset with same table to allow re-uploads
        Dataset.objects.filter(table_name=table_name).delete()

        ds = Dataset.objects.create(
            slug=slug,
            name=uploaded.original_filename,
            schema_name='public',
            table_name=table_name,
            owner='upload',
        )
        # Pass the Polars DataFrame directly — DuckDB SUMMARIZE profiles all columns in 1 query
        profile_dataset_from_dataframe(ds, df)

        # Step 5: Update records
        uploaded.status = UploadedFile.STATUS_READY
        uploaded.row_count = row_count
        uploaded.col_count = len(df.columns)
        uploaded.dataset_slug = ds.slug
        uploaded.save(update_fields=['status', 'row_count', 'col_count', 'dataset_slug', 'updated_at'])

        job.status = IngestionJob.STATUS_DONE
        job.result = {
            'dataset_slug': ds.slug,
            'table_name': table_name,
            'row_count': row_count,
            'col_count': len(df.columns),
        }
        job.save(update_fields=['status', 'result', 'updated_at'])

        logger.info("File %s loaded as table %s (%d rows)", file_path, table_name, row_count)

    except Exception as exc:
        logger.exception("File ingestion failed for job %s: %s", job_id, exc)
        uploaded.status = UploadedFile.STATUS_ERROR
        uploaded.error_message = str(exc)
        uploaded.save(update_fields=['status', 'error_message', 'updated_at'])
        job.status = IngestionJob.STATUS_ERROR
        job.error_message = str(exc)
        job.save(update_fields=['status', 'error_message', 'updated_at'])
        raise


def _make_table_name(stem: str) -> str:
    slug = re.sub(r'[^a-z0-9]+', '_', stem.lower()).strip('_')
    if not slug or slug[0].isdigit():
        slug = f'ds_{slug}'
    return f'upload_{slug}_{uuid.uuid4().hex[:6]}'


def _make_slug(table_name: str) -> str:
    return table_name.replace('_', '-')[:128]


def _make_db_shadow_table(table_name: str) -> str:
    """Shadow table name in analytics_dashboard PG — mirrors file upload naming."""
    slug = re.sub(r'[^a-z0-9]+', '_', table_name.lower()).strip('_')
    if not slug or slug[0].isdigit():
        slug = f'ds_{slug}'
    return f'dbconn_{slug}_{uuid.uuid4().hex[:6]}'


def handle_db_connected(payload: dict[str, Any]) -> None:
    """
    Ideal DB-connect pipeline — identical to file uploads:

      1. Polars reads up to 50 000 rows from each external table via connectorx
         (pure-Rust Arrow transfer — same speed as reading a local Parquet file)
      2. Shadow table written to analytics_dashboard PostgreSQL
         (same load_dataframe_to_postgres() used by file uploads)
      3. DuckDB SUMMARIZE profiles all columns in one pass
         (same profile_dataset_from_dataframe() used by file uploads)
      4. Dataset + ColumnMeta records created → Insights / Charts / Dashboard ready

    Fallback: if connectorx / Polars read fails for a table (e.g. unsupported type,
    permission denied) we fall back to the old information_schema-only registration
    so the table still appears in the UI — just without AI-ready stats.
    """
    job_id      = payload.get('job_id')
    tables      = payload.get('tables', [])
    engine      = payload.get('engine')
    host        = payload.get('host')
    port        = payload.get('port')
    db_name     = payload.get('db_name')
    username    = payload.get('username')
    password    = payload.get('password')
    schema_name = payload.get('schema_name', 'public') or 'public'

    from data_ingestion.models import IngestionJob
    from dashboard_meta.models import Dataset
    from dashboard_meta.services.column_profiler import (
        profile_dataset,
        profile_dataset_from_dataframe,
    )
    from data_ingestion.services.db_connector import read_table_sample
    from data_ingestion.services.file_parser import (
        _sanitize_columns,
        load_dataframe_to_postgres,
    )

    job = IngestionJob.objects.get(pk=job_id)
    job.status = IngestionJob.STATUS_RUNNING
    job.save(update_fields=['status', 'updated_at'])

    # ── Session cleanup: remove ALL previous datasets from this host ──────────
    # This ensures every new DB connect starts with a clean slate.
    # Old shadow tables are dropped from analytics_dashboard too.
    owner_prefix = f'{engine}:{host}'
    stale = Dataset.objects.filter(owner=owner_prefix)
    if stale.exists():
        from django.db import connection as _conn
        stale_tables = list(stale.values_list('table_name', flat=True))
        logger.info(
            "Session cleanup: removing %d stale datasets from '%s' (tables: %s)",
            stale.count(), owner_prefix, stale_tables,
        )
        with _conn.cursor() as cur:
            for t in stale_tables:
                try:
                    cur.execute(f'DROP TABLE IF EXISTS public."{t}"')
                except Exception:
                    pass
        stale.delete()

    registered = []
    try:
        for table in tables[:20]:  # cap at 20 tables per connection
            # Use a STABLE slug (no UUID) that encodes schema+table so tables from
            # different schemas don't collide (e.g. wms_test.orders vs public.orders)
            fqn = f"{schema_name}.{table}" if schema_name != "public" else table
            stable_slug = 'dbconn-' + re.sub(r'[^a-z0-9]+', '-', fqn.lower()).strip('-')[:100]

            # Generate the shadow table name ONCE — both slug and table_name use it
            shadow_table = _make_db_shadow_table(table)
            slug = stable_slug  # use stable slug for the Dataset record

            # ── Fast path: Polars → shadow PG table → DuckDB profile ──────────
            try:
                df = read_table_sample(
                    engine, host, int(port), db_name, username, password,
                    table, schema_name=schema_name,
                )
                df = _sanitize_columns(df)         # make col names PG-safe

                load_dataframe_to_postgres(df, shadow_table)

                ds = Dataset.objects.create(
                    slug=slug,
                    # name shows the original source for display purposes
                    name=f"{schema_name}.{table}" if schema_name != "public" else table,
                    # shadow table is always created in 'public' schema of analytics_dashboard
                    schema_name='public',
                    table_name=shadow_table,
                    owner=f'{engine}:{host}',
                )
                profile_dataset_from_dataframe(ds, df)  # DuckDB SUMMARIZE

                logger.info(
                    "DB table '%s.%s' ingested: %d rows, %d cols → shadow table '%s'",
                    schema_name, table, len(df), len(df.columns), shadow_table,
                )

            except Exception as fast_exc:
                # ── Fallback: register with schema metadata only ───────────────
                logger.warning(
                    "Fast path failed for table '%s.%s' (%s). "
                    "Falling back to information_schema registration.",
                    schema_name, table, fast_exc,
                )
                if not Dataset.objects.filter(slug=stable_slug).exists():
                    ds = Dataset.objects.create(
                        slug=stable_slug,
                        name=f"{schema_name}.{table}" if schema_name != "public" else table,
                        schema_name='public',
                        table_name=table,
                        owner=f'{engine}:{host}',
                    )
                    try:
                        profile_dataset(ds)  # information_schema fallback
                    except Exception:
                        pass                 # still register even without profile
                slug = stable_slug

            registered.append(slug)

        job.status = IngestionJob.STATUS_DONE
        job.result = {'registered_datasets': registered}
        job.save(update_fields=['status', 'result', 'updated_at'])

    except Exception as exc:
        logger.exception("DB connect handler failed for job %s: %s", job_id, exc)
        job.status = IngestionJob.STATUS_ERROR
        job.error_message = str(exc)
        job.save(update_fields=['status', 'error_message', 'updated_at'])
        raise
