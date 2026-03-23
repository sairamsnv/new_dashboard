"""
PostgreSQL column profiling for registered datasets (information_schema + pg_stats).
Uses the default DB connection (same host as WMS operational tables).
"""

from __future__ import annotations

from django.db import connection, transaction
from django.utils import timezone

from dashboard_meta.models import ColumnMeta, Dataset
from dashboard_meta.services.widget_resolver import resolve_widget_type, suggest_column_role


def _classify_dtype(data_type: str, udt_name: str) -> str:
    t = (data_type or "").lower()
    u = (udt_name or "").lower()
    combined = f"{t} {u}"
    if "timestamp" in combined or combined.startswith("date"):
        return "datetime"
    if u == "bool" or t == "boolean":
        return "boolean"
    if any(
        x in combined
        for x in (
            "int",
            "numeric",
            "decimal",
            "double",
            "real",
            "float",
            "serial",
            "money",
        )
    ):
        return "numeric"
    if "char" in combined or "text" in combined or "varchar" in combined:
        return "text"
    return "unknown"


def _quote_ident(name: str) -> str:
    """Escape identifier for PostgreSQL (double-quote)."""
    if not name.replace("_", "").isalnum():
        raise ValueError("Invalid identifier")
    return '"' + name.replace('"', '""') + '"'


def profile_dataset(dataset: Dataset) -> Dataset:
    """
    Refresh ColumnMeta rows and dataset.suggested_widget_type.
    Must run inside default DB connection.
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
            if n_distinct is not None:
                if float(n_distinct) < 0:
                    cardinality = None
                else:
                    cardinality = int(float(n_distinct))
            null_rate = float(null_frac) if null_frac is not None else 0.0

            is_dimension = dtype in ("text", "boolean") and (
                cardinality is None or cardinality <= 100
            )

            col_dict = {
                "dtype": dtype,
                "cardinality": cardinality,
                "col_name": col_name,
            }
            suggested = suggest_column_role(col_dict)

            ColumnMeta.objects.create(
                dataset=dataset,
                col_name=col_name,
                pg_type=f"{data_type} ({udt_name})",
                dtype=dtype,
                null_rate=null_rate,
                cardinality=cardinality,
                is_dimension=is_dimension,
                suggested_widget=suggested,
            )
            column_dicts.append(
                {
                    "dtype": dtype,
                    "cardinality": cardinality,
                    "col_name": col_name,
                }
            )

        suggested_type = resolve_widget_type(column_dicts)
        dataset.suggested_widget_type = suggested_type
        dataset.profiled_at = timezone.now()
        dataset.save(
            update_fields=["suggested_widget_type", "profiled_at", "updated_at"]
        )

    return dataset


def table_exists(schema: str, table: str) -> bool:
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
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
