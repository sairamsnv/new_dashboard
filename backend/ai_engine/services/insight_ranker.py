"""
Insight Ranker — scores and prioritises findings before they reach the LLM.

Instead of sending everything to the LLM (slow, expensive, unfocused prompt),
we first score findings analytically with DuckDB, then pass only the top-N
to the LLM for human-readable narration.

Ranking pipeline:
  1. rank_trends()      — columns with high coefficient of variation (volatile)
  2. rank_correlations() — numeric pairs with |CORR| > 0.4 via DuckDB
  3. rank_outliers()    — IQR-based outlier density per numeric column
  4. rank_all()         — merges all, deduplicates, sorts by score desc
"""
from __future__ import annotations

import logging
from typing import Any

import duckdb
import polars as pl

logger = logging.getLogger(__name__)

# Minimum correlation magnitude to report as a finding
CORR_THRESHOLD = 0.4
# Minimum outlier fraction to report as a finding
OUTLIER_THRESHOLD = 0.02


# ─── Trend scoring ────────────────────────────────────────────────────────────

def rank_trends(col_summaries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Score numeric columns by coefficient of variation (std / |mean|).
    High CV → highly variable → interesting trend candidate.

    Returns list of { type, col_name, finding, score } sorted desc.
    """
    findings = []
    for col in col_summaries:
        if col.get("dtype") != "numeric":
            continue
        mean = col.get("mean")
        std = col.get("std")
        if mean is None or std is None:
            continue
        try:
            mean_f = float(mean)
            std_f = float(std)
        except (TypeError, ValueError):
            continue

        if mean_f == 0:
            continue

        cv = abs(std_f / mean_f)
        score = min(cv, 1.0)  # cap at 1.0

        if score > 0.5:
            findings.append({
                "type": "trend",
                "col_name": col["col_name"],
                "finding": (
                    f"'{col['col_name']}' is highly variable "
                    f"(std={std_f:.2f}, mean={mean_f:.2f}, CV={cv:.2f}) — worth investigating trends"
                ),
                "score": round(score, 4),
            })
        elif score > 0.1:
            findings.append({
                "type": "trend",
                "col_name": col["col_name"],
                "finding": (
                    f"'{col['col_name']}' shows moderate variability "
                    f"(CV={cv:.2f})"
                ),
                "score": round(score, 4),
            })

    return sorted(findings, key=lambda x: x["score"], reverse=True)


# ─── Correlation scoring ──────────────────────────────────────────────────────

def rank_correlations(df: pl.DataFrame, col_summaries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Use DuckDB CORR() to compute pairwise Pearson correlations for all numeric columns.
    Returns findings for pairs with |correlation| > CORR_THRESHOLD.
    """
    numeric_cols = [
        c["col_name"] for c in col_summaries
        if c.get("dtype") == "numeric" and c["col_name"] in df.columns
    ]

    if len(numeric_cols) < 2:
        return []

    findings = []
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
                        if abs(corr) >= CORR_THRESHOLD:
                            direction = "positively" if corr > 0 else "negatively"
                            strength = "strongly" if abs(corr) > 0.7 else "moderately"
                            findings.append({
                                "type": "correlation",
                                "col_name": f"{col_a}↔{col_b}",
                                "col_a": col_a,
                                "col_b": col_b,
                                "corr": round(corr, 3),
                                "finding": (
                                    f"'{col_a}' and '{col_b}' are {strength} {direction} "
                                    f"correlated (r={corr:.2f})"
                                ),
                                "score": round(abs(corr), 4),
                            })
                except Exception as exc:
                    logger.debug("CORR failed for %s/%s: %s", col_a, col_b, exc)
    finally:
        conn.close()

    return sorted(findings, key=lambda x: x["score"], reverse=True)


# ─── Outlier scoring ──────────────────────────────────────────────────────────

def rank_outliers(df: pl.DataFrame, col_summaries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Use DuckDB IQR fence to count outliers per numeric column.
    Returns findings for columns where outlier fraction > OUTLIER_THRESHOLD.
    """
    numeric_cols = [
        c["col_name"] for c in col_summaries
        if c.get("dtype") == "numeric" and c["col_name"] in df.columns
    ]

    if not numeric_cols:
        return []

    findings = []
    conn = duckdb.connect()
    try:
        conn.register("df", df)

        for col in numeric_cols:
            try:
                row = conn.execute(f"""
                    WITH stats AS (
                        SELECT
                            PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "{col}") AS q1,
                            PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "{col}") AS q3
                        FROM df WHERE "{col}" IS NOT NULL
                    ),
                    bounds AS (
                        SELECT q1 - 1.5*(q3-q1) AS lo, q3 + 1.5*(q3-q1) AS hi FROM stats
                    )
                    SELECT
                        COUNT(*) FILTER (WHERE "{col}" < lo OR "{col}" > hi) AS outliers,
                        COUNT("{col}") AS total,
                        MIN("{col}") AS col_min,
                        MAX("{col}") AS col_max
                    FROM df, bounds
                """).fetchone()

                if row and row[1] and row[1] > 0:
                    outlier_count = int(row[0])
                    total = int(row[1])
                    col_min = row[2]
                    col_max = row[3]
                    outlier_frac = outlier_count / total

                    if outlier_frac >= OUTLIER_THRESHOLD:
                        score = min(outlier_frac * 5, 1.0)  # amplify for ranking
                        findings.append({
                            "type": "outlier",
                            "col_name": col,
                            "outlier_count": outlier_count,
                            "outlier_pct": round(outlier_frac * 100, 1),
                            "finding": (
                                f"'{col}' has {outlier_count} outliers "
                                f"({outlier_frac*100:.1f}% of values, "
                                f"range: {col_min:.2g}–{col_max:.2g})"
                            ),
                            "score": round(score, 4),
                        })
            except Exception as exc:
                logger.debug("Outlier check failed for %s: %s", col, exc)
    finally:
        conn.close()

    return sorted(findings, key=lambda x: x["score"], reverse=True)


# ─── Master ranking ───────────────────────────────────────────────────────────

def rank_all(
    df: pl.DataFrame,
    col_summaries: list[dict[str, Any]],
    top_n: int = 5,
) -> list[dict[str, Any]]:
    """
    Run all rankers and return the top-N most important findings.

    Args:
        df: Polars DataFrame of the dataset
        col_summaries: list of column profile dicts (col_name, dtype, mean, std, ...)
        top_n: how many findings to return (default 5 — for LLM prompt efficiency)

    Returns:
        List of finding dicts sorted by score desc, capped at top_n.
        Each dict has: type, col_name, finding, score (plus type-specific fields).
    """
    all_findings: list[dict[str, Any]] = []

    try:
        all_findings.extend(rank_trends(col_summaries))
    except Exception as exc:
        logger.warning("Trend ranking failed: %s", exc)

    try:
        all_findings.extend(rank_correlations(df, col_summaries))
    except Exception as exc:
        logger.warning("Correlation ranking failed: %s", exc)

    try:
        all_findings.extend(rank_outliers(df, col_summaries))
    except Exception as exc:
        logger.warning("Outlier ranking failed: %s", exc)

    # Sort by score desc, deduplicate by (type, col_name)
    seen: set[str] = set()
    unique_findings: list[dict[str, Any]] = []
    for f in sorted(all_findings, key=lambda x: x["score"], reverse=True):
        key = f"{f['type']}:{f['col_name']}"
        if key not in seen:
            seen.add(key)
            unique_findings.append(f)

    logger.info(
        "Insight ranker found %d total findings, returning top %d",
        len(unique_findings), top_n,
    )
    return unique_findings[:top_n]
