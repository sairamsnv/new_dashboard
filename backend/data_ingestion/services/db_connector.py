"""
External database connectors for MySQL, PostgreSQL, and MongoDB.
Uses SQLAlchemy for relational engines and pymongo for MongoDB.

Polars read_database_uri (via connectorx) is used to pull table samples
into memory so the same DuckDB profiling pipeline as file uploads can run.
"""
from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote_plus

logger = logging.getLogger(__name__)

# Max rows sampled from each external table (memory guard)
DB_SAMPLE_ROWS = 50_000


def _build_sqlalchemy_url(engine: str, host: str, port: int, db_name: str, username: str, password: str) -> str:
    u = quote_plus(username)
    p = quote_plus(password)
    if engine == "postgresql":
        return f"postgresql+psycopg2://{u}:{p}@{host}:{port}/{db_name}"
    if engine == "mysql":
        return f"mysql+pymysql://{u}:{p}@{host}:{port}/{db_name}"
    raise ValueError(f"Unsupported engine: {engine}")


def test_connection(
    engine: str,
    host: str,
    port: int,
    db_name: str,
    username: str,
    password: str,
    schema_name: str = "public",
) -> dict[str, Any]:
    """
    Test connectivity and return a status dict.
    Returns: {"success": bool, "error": str | None, "tables": list[str]}

    schema_name: PostgreSQL schema to list tables from (default: 'public').
                 Pass the actual schema name (e.g. 'wms_test') to read from a
                 non-default schema.  Ignored for MySQL / MongoDB.
    """
    if engine == "mongodb":
        return _test_mongo(host, port, db_name, username, password)

    from sqlalchemy import create_engine, inspect, text

    url = _build_sqlalchemy_url(engine, host, port, db_name, username, password)
    try:
        eng = create_engine(url, connect_args={"connect_timeout": 5}, pool_pre_ping=True)
        with eng.connect() as conn:
            conn.execute(text("SELECT 1"))
        inspector = inspect(eng)
        pg_schema = schema_name if (engine == "postgresql" and schema_name) else None
        tables = inspector.get_table_names(schema=pg_schema)
        eng.dispose()
        return {"success": True, "error": None, "tables": tables, "schema_name": schema_name}
    except Exception as exc:
        logger.exception("DB connection test failed")
        return {"success": False, "error": str(exc), "tables": []}


def _test_mongo(host: str, port: int, db_name: str, username: str, password: str) -> dict[str, Any]:
    try:
        import pymongo

        uri = f"mongodb://{username}:{password}@{host}:{port}/{db_name}?authSource=admin"
        client = pymongo.MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.server_info()
        tables = client[db_name].list_collection_names()
        client.close()
        return {"success": True, "error": None, "tables": tables}
    except Exception as exc:
        logger.exception("MongoDB connection test failed")
        return {"success": False, "error": str(exc), "tables": []}


def list_tables(
    engine: str, host: str, port: int, db_name: str, username: str, password: str, schema_name: str = "public"
) -> list[str]:
    result = test_connection(engine, host, port, db_name, username, password, schema_name=schema_name)
    return result.get("tables", [])


def _build_connectorx_uri(engine: str, host: str, port: int, db_name: str, username: str, password: str) -> str:
    """Build a connectorx-compatible URI (Polars read_database_uri uses this)."""
    u = quote_plus(username)
    p = quote_plus(password)
    if engine == "postgresql":
        return f"postgresql://{u}:{p}@{host}:{port}/{db_name}"
    if engine == "mysql":
        return f"mysql://{u}:{p}@{host}:{port}/{db_name}"
    raise ValueError(f"Polars read_database_uri not supported for engine: {engine}")


def read_table_sample(
    engine: str,
    host: str,
    port: int,
    db_name: str,
    username: str,
    password: str,
    table_name: str,
    schema_name: str = "public",
    max_rows: int = DB_SAMPLE_ROWS,
) -> "pl.DataFrame":
    """
    Read up to `max_rows` rows from an external database table using Polars.

    Uses connectorx as the backend (pure Rust, zero-copy Arrow transfer) —
    the same speed profile as reading a local Parquet file.

    schema_name: PostgreSQL schema containing the table (e.g. 'wms_test').
                 Defaults to 'public'. Ignored for MySQL.

    After this call the data lives in a Polars DataFrame in memory, so the
    identical DuckDB SUMMARIZE profiling pipeline used for file uploads applies:
        read_table_sample()  →  load_dataframe_to_postgres()  →  profile_dataset_from_dataframe()
    """
    import polars as pl

    if engine == "mongodb":
        raise ValueError("MongoDB does not support SQL sampling; use file export instead.")

    # Build a fully-qualified, safely-quoted table reference
    if engine == "postgresql":
        schema = schema_name or "public"
        quoted_table = f'"{schema}"."{table_name}"'
    elif engine == "mysql":
        quoted_table = f"`{table_name}`"
    else:
        quoted_table = table_name

    query = f"SELECT * FROM {quoted_table} LIMIT {max_rows}"
    uri = _build_connectorx_uri(engine, host, port, db_name, username, password)

    try:
        df = pl.read_database_uri(query=query, uri=uri, engine="connectorx")
        logger.info(
            "read_table_sample: loaded %d rows × %d cols from %s.%s.%s via connectorx",
            len(df), len(df.columns), db_name, schema_name, table_name,
        )
        return df
    except Exception as exc:
        logger.error("read_table_sample failed for %s.%s.%s: %s", db_name, schema_name, table_name, exc)
        raise
