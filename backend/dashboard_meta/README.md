# Dashboard builder metadata (`dashboard_meta`)

Implements the **schema inspect → widget suggestion → saved config** flow:

- **Column profiler** — reads `information_schema.columns` and `pg_stats`, writes `ColumnMeta` rows.
- **Widget resolver** — maps column shapes to a suggested widget type (`kpi-card`, `line-chart`, `bar-chart`, `pie-chart`, `table`).
- **Safe query API** — `POST /api/data/query/` runs read-only `SELECT` using only registered columns.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/schema/datasets/` | List registered datasets (for builder dropdowns) |
| `GET` | `/api/schema/inspect/?dataset=<slug>&refresh=1` | Load dataset + columns; `refresh=1` re-runs profiler |
| `POST` | `/api/schema/inspect/` | Register `{ slug, name, schema_name, table_name, ... }` and profile |
| `GET` | `/api/data/aggregate/?dataset=<slug>&op=count|count_distinct|sum|avg&column=` | Single number for dynamic KPI cards |
| `POST` | `/api/data/query/` | `{ "dataset": "<slug>", "columns": [...], "filters": [...], "limit": 500 }` |
| `GET`/`POST` | `/api/widgets/` | List / create saved widget JSON |
| `GET`/`PATCH`/`DELETE` | `/api/widgets/<id>/` | One saved widget |

Metadata tables (`Dataset`, `ColumnMeta`, `SavedWidget`) migrate on the **default** database (same connection as WMS `public` tables). Operational WMS/DR data stays read-only from the query endpoint.

## Register a table (choose one)

### A) Django management command (easiest)

From `backend/` (with DB reachable):

```bash
python manage.py register_dataset wms_received public dashboard_totalordersreceived \
  --name "Received orders"
```

Use the **exact** PostgreSQL table name. For Django models without `Meta.db_table`, it is usually `app_label_modelname` in lowercase, e.g. `dashboard_totalordersreceived` for `dashboard.TotalOrdersReceived`.

### B) HTTP API

```bash
curl -X POST http://127.0.0.1:8000/api/schema/inspect/ \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "packed_orders",
    "name": "Packed / picked orders",
    "schema_name": "public",
    "table_name": "dashboard_packedorpickedorder"
  }'
```

After registering, `GET /api/schema/datasets/` returns your dataset(s) instead of `[]`.

## Next steps (frontend)

- On dataset pick: `GET /api/schema/inspect/?dataset=...` → fill a **schema store** (Zustand) with `columns` + `suggested_widget_type`.
- Default the widget type in the builder; allow override; `POST /api/widgets/` to persist.

Optional later: Celery task to re-profile large tables asynchronously.
