"""
Auto-insight generation for a registered dataset.

Pipeline:
  1. Load column profiles from Postgres (ColumnMeta)
  2. Load dataset into Polars (via DuckDB query runner)
  3. Run InsightRanker → top-5 analytically-scored findings (DuckDB-powered)
  4. Run QualityRules → data quality context
  5. LLM narrates ONLY the top-5 findings → shorter prompt, faster, better output
"""
from __future__ import annotations

import json
import logging
from typing import Any

logger = logging.getLogger(__name__)


def _get_column_summaries(dataset_slug: str) -> list[dict]:
    """Load ColumnMeta from Postgres for the dataset."""
    from dashboard_meta.models import ColumnMeta, Dataset
    ds = Dataset.objects.get(slug=dataset_slug)
    cols = ColumnMeta.objects.filter(dataset=ds)
    return [
        {
            "col_name": c.col_name,
            "dtype": c.dtype,
            "null_rate": float(c.null_rate) if c.null_rate is not None else 0.0,
            "cardinality": c.cardinality,
            "is_dimension": c.is_dimension,
            "mean": None,
            "std": None,
        }
        for c in cols
    ]


def _enrich_summaries_with_stats(
    col_summaries: list[dict],
    df,
) -> list[dict]:
    """
    Compute mean and std for numeric columns using DuckDB.
    Enriches col_summaries in-place so the insight ranker can score trends.
    """
    if df is None:
        return col_summaries

    import duckdb
    numeric_cols = [c for c in col_summaries if c["dtype"] == "numeric"]
    if not numeric_cols:
        return col_summaries

    try:
        conn = duckdb.connect()
        conn.register("df", df)
        for col in numeric_cols:
            name = col["col_name"]
            if name not in df.columns:
                continue
            try:
                row = conn.execute(
                    f'SELECT AVG("{name}"), STDDEV("{name}") FROM df WHERE "{name}" IS NOT NULL'
                ).fetchone()
                if row and row[0] is not None:
                    col["mean"] = round(float(row[0]), 4)
                    col["std"] = round(float(row[1]), 4) if row[1] is not None else 0.0
            except Exception:
                pass
        conn.close()
    except Exception as exc:
        logger.debug("DuckDB stat enrichment failed: %s", exc)

    return col_summaries


def _load_dataset_as_polars(dataset_slug: str, limit: int = 5000):
    """
    Load the dataset from Postgres into a Polars DataFrame for DuckDB analytics.
    Returns None if loading fails.
    """
    try:
        import polars as pl
        from dashboard_meta.models import Dataset
        from dashboard_meta.services.query_runner import run_select

        ds = Dataset.objects.get(slug=dataset_slug)
        cols, rows = run_select(ds, columns=None, filters=[], limit=limit)
        if not rows:
            return None
        pdf_rows = [dict(zip(cols, row)) for row in rows]

        # Build Polars from dicts
        return pl.from_dicts(pdf_rows, infer_schema_length=500)
    except Exception as exc:
        logger.warning("Could not load dataset %s as Polars: %s", dataset_slug, exc)
        return None


def _get_data_sample(dataset_slug: str, limit: int = 10) -> list[dict]:
    """Return a small JSON sample for LLM context (human-readable rows)."""
    try:
        from dashboard_meta.models import Dataset
        from dashboard_meta.services.query_runner import run_select

        ds = Dataset.objects.get(slug=dataset_slug)
        cols, rows = run_select(ds, columns=None, filters=[], limit=limit)
        return [dict(zip(cols, row)) for row in rows]
    except Exception as exc:
        logger.warning("Could not fetch data sample for %s: %s", dataset_slug, exc)
        return []


def generate_insights(dataset_slug: str) -> dict[str, Any]:
    """
    Generate auto insights for a dataset.

    Returns: {trends, correlations, outliers, summary, quality}
    Redis cache: results cached for 1 hour so repeat calls are instant.
    """
    # Check Redis cache first
    try:
        from messaging.redis_queue import cache_result, get_cached_result
        cache_key = f"insights:{dataset_slug}"
        cached = get_cached_result(cache_key)
        if cached:
            logger.info("Insights cache hit for %s", dataset_slug)
            return cached
    except Exception:
        cache_key = None
        cache_result = None

    # 1. Column metadata
    col_summaries = _get_column_summaries(dataset_slug)

    # 2. Load data as Polars for DuckDB analytics
    df = _load_dataset_as_polars(dataset_slug, limit=5000)

    # 2b. Enrich col_summaries with live mean/std so trend ranker has data to score
    if df is not None:
        col_summaries = _enrich_summaries_with_stats(col_summaries, df)

    # 3. Run insight ranker (DuckDB-powered, no LLM)
    top_findings: list[dict] = []
    if df is not None:
        try:
            from ai_engine.services.insight_ranker import rank_all
            top_findings = rank_all(df, col_summaries, top_n=5)
        except Exception as exc:
            logger.warning("Insight ranker failed: %s", exc)

    # 4. Run quality rules (DuckDB-powered)
    quality_report: dict = {}
    if df is not None:
        try:
            from dashboard_meta.services.quality_rules import run_quality_rules
            quality_report = run_quality_rules(df, col_summaries)
        except Exception as exc:
            logger.warning("Quality rules failed: %s", exc)

    # 5. Build focused LLM prompt using only top-5 ranked findings
    quality_score = quality_report.get("overall_score", 1.0)

    corr_findings = [f for f in top_findings if f["type"] == "correlation"]
    trend_findings = [f for f in top_findings if f["type"] == "trend"]
    outlier_findings = [f for f in top_findings if f["type"] == "outlier"]

    findings_text = "\n".join(
        f"- [{f['type'].upper()}] {f['finding']}" for f in top_findings
    ) or "No significant findings."

    col_names = ", ".join(c["col_name"] for c in col_summaries[:20])

    prompt = f"""You are a data analyst. Narrate the following pre-computed findings for a business user.

Dataset: {len(col_summaries)} columns ({col_names})
Data quality score: {quality_score:.0%}

Pre-computed findings:
{findings_text}

Return ONLY a valid JSON object — no markdown, no trailing commas, no extra text:
{{
  "trends": ["<trend observation 1>", "<trend observation 2>"],
  "correlations": [{{"col_a": "X", "col_b": "Y", "description": "X and Y are strongly related"}}],
  "outliers": ["<outlier observation>"],
  "summary": "<one paragraph summary for a business user>"
}}"""

    messages = [
        {"role": "system", "content": "You are a data analyst. Respond with valid JSON only. No markdown. No trailing commas."},
        {"role": "user", "content": prompt},
    ]

    # Graceful fallback values (used both on LLM success as defaults + on LLM failure)
    fallback_trends = [f["finding"] for f in trend_findings]
    fallback_corrs = [
        {"col_a": f.get("col_a", ""), "col_b": f.get("col_b", ""), "description": f["finding"]}
        for f in corr_findings
    ]
    fallback_outliers = [f["finding"] for f in outlier_findings]

    try:
        from ai_engine.services.llm_client import chat_json
        result = chat_json(messages, model=None)

        # Ensure all required keys exist — fall back to DuckDB-ranked findings
        if not result.get("trends"):
            result["trends"] = fallback_trends
        if not result.get("correlations"):
            result["correlations"] = fallback_corrs
        if not result.get("outliers"):
            result["outliers"] = fallback_outliers
        result.setdefault("summary", f"Dataset has {len(col_summaries)} columns. Data quality: {quality_score:.0%}.")

        result["quality"] = {
            "score": quality_score,
            "findings": quality_report.get("findings", [])[:5],
        }

        try:
            if cache_key and cache_result:
                cache_result(cache_key, result, ttl=3600)
        except Exception:
            pass
        return result

    except Exception as exc:
        logger.exception("Insight generation failed for %s: %s", dataset_slug, exc)

        return {
            "trends": fallback_trends or ["No trend data available"],
            "correlations": fallback_corrs,
            "outliers": fallback_outliers,
            "summary": (
                f"Dataset has {len(col_summaries)} columns. "
                f"Data quality: {quality_score:.0%}. "
                f"LLM narration unavailable."
            ),
            "quality": {
                "score": quality_score,
                "findings": quality_report.get("findings", [])[:5],
            },
        }
