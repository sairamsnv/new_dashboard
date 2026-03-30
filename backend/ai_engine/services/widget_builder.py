"""
AI Widget Builder: user prompt → structured widget JSON config.
Used by the ChatWidgetBuilder frontend panel.
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)

WIDGET_SCHEMA = """
{
  "title": "string — human-readable widget title",
  "chart_type": "one of: bar_chart | line_chart | pie_chart | scatter_plot | histogram | kpi_card | table",
  "dataset": "dataset_slug string",
  "query": {
    "table": "table name",
    "x_col": "column name for X axis or dimension",
    "y_cols": ["list of numeric column names"],
    "aggregation": "one of: sum | avg | count | count_distinct | none",
    "filters": [],
    "group_by": "optional column name"
  },
  "config": {
    "stacked": false,
    "colors": ["#6366f1", "#22c55e"],
    "x_label": "string",
    "y_label": "string",
    "show_legend": true
  },
  "layout": {"w": 6, "h": 4}
}
"""


def build_widget(prompt: str, dataset_slug: str | None = None) -> dict[str, Any]:
    """
    Convert a user's natural language prompt into a widget configuration.
    Returns a widget JSON dict ready for the dashboard store.
    """
    from ai_engine.services.llm_client import chat_json
    from dashboard_meta.models import ColumnMeta, Dataset

    context_cols = []
    context_table = ""
    if dataset_slug:
        try:
            ds = Dataset.objects.get(slug=dataset_slug)
            context_table = f"{ds.schema_name}.{ds.table_name}"
            context_cols = [
                {"name": c.col_name, "type": c.dtype}
                for c in ColumnMeta.objects.filter(dataset=ds)[:30]
            ]
        except Dataset.DoesNotExist:
            pass

    col_context = (
        f"\nAvailable columns in dataset '{dataset_slug}': {json.dumps(context_cols, indent=2)}"
        if context_cols
        else ""
    )
    table_context = f"\nTable: {context_table}" if context_table else ""

    prompt_text = f"""You are a dashboard widget builder. Convert the user's request into a widget configuration JSON.
{table_context}{col_context}

Widget JSON schema:
{WIDGET_SCHEMA}

User request: "{prompt}"

Rules:
- Infer chart_type from the request (bar, line, pie, scatter, histogram, kpi, table)
- Pick appropriate columns from available columns list if provided
- Set the dataset field to: "{dataset_slug or 'unknown'}"
- Return ONLY valid JSON matching the schema above. No markdown, no explanation."""

    messages = [
        {"role": "system", "content": "You are a dashboard widget builder. Return valid JSON only."},
        {"role": "user", "content": prompt_text},
    ]

    try:
        widget = chat_json(messages)
        # Ensure required fields exist
        widget.setdefault("title", "New Widget")
        widget.setdefault("chart_type", "bar_chart")
        widget.setdefault("dataset", dataset_slug or "")
        widget.setdefault("query", {})
        widget.setdefault("config", {})
        widget.setdefault("layout", {"w": 6, "h": 4})
        return widget
    except Exception as exc:
        logger.exception("Widget build failed for prompt '%s': %s", prompt[:100], exc)
        # Return a minimal fallback widget
        return {
            "title": "New Widget",
            "chart_type": "bar_chart",
            "dataset": dataset_slug or "",
            "query": {},
            "config": {},
            "layout": {"w": 6, "h": 4},
            "error": str(exc),
        }
