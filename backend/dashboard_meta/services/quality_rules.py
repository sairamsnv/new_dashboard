"""
Data quality rules engine.

Each rule inspects a column (or the full dataset) and returns a structured finding:
    { rule, col_name, score (0.0–1.0), finding (human text), severity }

Severity levels: "ok" | "warning" | "critical"

Usage:
    from dashboard_meta.services.quality_rules import run_quality_rules
    report = run_quality_rules(polars_df, col_summaries)
    # report["columns"]  → per-column quality dicts
    # report["overall_score"] → float 0–1
    # report["findings"]  → list of all findings sorted by severity
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import duckdb
import polars as pl

logger = logging.getLogger(__name__)


# ─── Finding dataclass ────────────────────────────────────────────────────────

@dataclass
class QualityFinding:
    rule: str
    col_name: str
    score: float          # 1.0 = perfect, 0.0 = worst
    finding: str
    severity: str         # "ok" | "warning" | "critical"


# ─── Individual rules ─────────────────────────────────────────────────────────

def _completeness_rule(col_name: str, null_rate: float) -> QualityFinding:
    """Flag columns with high null rates."""
    score = 1.0 - null_rate
    if null_rate > 0.5:
        severity = "critical"
        finding = f"'{col_name}' is {null_rate*100:.1f}% empty — data is mostly missing"
    elif null_rate > 0.2:
        severity = "warning"
        finding = f"'{col_name}' has {null_rate*100:.1f}% null values — consider imputation"
    else:
        severity = "ok"
        finding = f"'{col_name}' completeness is good ({null_rate*100:.1f}% nulls)"
    return QualityFinding(rule="completeness", col_name=col_name, score=score,
                          finding=finding, severity=severity)


def _uniqueness_rule(col_name: str, cardinality: int, total_rows: int) -> QualityFinding:
    """Detect ID-like columns (cardinality == row count) or near-constant columns."""
    if total_rows == 0:
        return QualityFinding(rule="uniqueness", col_name=col_name, score=1.0,
                              finding=f"'{col_name}' — no rows to assess", severity="ok")

    ratio = cardinality / total_rows
    if ratio >= 0.99:
        severity = "warning"
        score = 0.5
        finding = (
            f"'{col_name}' looks like an ID column ({cardinality} unique / {total_rows} rows) "
            "— low analytical value"
        )
    elif cardinality <= 1:
        severity = "critical"
        score = 0.0
        finding = f"'{col_name}' has only {cardinality} unique value(s) — constant column, no signal"
    else:
        severity = "ok"
        score = 1.0
        finding = f"'{col_name}' has good cardinality ({cardinality} unique values)"
    return QualityFinding(rule="uniqueness", col_name=col_name, score=score,
                          finding=finding, severity=severity)


def _validity_rule_numeric(col_name: str, df: pl.DataFrame) -> QualityFinding:
    """
    Detect outliers in numeric columns using DuckDB IQR method.
    Outlier score = fraction of non-outlier rows.
    """
    try:
        conn = duckdb.connect()
        conn.register("df", df)
        row = conn.execute(f"""
            WITH stats AS (
                SELECT
                    PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY "{col_name}") AS q1,
                    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY "{col_name}") AS q3
                FROM df
                WHERE "{col_name}" IS NOT NULL
            ),
            bounds AS (
                SELECT
                    q1 - 1.5 * (q3 - q1) AS lower_fence,
                    q3 + 1.5 * (q3 - q1) AS upper_fence
                FROM stats
            )
            SELECT
                COUNT(*) FILTER (WHERE "{col_name}" < lower_fence OR "{col_name}" > upper_fence) AS outliers,
                COUNT("{col_name}") AS total
            FROM df, bounds
        """).fetchone()
        conn.close()

        if row and row[1] and row[1] > 0:
            outlier_count = int(row[0])
            total = int(row[1])
            outlier_pct = outlier_count / total
            score = 1.0 - min(outlier_pct * 2, 1.0)  # penalise but cap

            if outlier_pct > 0.05:
                severity = "warning"
                finding = (
                    f"'{col_name}' has {outlier_count} outliers "
                    f"({outlier_pct*100:.1f}% of values outside IQR fence)"
                )
            else:
                severity = "ok"
                finding = f"'{col_name}' has few outliers ({outlier_count} rows)"
            return QualityFinding(rule="validity", col_name=col_name, score=score,
                                  finding=finding, severity=severity)
    except Exception as exc:
        logger.debug("Validity rule failed for %s: %s", col_name, exc)

    return QualityFinding(rule="validity", col_name=col_name, score=1.0,
                          finding=f"'{col_name}' validity check skipped", severity="ok")


def _freshness_rule(col_name: str, df: pl.DataFrame) -> QualityFinding:
    """
    Check that datetime columns contain recent data.
    Flags columns where the most recent value is older than 1 year.
    """
    try:
        series = df[col_name].drop_nulls()
        if len(series) == 0:
            raise ValueError("empty")

        # Convert to Python datetime for comparison
        max_val = series.max()
        now = datetime.now(tz=timezone.utc)

        if hasattr(max_val, "year"):
            max_dt = max_val
        else:
            max_dt = None

        if max_dt:
            # Make timezone-aware if naive
            if hasattr(max_dt, "tzinfo") and max_dt.tzinfo is None:
                max_dt = max_dt.replace(tzinfo=timezone.utc)
            age_days = (now - max_dt).days
            if age_days > 365:
                return QualityFinding(
                    rule="freshness", col_name=col_name, score=0.5,
                    finding=(
                        f"'{col_name}' most recent value is {age_days} days old "
                        "— data may be stale"
                    ),
                    severity="warning",
                )
            return QualityFinding(
                rule="freshness", col_name=col_name, score=1.0,
                finding=f"'{col_name}' data is fresh (max date: {max_dt.date()})",
                severity="ok",
            )
    except Exception as exc:
        logger.debug("Freshness rule failed for %s: %s", col_name, exc)

    return QualityFinding(rule="freshness", col_name=col_name, score=1.0,
                          finding=f"'{col_name}' freshness check skipped", severity="ok")


# ─── Main entry point ─────────────────────────────────────────────────────────

def run_quality_rules(
    df: pl.DataFrame,
    col_summaries: list[dict[str, Any]],
) -> dict[str, Any]:
    """
    Run all quality rules against the dataset.

    Args:
        df: Polars DataFrame of the uploaded data
        col_summaries: list of dicts with keys col_name, dtype, null_rate, cardinality

    Returns:
        {
            "columns": { col_name: { score, findings: [...] } },
            "overall_score": float,
            "findings": [ { rule, col_name, score, finding, severity }, ... ],
        }
    """
    total_rows = len(df)
    all_findings: list[QualityFinding] = []
    col_results: dict[str, dict] = {}

    for meta in col_summaries:
        col_name = meta["col_name"]
        dtype = meta.get("dtype", "text")
        null_rate = float(meta.get("null_rate", 0.0))
        cardinality = int(meta.get("cardinality") or 0)

        col_findings: list[QualityFinding] = []

        # Always run completeness + uniqueness
        col_findings.append(_completeness_rule(col_name, null_rate))
        col_findings.append(_uniqueness_rule(col_name, cardinality, total_rows))

        # Type-specific rules
        if dtype == "numeric" and col_name in df.columns:
            col_findings.append(_validity_rule_numeric(col_name, df))

        if dtype == "datetime" and col_name in df.columns:
            col_findings.append(_freshness_rule(col_name, df))

        # Aggregate per-column score (weighted average)
        col_score = sum(f.score for f in col_findings) / len(col_findings)
        all_findings.extend(col_findings)

        col_results[col_name] = {
            "score": round(col_score, 3),
            "findings": [
                {"rule": f.rule, "finding": f.finding, "severity": f.severity, "score": f.score}
                for f in col_findings
                if f.severity != "ok"  # only surface non-ok findings per column
            ],
        }

    # Overall dataset quality score
    overall = sum(f.score for f in all_findings) / len(all_findings) if all_findings else 1.0

    # Sort all findings: critical first, then warning, then ok
    severity_order = {"critical": 0, "warning": 1, "ok": 2}
    sorted_findings = sorted(all_findings, key=lambda f: (severity_order[f.severity], -f.score))

    return {
        "columns": col_results,
        "overall_score": round(overall, 3),
        "findings": [
            {
                "rule": f.rule,
                "col_name": f.col_name,
                "score": f.score,
                "finding": f.finding,
                "severity": f.severity,
            }
            for f in sorted_findings
            if f.severity != "ok"  # only surface actionable findings at top level
        ],
    }
