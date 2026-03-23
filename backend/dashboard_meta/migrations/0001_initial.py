# Generated manually for dashboard_meta

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Dataset",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("slug", models.SlugField(max_length=128, unique=True)),
                ("name", models.CharField(max_length=255)),
                ("schema_name", models.CharField(default="public", max_length=63)),
                ("table_name", models.CharField(max_length=127)),
                ("owner", models.CharField(blank=True, max_length=255)),
                ("default_filters", models.JSONField(blank=True, default=dict)),
                ("profiled_at", models.DateTimeField(blank=True, null=True)),
                ("suggested_widget_type", models.CharField(blank=True, max_length=64)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={
                "ordering": ["name"],
            },
        ),
        migrations.AddConstraint(
            model_name="dataset",
            constraint=models.UniqueConstraint(
                fields=("schema_name", "table_name"),
                name="uniq_dashboard_meta_dataset_schema_table",
            ),
        ),
        migrations.CreateModel(
            name="ColumnMeta",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("col_name", models.CharField(max_length=127)),
                ("pg_type", models.CharField(blank=True, max_length=127)),
                ("dtype", models.CharField(max_length=32)),
                ("null_rate", models.FloatField(default=0.0)),
                ("cardinality", models.IntegerField(blank=True, null=True)),
                ("is_dimension", models.BooleanField(default=False)),
                ("suggested_widget", models.CharField(blank=True, max_length=64)),
                (
                    "dataset",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="columns",
                        to="dashboard_meta.dataset",
                    ),
                ),
            ],
            options={
                "ordering": ["col_name"],
            },
        ),
        migrations.AddConstraint(
            model_name="columnmeta",
            constraint=models.UniqueConstraint(
                fields=("dataset", "col_name"),
                name="uniq_dashboard_meta_column_dataset_name",
            ),
        ),
        migrations.CreateModel(
            name="SavedWidget",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(blank=True, max_length=255)),
                ("widget_type", models.CharField(max_length=64)),
                ("config", models.JSONField(default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "dataset",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="saved_widgets",
                        to="dashboard_meta.dataset",
                    ),
                ),
            ],
            options={
                "ordering": ["-updated_at"],
            },
        ),
    ]
