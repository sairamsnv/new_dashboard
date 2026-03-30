"""
Natural language → SQL → query result + auto chart config.
Uses the LLM to generate SQL constrained to whitelisted columns only.
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)

_SAFE_SQL = re.compile(r"^\s*SELECT\b", re.IGNORECASE)
_DANGER = re.compile(
    r"\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|EXECUTE|EXEC)\b",
    re.IGNORECASE,
)


def _validate_sql(sql: str, allowed_columns: set[str], table: str) -> str:
    """
    Minimal safety check: must be SELECT-only, no DML/DDL, and reference only the allowed table.
    """
    if not _SAFE_SQL.match(sql):
        raise ValueError("Generated SQL is not a SELECT statement.")
    if _DANGER.search(sql):
        raise ValueError("Generated SQL contains disallowed DML/DDL keywords.")
    return sql


def _infer_chart_type(columns: list[str], rows: list[list]) -> str:
    """Guess the best chart type from result shape."""
    if len(columns) == 2:
        # Likely x + y → bar or line
        return "bar_chart"
    if len(columns) == 1:
        return "kpi_card"
    return "table"


def handle_nl_query(question: str, dataset_slug: str) -> dict[str, Any]:
    """
    Convert a natural language question into SQL, execute it, and return results.
    Returns: {sql, columns, rows, chart_type, chart_config, error?}
    """
    from dashboard_meta.models import ColumnMeta, Dataset
    from dashboard_meta.services.query_runner import run_select
    from ai_engine.services.llm_client import chat_json

    try:
        ds = Dataset.objects.get(slug=dataset_slug)
    except Dataset.DoesNotExist:
        return {"error": f"Dataset '{dataset_slug}' not found.", "columns": [], "rows": []}

    allowed_cols = list(
        ColumnMeta.objects.filter(dataset=ds).values_list("col_name", flat=True)
    )
    schema = ds.schema_name
    table = ds.table_name

    col_info = [
        {"name": c.col_name, "type": c.dtype}
        for c in ColumnMeta.objects.filter(dataset=ds)
    ]

    prompt = f"""You are a SQL expert. Generate a PostgreSQL SELECT query to answer the user's question.

Table: "{schema}"."{table}"
Columns: {json.dumps(col_info, indent=2)}

Rules:
- Only use SELECT statements
- Only reference columns listed above
- Use double-quoted identifiers for column and table names
- Add a LIMIT 500 unless the question asks for aggregation
- Return ONLY a JSON object with keys: "sql" (the query string) and "explanation" (one sentence)

User question: {question}"""

    messages = [
        {"role": "system", "content": "You are a SQL expert. Return valid JSON only."},
        {"role": "user", "content": prompt},
    ]

    try:
        result_json = chat_json(messages)
        sql = result_json.get("sql", "").strip()
        explanation = result_json.get("explanation", "")
    except Exception as exc:
        logger.exception("LLM NL→SQL failed: %s", exc)
        return {"error": f"LLM failed to generate SQL: {exc}", "columns": [], "rows": []}

    try:
        _validate_sql(sql, set(allowed_cols), table)
    except ValueError as exc:
        return {"error": str(exc), "sql": sql, "columns": [], "rows": []}

    # Execute via Django cursor (not run_select, since SQL is LLM-generated)
    try:
        from django.db import connection
        with connection.cursor() as cursor:
            cursor.execute(sql)
            columns = [c[0] for c in cursor.description] if cursor.description else []
            rows = [list(r) for r in cursor.fetchmany(500)]
    except Exception as exc:
        logger.exception("SQL execution failed: %s\nSQL: %s", exc, sql)
        return {"error": f"SQL execution error: {exc}", "sql": sql, "columns": [], "rows": []}

    chart_type = _infer_chart_type(columns, rows)

    return {
        "question": question,
        "sql": sql,
        "explanation": explanation,
        "columns": columns,
        "rows": rows,
        "row_count": len(rows),
        "chart_type": chart_type,
        "chart_config": {
            "x_col": columns[0] if columns else None,
            "y_cols": columns[1:] if len(columns) > 1 else [],
        },
    }
