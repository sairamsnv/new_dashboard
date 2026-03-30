"""
Column profiling for registered datasets.

Primary path (file upload): Uses DuckDB SUMMARIZE on a Polars DataFrame for
a single-pass, in-process computation of all stats — no per-column SQL round-trips.

Fallback path (DB-connected datasets): Reads from information_schema + pg_stats,
same as before but only triggered when no DataFrame is available.
"""
from __future__ import annotations

import logging
from typing import Any

import duckdb
import polars as pl
from django.db import connection, transaction
from django.utils import timezone

from dashboard_meta.models import ColumnMeta, Dataset
from dashboard_meta.services.widget_resolver import resolve_widget_type, suggest_column_role

logger = logging.getLogger(__name__)


# ─── DuckDB path (fast, used for file uploads) ───────────────────────────────

def _duck_summarize(df: pl.DataFrame) -> dict[str, dict]:
    """
    Run DuckDB SUMMARIZE on a Polars DataFrame.
    Returns a dict keyed by column name with stats: min, max, approx_unique,
    null_percentage, mean, std, q25, q50, q75.
    """
    conn = duckdb.connect()
    try:
        conn.register("df", df)
        rows = conn.execute("SUMMARIZE df").fetchall()
        col_names_duckdb = [desc[0] for desc in conn.execute("SUMMARIZE df").description]
    finally:
        conn.close()

    result: dict[str, dict] = {}
    for row in rows:
        rec = dict(zip(col_names_duckdb, row))
        col_name = rec.get("column_name") or rec.get("column_id", "")
        result[str(col_name)] = rec
    return result


def _classify_polars_dtype(dtype: pl.DataType) -> str:
    if isinstance(dtype, (pl.Date, pl.Datetime, pl.Time, pl.Duration)):
        return "datetime"
    if isinstance(dtype, pl.Boolean):
        return "boolean"
    if isinstance(dtype, (
        pl.Int8, pl.Int16, pl.Int32, pl.Int64,
        pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
        pl.Float32, pl.Float64, pl.Decimal,
    )):
        return "numeric"
    return "text"


def _widget_hint(dtype: str, cardinality: int | None) -> str:
    if dtype == "datetime":
        return "line_chart"
    if dtype == "boolean":
        return "pie_chart"
    if dtype == "numeric":
        return "histogram"
    if dtype == "text":
        if cardinality is not None and cardinality <= 20:
            return "bar_chart"
        return "table"
    return "table"


def _safe_float(val: Any) -> float | None:
    try:
        return round(float(val), 4) if val is not None else None
    except (TypeError, ValueError):
        return None


def profile_dataset_from_dataframe(dataset: Dataset, df: pl.DataFrame) -> Dataset:
    """
    Profile columns using DuckDB SUMMARIZE on a Polars DataFrame.
    This is the primary path for file uploads — single pass, very fast.
    """
    duck_stats = _duck_summarize(df)
    total_rows = len(df)

    column_dicts: list[dict] = []
    with transaction.atomic():
        ColumnMeta.objects.filter(dataset=dataset).delete()

        for col in df.columns:
            dtype_str = _classify_polars_dtype(df[col].dtype)
            stats = duck_stats.get(col, {})

            # DuckDB SUMMARIZE fields
            null_pct_raw = stats.get("null_percentage") or stats.get("null%") or 0.0
            try:
                null_pct = float(null_pct_raw)
            except (TypeError, ValueError):
                null_pct = 0.0
            null_rate = null_pct / 100.0

            approx_unique_raw = stats.get("approx_unique") or stats.get("approx_count_distinct")
            try:
                cardinality = int(approx_unique_raw) if approx_unique_raw is not None else df[col].n_unique()
            except (TypeError, ValueError):
                cardinality = df[col].n_unique()

            is_dimension = dtype_str in ("text", "boolean") and cardinality <= 100
            widget_hint = _widget_hint(dtype_str, cardinality)

            col_dict = {"dtype": dtype_str, "cardinality": cardinality, "col_name": col}
            suggest_column_role(col_dict)

            ColumnMeta.objects.create(
                dataset=dataset,
                col_name=col,
                pg_type=str(df[col].dtype),
                dtype=dtype_str,
                null_rate=null_rate,
                cardinality=cardinality,
                is_dimension=is_dimension,
                suggested_widget=widget_hint,
            )
            column_dicts.append(col_dict)

        suggested_type = resolve_widget_type(column_dicts)
        dataset.suggested_widget_type = suggested_type
        dataset.row_count = total_rows
        dataset.profiled_at = timezone.now()
        fields = ["suggested_widget_type", "profiled_at", "updated_at"]
        if hasattr(dataset, "row_count"):
            fields.append("row_count")
        dataset.save(update_fields=["suggested_widget_type", "profiled_at", "updated_at"])

    logger.info(
        "Profiled dataset %s via DuckDB: %d columns, %d rows",
        dataset.slug, len(column_dicts), total_rows,
    )
    return dataset


# ─── Postgres path (fallback for DB-connected datasets) ──────────────────────

def _classify_dtype(data_type: str, udt_name: str) -> str:
    t = (data_type or "").lower()
    u = (udt_name or "").lower()
    combined = f"{t} {u}"
    if "timestamp" in combined or combined.startswith("date"):
        return "datetime"
    if u == "bool" or t == "boolean":
        return "boolean"
    if any(x in combined for x in ("int", "numeric", "decimal", "double", "real", "float", "serial", "money")):
        return "numeric"
    if "char" in combined or "text" in combined or "varchar" in combined:
        return "text"
    return "unknown"


def _quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def profile_dataset(dataset: Dataset) -> Dataset:
    """
    Fallback profiler for DB-connected datasets (no DataFrame available).
    Uses information_schema + pg_stats + targeted SQL queries.
    Falls back to this only when a Polars DataFrame is not available.
    """
    schema = dataset.schema_name
    table = dataset.table_name

    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT column_name, data_type, udt_name
            FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
            ORDER BY ordinal_position
            """,
            [schema, table],
        )
        info_rows = cursor.fetchall()

    if not info_rows:
        raise ValueError(f"No columns found for {schema}.{table}")

    # pg_stats for fast approximate stats
    stats: dict[str, tuple] = {}
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT attname, n_distinct, null_frac
            FROM pg_stats
            WHERE schemaname = %s AND tablename = %s
            """,
            [schema, table],
        )
        for attname, n_distinct, null_frac in cursor.fetchall():
            stats[attname] = (n_distinct, null_frac)

    column_dicts: list[dict] = []
    with transaction.atomic():
        ColumnMeta.objects.filter(dataset=dataset).delete()

        for col_name, data_type, udt_name in info_rows:
            dtype = _classify_dtype(data_type, udt_name)
            n_distinct, null_frac = stats.get(col_name, (None, None))

            cardinality = None
            if n_distinct is not None and float(n_distinct) >= 0:
                cardinality = int(float(n_distinct))

            null_rate = float(null_frac) if null_frac is not None else 0.0
            is_dimension = dtype in ("text", "boolean") and (cardinality is None or cardinality <= 100)
            widget_hint = _widget_hint(dtype, cardinality)

            col_dict = {"dtype": dtype, "cardinality": cardinality, "col_name": col_name}
            suggest_column_role(col_dict)

            ColumnMeta.objects.create(
                dataset=dataset,
                col_name=col_name,
                pg_type=f"{data_type} ({udt_name})",
                dtype=dtype,
                null_rate=null_rate,
                cardinality=cardinality,
                is_dimension=is_dimension,
                suggested_widget=widget_hint,
            )
            column_dicts.append(col_dict)

        suggested_type = resolve_widget_type(column_dicts)
        dataset.suggested_widget_type = suggested_type
        dataset.profiled_at = timezone.now()
        dataset.save(update_fields=["suggested_widget_type", "profiled_at", "updated_at"])

    return dataset


# ─── Backwards-compat shim ───────────────────────────────────────────────────

def profile_dataframe_columns(dataset: Dataset, df) -> None:
    """
    Backwards-compatible entry point that accepts either a Polars or pandas DataFrame.
    Routes to the DuckDB-powered profiler when possible.
    """
    if isinstance(df, pl.DataFrame):
        profile_dataset_from_dataframe(dataset, df)
    else:
        # pandas DataFrame — convert to Polars for DuckDB path
        try:
            pl_df = pl.from_pandas(df)
            profile_dataset_from_dataframe(dataset, pl_df)
        except Exception as exc:
            logger.warning("Could not convert pandas→Polars for profiling (%s), using fallback", exc)
            profile_dataset(dataset)


def table_exists(schema: str, table: str) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = %s AND table_name = %s
            )
            """,
            [schema, table],
        )
        row = cursor.fetchone()
    return bool(row and row[0])


def preview_row_count(schema: str, table: str) -> int:
    q_schema = _quote_ident(schema)
    q_table = _quote_ident(table)
    with connection.cursor() as cursor:
        cursor.execute(f"SELECT COUNT(*) FROM {q_schema}.{q_table}")
        return int(cursor.fetchone()[0])
