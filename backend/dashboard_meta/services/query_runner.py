"""
Read-only queries against registered datasets (whitelist columns only).
"""

from __future__ import annotations

import re
from typing import Any

from django.db import connection

from dashboard_meta.models import Dataset

_IDENT = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _quote_ident(name: str) -> str:
    if not _IDENT.match(name):
        raise ValueError(f"Invalid identifier: {name!r}")
    return '"' + name.replace('"', '""') + '"'


OPS = {
    "eq": "=",
    "ne": "<>",
    "gt": ">",
    "lt": "<",
    "gte": ">=",
    "lte": "<=",
}


def run_select(
    dataset: Dataset,
    *,
    columns: list[str] | None,
    filters: list[dict[str, Any]] | None,
    limit: int = 500,
    order_by: str | None = None,
) -> tuple[list[str], list[tuple]]:
    """
    Returns (column_names, rows). Only columns present in ColumnMeta are allowed.
    """
    from dashboard_meta.models import ColumnMeta

    allowed = set(
        ColumnMeta.objects.filter(dataset=dataset).values_list("col_name", flat=True)
    )
    if not allowed:
        raise ValueError("Dataset has no column metadata; run schema inspect first.")

    if columns:
        for c in columns:
            if c not in allowed:
                raise ValueError(f"Column not allowed: {c}")
        select_cols = columns
    else:
        select_cols = sorted(allowed)

    schema = _quote_ident(dataset.schema_name)
    table = _quote_ident(dataset.table_name)
    parts = [f"SELECT {', '.join(_quote_ident(c) for c in select_cols)}"]
    parts.append(f"FROM {schema}.{table}")
    params: list[Any] = []

    if filters:
        wheres = []
        for f in filters:
            col = f.get("column")
            op = f.get("op", "eq")
            val = f.get("value")
            if col not in allowed:
                raise ValueError(f"Filter column not allowed: {col}")
            if op not in OPS:
                raise ValueError(f"Unsupported op: {op}")
            wheres.append(f"{_quote_ident(col)} {OPS[op]} %s")
            params.append(val)
        if wheres:
            parts.append("WHERE " + " AND ".join(wheres))

    if order_by:
        if order_by.lstrip("-") not in allowed:
            raise ValueError("order_by must reference an allowed column")
        desc = order_by.startswith("-")
        ob = order_by[1:] if desc else order_by
        parts.append(
            f"ORDER BY {_quote_ident(ob)} {'DESC' if desc else 'ASC'}"
        )

    lim = max(1, min(int(limit), 5000))
    parts.append(f"LIMIT {lim}")

    sql = " ".join(parts)
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        cols = [c[0] for c in cursor.description] if cursor.description else select_cols
        rows = cursor.fetchall()

    return list(cols), list(rows)


AGGREGATE_OPS = frozenset({"count", "count_distinct", "sum", "avg"})


def run_aggregate(
    dataset: Dataset,
    op: str,
    column: str | None = None,
) -> float:
    """
    Single-value aggregate for KPI cards. Whitelist columns via ColumnMeta only.
    - count: COUNT(*) if column is None, else COUNT(column)
    - count_distinct: COUNT(DISTINCT column) — column required
    - sum / avg: column required, must be numeric-ish in DB
    """
    from dashboard_meta.models import ColumnMeta

    if op not in AGGREGATE_OPS:
        raise ValueError(f"Unsupported aggregate op: {op}")

    allowed = set(
        ColumnMeta.objects.filter(dataset=dataset).values_list("col_name", flat=True)
    )
    if not allowed:
        raise ValueError("Dataset has no column metadata; run schema inspect first.")

    schema = _quote_ident(dataset.schema_name)
    table = _quote_ident(dataset.table_name)

    if op == "count":
        if column:
            if column not in allowed:
                raise ValueError(f"Column not allowed: {column}")
            expr = f"COUNT({_quote_ident(column)})"
        else:
            expr = "COUNT(*)"
    elif op == "count_distinct":
        if not column or column not in allowed:
            raise ValueError("count_distinct requires a whitelisted column name")
        expr = f"COUNT(DISTINCT {_quote_ident(column)})"
    elif op in ("sum", "avg"):
        if not column or column not in allowed:
            raise ValueError(f"{op} requires a whitelisted column name")
        expr = f"{op.upper()}({_quote_ident(column)})"
    else:
        raise ValueError(f"Unsupported op: {op}")

    sql = f"SELECT {expr} AS _v FROM {schema}.{table}"
    with connection.cursor() as cursor:
        cursor.execute(sql)
        row = cursor.fetchone()
    if not row or row[0] is None:
        return 0.0
    v = row[0]
    if op == "avg":
        return float(v)
    if op in ("sum", "count", "count_distinct"):
        try:
            return int(v)
        except (TypeError, ValueError):
            return float(v)
    return float(v)
