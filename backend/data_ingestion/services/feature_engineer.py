"""
Feature engineering helpers applied after parsing:
- Date column breakdown (year, month, day, weekday)
- Encoding suggestions for categorical columns
- Derived metric detection
"""
from __future__ import annotations

from typing import Any

import pandas as pd


def suggest_date_breakdown(df: pd.DataFrame) -> list[dict[str, Any]]:
    """Return a list of date expansion suggestions for datetime columns."""
    suggestions = []
    for col in df.select_dtypes(include=["datetime64[ns]", "datetime64[ns, UTC]"]).columns:
        suggestions.append(
            {
                "column": col,
                "derived_columns": [
                    f"{col}_year",
                    f"{col}_month",
                    f"{col}_day",
                    f"{col}_weekday",
                    f"{col}_quarter",
                ],
                "action": "date_breakdown",
            }
        )
    return suggestions


def suggest_encoding(df: pd.DataFrame, cardinality_threshold: int = 20) -> list[dict[str, Any]]:
    """Return encoding suggestions for low-cardinality text columns."""
    suggestions = []
    for col in df.select_dtypes(include="object").columns:
        n_unique = df[col].nunique()
        if n_unique <= cardinality_threshold:
            encoding = "one_hot" if n_unique <= 10 else "label"
            suggestions.append(
                {
                    "column": col,
                    "unique_values": n_unique,
                    "suggested_encoding": encoding,
                    "action": "encode",
                }
            )
    return suggestions


def detect_derived_metrics(df: pd.DataFrame) -> list[dict[str, Any]]:
    """
    Detect common derived metric patterns in column names (revenue, cost, profit, etc.)
    and suggest calculated fields.
    """
    suggestions = []
    numeric_cols = list(df.select_dtypes(include="number").columns)
    col_lower = {c.lower(): c for c in numeric_cols}

    # Revenue - Cost → Profit
    for rev_key in ("revenue", "sales", "income"):
        for cost_key in ("cost", "expense", "expenditure"):
            if rev_key in col_lower and cost_key in col_lower:
                rev_col = col_lower[rev_key]
                cost_col = col_lower[cost_key]
                suggestions.append(
                    {
                        "name": "profit",
                        "formula": f"{rev_col} - {cost_col}",
                        "action": "derived_metric",
                    }
                )

    # Profit margin
    if "profit" in col_lower and ("revenue" in col_lower or "sales" in col_lower):
        base = col_lower.get("revenue") or col_lower.get("sales")
        suggestions.append(
            {
                "name": "profit_margin_pct",
                "formula": f"(profit / {base}) * 100",
                "action": "derived_metric",
            }
        )

    return suggestions


def build_feature_suggestions(df: pd.DataFrame) -> dict[str, Any]:
    """Combine all feature engineering suggestions into one response dict."""
    return {
        "date_breakdowns": suggest_date_breakdown(df),
        "encoding_suggestions": suggest_encoding(df),
        "derived_metrics": detect_derived_metrics(df),
    }
