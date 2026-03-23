"""
Register a PostgreSQL table for the dashboard builder (schema inspect + KPI aggregates).

Example (WMS "received" orders — default Django table name):
  python manage.py register_dataset wms_received public dashboard_totalordersreceived \\
    --name "Received orders"
"""

from django.core.management.base import BaseCommand, CommandError

from dashboard_meta.models import Dataset
from dashboard_meta.services.column_profiler import profile_dataset, table_exists


class Command(BaseCommand):
    help = "Register a table in dashboard_meta and run the column profiler."

    def add_arguments(self, parser):
        parser.add_argument("slug", help="Stable id for APIs, e.g. wms_received")
        parser.add_argument("schema_name", help="Usually public")
        parser.add_argument("table_name", help="Exact PG table name, e.g. dashboard_totalordersreceived")
        parser.add_argument("--name", dest="display_name", default="", help="Human-readable name")

    def handle(self, *args, **options):
        slug = options["slug"]
        schema = options["schema_name"]
        table = options["table_name"]
        name = options["display_name"] or slug.replace("_", " ").title()

        if Dataset.objects.filter(slug=slug).exists():
            raise CommandError(f"Dataset slug already exists: {slug}")
        if Dataset.objects.filter(schema_name=schema, table_name=table).exists():
            raise CommandError(f"Table already registered: {schema}.{table}")
        if not table_exists(schema, table):
            raise CommandError(
                f"Table not found: {schema}.{table}. "
                "Check the real name in PostgreSQL (often lowercase, e.g. dashboard_totalordersreceived)."
            )

        ds = Dataset.objects.create(
            slug=slug,
            name=name,
            schema_name=schema,
            table_name=table,
            owner="",
            default_filters={},
        )
        try:
            profile_dataset(ds)
        except Exception as e:
            ds.delete()
            raise CommandError(f"Profiling failed: {e}") from e

        ds.refresh_from_db()
        self.stdout.write(self.style.SUCCESS(f"Registered {schema}.{table} as '{slug}' ({ds.columns.count()} columns)."))
        self.stdout.write(f"Suggested widget: {ds.suggested_widget_type or '—'}")
