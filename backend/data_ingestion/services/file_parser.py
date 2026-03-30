"""
Parse uploaded CSV/Excel files into Polars DataFrames and load them into PostgreSQL.

Uses Polars for 5x faster reading with automatic type inference (no manual coercion).
DuckDB SUMMARIZE is used downstream by the column profiler for single-pass stats.
"""
from __future__ import annotations

import logging
import re
import uuid
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus

import polars as pl
from django.conf import settings

logger = logging.getLogger(__name__)

# Max rows to load per file (memory guard)
MAX_ROWS = 500_000


def _safe_table_name(filename: str) -> str:
    """Derive a safe PostgreSQL table name from the original filename."""
    stem = Path(filename).stem
    slug = re.sub(r"[^a-z0-9]+", "_", stem.lower()).strip("_")
    if not slug or slug[0].isdigit():
        slug = f"ds_{slug}"
    return f"upload_{slug}_{uuid.uuid4().hex[:6]}"


def _sanitize_columns(df: pl.DataFrame) -> pl.DataFrame:
    """Rename columns to be PostgreSQL-safe (alphanumeric + underscore only)."""
    rename_map = {
        col: re.sub(r"[^a-zA-Z0-9_]", "_", str(col)).strip("_") or f"col_{i}"
        for i, col in enumerate(df.columns)
    }
    # Handle duplicate names after sanitisation
    seen: dict[str, int] = {}
    final_map: dict[str, str] = {}
    for orig, safe in rename_map.items():
        if safe in seen:
            seen[safe] += 1
            safe = f"{safe}_{seen[safe]}"
        else:
            seen[safe] = 0
        final_map[orig] = safe
    return df.rename(final_map)


def parse_csv(file_path: str) -> pl.DataFrame:
    """
    Read a CSV file with Polars — automatic type inference, date parsing, 5x faster than pandas.
    Returns a Polars DataFrame (lazy schema detection on first 10k rows).
    """
    df = pl.read_csv(
        file_path,
        n_rows=MAX_ROWS,
        infer_schema_length=10_000,
        try_parse_dates=True,
        ignore_errors=True,
        null_values=["", "NA", "N/A", "null", "NULL", "None", "nan", "NaN"],
    )
    return _sanitize_columns(df)


def parse_excel(file_path: str) -> pl.DataFrame:
    """
    Read the first sheet of an Excel file with Polars + openpyxl engine.
    Returns a Polars DataFrame with automatic type inference.
    """
    df = pl.read_excel(
        file_path,
        sheet_id=1,
        engine="openpyxl",
        read_options={"infer_schema_length": 10_000},
    )
    # Cap rows
    if len(df) > MAX_ROWS:
        df = df.head(MAX_ROWS)
    return _sanitize_columns(df)


def load_dataframe_to_postgres(df: pl.DataFrame, table_name: str) -> int:
    """
    Write a Polars DataFrame to PostgreSQL via SQLAlchemy (pandas bridge for to_sql).
    Returns number of rows inserted.
    """
    from sqlalchemy import create_engine

    db_cfg = settings.DATABASES["default"]
    user = quote_plus(str(db_cfg.get("USER", "")))
    password = quote_plus(str(db_cfg.get("PASSWORD", "")))
    host = db_cfg.get("HOST") or "localhost"
    port = db_cfg.get("PORT") or "5432"
    name = db_cfg.get("NAME") or ""
    engine_url = f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{name}"
    engine = create_engine(engine_url, pool_pre_ping=True)

    # Convert Polars → pandas only for SQLAlchemy compatibility
    pdf = df.to_pandas()

    with engine.begin() as conn:
        pdf.to_sql(
            table_name,
            conn,
            schema="public",
            if_exists="replace",
            index=False,
            chunksize=10_000,
        )
    engine.dispose()
    return len(df)


def extract_schema_from_df(df: pl.DataFrame) -> list[dict[str, Any]]:
    """
    Return a list of column metadata dicts inferred from a Polars DataFrame.
    Uses Polars dtype API — no pandas required.
    """
    cols = []
    for col in df.columns:
        dtype = df[col].dtype

        if dtype in (pl.Date, pl.Datetime, pl.Time):
            kind = "datetime"
        elif dtype == pl.Boolean:
            kind = "boolean"
        elif dtype in (
            pl.Int8, pl.Int16, pl.Int32, pl.Int64,
            pl.UInt8, pl.UInt16, pl.UInt32, pl.UInt64,
            pl.Float32, pl.Float64,
        ):
            kind = "numeric"
        else:
            kind = "text"

        series = df[col]
        null_count = series.null_count()
        total = len(series)
        null_pct = round(null_count / total * 100, 2) if total else 0.0
        unique_count = series.n_unique()
        sample_values = [
            str(v) for v in series.drop_nulls().head(5).to_list()
        ]

        cols.append(
            {
                "col_name": col,
                "dtype": kind,
                "null_count": null_count,
                "null_pct": null_pct,
                "unique_count": unique_count,
                "sample_values": sample_values,
            }
        )
    return cols
