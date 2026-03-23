"""
Map a set of column profiles to a suggested dashboard widget type.
Rules match the architecture plan (KPI, line, bar, pie, table).
"""


def resolve_widget_type(columns: list[dict]) -> str:
    """
    columns: list of dicts with keys dtype, cardinality (optional), col_name (optional).
    dtype in: numeric, text, datetime, boolean, unknown
    """
    if not columns:
        return "table"

    nums = [c for c in columns if c.get("dtype") == "numeric"]
    dts = [c for c in columns if c.get("dtype") == "datetime"]
    texts = [c for c in columns if c.get("dtype") == "text"]
    bools = [c for c in columns if c.get("dtype") == "boolean"]

    def card(c):
        return c.get("cardinality")

    low_card_text = [
        c
        for c in texts
        if card(c) is not None and card(c) <= 50
    ]

    # Wide / mixed → table
    if len(columns) >= 10:
        return "table"

    # Single metric
    if len(nums) == 1 and len(dts) == 0 and len(texts) == 0 and len(bools) == 0:
        return "kpi-card"
    if len(nums) == 1 and len(columns) == 1:
        return "kpi-card"

    # Time series
    if len(dts) >= 1 and len(nums) >= 1 and len(nums) <= 4 and len(columns) <= 8:
        return "line-chart"

    # Category + metrics
    if len(low_card_text) >= 1 and len(nums) >= 2:
        return "bar-chart"
    if len(low_card_text) >= 1 and len(nums) == 1:
        return "bar-chart"

    # Boolean / status distribution
    if bools and len(nums) == 0 and len(dts) == 0:
        return "pie-chart"
    if len(low_card_text) == 1 and len(nums) == 0 and not dts:
        return "pie-chart"

    if len(columns) >= 5:
        return "table"

    return "table"


def suggest_column_role(col: dict) -> str:
    """Lightweight per-column hint for the builder UI."""
    dt = col.get("dtype")
    card = col.get("cardinality")
    if dt == "datetime":
        return "time"
    if dt == "numeric":
        return "metric"
    if dt in ("text", "boolean") and card is not None and card <= 50:
        return "dimension"
    if dt in ("text", "boolean"):
        return "dimension"
    return ""
