"""
Graph suggestion engine.

Step 1: DuckDB-powered rule-based suggestions from actual data stats
        (uses CORR, approx_count_distinct, and column types for smarter suggestions).
Step 2: LLM refines and ranks with reasoning — narrates a 1-sentence insight per chart.
Step 3: Falls back gracefully to rule-based suggestions if LLM is unavailable.
"""
from __future__ import annotations

import json
import logging
from typing import Any

import duckdb
import polars as pl

logger = logging.getLogger(__name__)


def _load_dataset_polars(dataset_slug: str, limit: int = 5000) -> pl.DataFrame | None:
    """Load dataset from Postgres into Polars for DuckDB analytics."""
    try:
        from dashboard_meta.models import Dataset
        from dashboard_meta.services.query_runner import run_select

        ds = Dataset.objects.get(slug=dataset_slug)
        cols, rows = run_select(ds, columns=None, filters=[], limit=limit)
        if not rows:
            return None
        return pl.from_dicts([dict(zip(cols, row)) for row in rows], infer_schema_length=500)
    except Exception as exc:
        logger.warning("Could not load dataset %s as Polars: %s", dataset_slug, exc)
        return None


def _duck_cardinalities(df: pl.DataFrame, cols: list[dict]) -> dict[str, int]:
    """
    Use DuckDB approx_count_distinct for exact cardinalities from actual data.
    Much more accurate than pg_stats approximation.
    """
    result: dict[str, int] = {}
    if df is None or not cols:
        return result

    col_names = [c["name"] for c in cols if c["name"] in df.columns]
    if not col_names:
        return result

    conn = duckdb.connect()
    try:
        conn.register("df", df)
        exprs = ", ".join(f'approx_count_distinct("{c}") AS "{c}"' for c in col_names)
        row = conn.execute(f"SELECT {exprs} FROM df").fetchone()
        if row:
            for i, col in enumerate(col_names):
                result[col] = int(row[i]) if row[i] is not None else 0
    except Exception as exc:
        logger.debug("DuckDB cardinality check failed: %s", exc)
    finally:
        conn.close()
    return result


def _duck_strong_correlations(df: pl.DataFrame, numeric_cols: list[str]) -> list[tuple[str, str, float]]:
    """
    Find numeric column pairs with |CORR| > 0.6 via DuckDB.
    Returns list of (col_a, col_b, correlation) sorted by |corr| desc.
    """
    if df is None or len(numeric_cols) < 2:
        return []

    results = []
    conn = duckdb.connect()
    try:
        conn.register("df", df)
        for i, col_a in enumerate(numeric_cols):
            for col_b in numeric_cols[i + 1:]:
                try:
                    row = conn.execute(
                        f'SELECT CORR("{col_a}", "{col_b}") FROM df'
                    ).fetchone()
                    if row and row[0] is not None:
                        corr = float(row[0])
                        if abs(corr) > 0.6:
                            results.append((col_a, col_b, corr))
                except Exception:
                    pass
    finally:
        conn.close()

    return sorted(results, key=lambda x: abs(x[2]), reverse=True)


def _rule_based_suggestions(
    columns: list[dict],
    df: pl.DataFrame | None = None,
) -> list[dict]:
    """
    DuckDB-enhanced rule-based chart suggestions.
    Uses actual data stats (cardinalities, correlations) for smarter choices.
    """
    numeric = [c for c in columns if c["type"] == "numeric"]
    datetime_cols = [c for c in columns if c["type"] == "datetime"]
    categorical = [c for c in columns if c["type"] in ("text", "boolean")]

    suggestions = []

    # Use DuckDB for accurate cardinalities when data is available
    if df is not None:
        duck_cards = _duck_cardinalities(df, columns)
        # Update categorical cardinalities with real values
        for cat in categorical:
            if cat["name"] in duck_cards:
                cat = dict(cat)
                cat["cardinality"] = duck_cards[cat["name"]]

        # Re-filter categoricals with low real cardinality (good for charts)
        categorical = [
            c for c in categorical
            if duck_cards.get(c["name"], c.get("cardinality") or 999) <= 30
        ]

    # 1. Time series: datetime + numeric → line chart (highest priority)
    if datetime_cols and numeric:
        for dt in datetime_cols[:1]:
            for num in numeric[:3]:
                suggestions.append({
                    "chart_type": "line_chart",
                    "x_col": dt["name"],
                    "y_cols": [num["name"]],
                    "title": f"{num['name']} over time",
                    "reason": "Datetime + numeric → ideal time series line chart",
                    "priority": 1,
                })

    # 2. Strongly correlated numeric pairs → scatter (DuckDB-detected)
    if df is not None and len(numeric) >= 2:
        numeric_names = [c["name"] for c in numeric if c["name"] in df.columns]
        strong_corrs = _duck_strong_correlations(df, numeric_names)
        for col_a, col_b, corr in strong_corrs[:2]:
            direction = "positive" if corr > 0 else "negative"
            suggestions.append({
                "chart_type": "scatter_plot",
                "x_col": col_a,
                "y_cols": [col_b],
                "title": f"{col_a} vs {col_b}",
                "reason": f"DuckDB detected strong {direction} correlation (r={corr:.2f})",
                "priority": 2,
            })
    elif len(numeric) >= 2:
        # Fallback: suggest scatter for first two numeric cols
        suggestions.append({
            "chart_type": "scatter_plot",
            "x_col": numeric[0]["name"],
            "y_cols": [numeric[1]["name"]],
            "title": f"{numeric[0]['name']} vs {numeric[1]['name']}",
            "reason": "Two numeric columns → scatter for correlation exploration",
            "priority": 2,
        })

    # 3. Categorical + numeric → bar chart
    if categorical and numeric:
        for cat in categorical[:2]:
            for num in numeric[:2]:
                suggestions.append({
                    "chart_type": "bar_chart",
                    "x_col": cat["name"],
                    "y_cols": [num["name"]],
                    "title": f"{num['name']} by {cat['name']}",
                    "reason": "Categorical dimension + numeric measure → bar chart",
                    "priority": 3,
                })

    # 4. Low-cardinality categorical → pie chart
    for cat in categorical:
        cardinality = cat.get("cardinality") or 999
        if cardinality <= 8:
            suggestions.append({
                "chart_type": "pie_chart",
                "x_col": cat["name"],
                "y_cols": [],
                "title": f"Breakdown by {cat['name']}",
                "reason": f"Low cardinality ({cardinality} values) → pie chart",
                "priority": 4,
            })

    # 5. Numeric distributions → histogram
    for num in numeric[:2]:
        suggestions.append({
            "chart_type": "histogram",
            "x_col": num["name"],
            "y_cols": [],
            "title": f"Distribution of {num['name']}",
            "reason": "Single numeric column → histogram shows value distribution",
            "priority": 5,
        })

    # Sort by priority, deduplicate by (chart_type, x_col)
    seen: set[str] = set()
    unique: list[dict] = []
    for s in sorted(suggestions, key=lambda x: x["priority"]):
        key = f"{s['chart_type']}:{s['x_col']}"
        if key not in seen:
            seen.add(key)
            unique.append(s)

    return unique[:8]


def suggest_graphs(dataset_slug: str) -> dict[str, Any]:
    """
    Return ranked graph suggestions for a dataset.

    Fast path (always runs):
      - Read ColumnMeta from Postgres (already profiled during upload, instant)
      - Rule-based suggestions from column types + cached cardinalities

    DuckDB enhancement (skipped if dataset > 10k rows to keep response fast):
      - Real correlations via CORR() on a 2000-row sample
      - Accurate cardinalities via approx_count_distinct

    Redis cache: results cached for 1 hour so repeat calls are instant.
    """
    # Check Redis cache first — return instantly on hit
    try:
        from messaging.redis_queue import cache_result, get_cached_result
        cache_key = f"graph_suggestions:{dataset_slug}"
        cached = get_cached_result(cache_key)
        if cached:
            logger.info("Graph suggestions cache hit for %s", dataset_slug)
            return cached
    except Exception:
        cache_key = None
        cache_result = None

    from dashboard_meta.models import ColumnMeta, Dataset

    try:
        ds = Dataset.objects.get(slug=dataset_slug)
    except Dataset.DoesNotExist:
        return {"suggestions": [], "error": "Dataset not found"}

    cols = list(
        ColumnMeta.objects.filter(dataset=ds).values(
            "col_name", "dtype", "cardinality", "is_dimension"
        )
    )
    col_list = [
        {
            "name": c["col_name"],
            "type": c["dtype"],
            "cardinality": c["cardinality"],
            "is_dimension": c["is_dimension"],
        }
        for c in cols
    ]

    # Only load data for DuckDB if dataset is small (< 10k rows) to stay fast
    df = None
    try:
        row_count = getattr(ds, "row_count", None) or 999_999
        if row_count <= 10_000:
            df = _load_dataset_polars(dataset_slug, limit=2_000)
    except Exception as exc:
        logger.debug("Skipping DuckDB load for large dataset %s: %s", dataset_slug, exc)

    # Rule-based suggestions (enhanced with DuckDB only when data loaded)
    rule_suggestions = _rule_based_suggestions(col_list, df)

    # LLM refinement: add 1-sentence insights per chart
    result = {"suggestions": rule_suggestions, "dataset_slug": dataset_slug}
    try:
        from ai_engine.services.llm_client import chat_json

        prompt = f"""You are a data visualization expert.
Given these chart suggestions and column profiles, add a 1-sentence "insight" to each chart
explaining what business insight the user will gain. Keep each insight under 20 words.

Columns: {json.dumps(col_list[:15], indent=2)}
Suggestions: {json.dumps(rule_suggestions, indent=2)}

Return a JSON array where each item has:
chart_type, x_col, y_cols, title, reason, insight, priority
Return ONLY valid JSON array."""

        messages = [
            {"role": "system", "content": "You are a data visualization expert. Return valid JSON only."},
            {"role": "user", "content": prompt},
        ]
        refined = chat_json(messages)
        if isinstance(refined, list) and len(refined) > 0:
            logger.info("LLM refined %d graph suggestions for %s", len(refined), dataset_slug)
            result = {"suggestions": refined[:8], "dataset_slug": dataset_slug}
    except Exception as exc:
        logger.warning("LLM graph refinement failed, using rule-based only: %s", exc)

    # Cache result in Redis for 1 hour
    try:
        if cache_key and cache_result:
            cache_result(cache_key, result, ttl=3600)
    except Exception:
        pass

    return result
