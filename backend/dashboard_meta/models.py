from django.db import models


class Dataset(models.Model):
    """
    Registered physical table (or view) that can be profiled and queried.
    Lives on the default DB (dashboard config / metadata), while the table
    itself is read via raw SQL on the same connection (e.g. public WMS tables).
    """

    slug = models.SlugField(unique=True, max_length=128)
    name = models.CharField(max_length=255)
    schema_name = models.CharField(max_length=63, default="public")
    table_name = models.CharField(max_length=127)
    owner = models.CharField(max_length=255, blank=True)
    default_filters = models.JSONField(default=dict, blank=True)
    profiled_at = models.DateTimeField(null=True, blank=True)
    suggested_widget_type = models.CharField(max_length=64, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(
                fields=["schema_name", "table_name"],
                name="uniq_dashboard_meta_dataset_schema_table",
            )
        ]

    def __str__(self):
        return f"{self.schema_name}.{self.table_name} ({self.slug})"


class ColumnMeta(models.Model):
    """Profiler output per column — drives widget suggestions in the UI."""

    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name="columns")
    col_name = models.CharField(max_length=127)
    pg_type = models.CharField(max_length=127, blank=True)
    dtype = models.CharField(max_length=32)  # numeric, text, datetime, boolean, unknown
    null_rate = models.FloatField(default=0.0)
    cardinality = models.IntegerField(null=True, blank=True)
    is_dimension = models.BooleanField(default=False)
    suggested_widget = models.CharField(max_length=64, blank=True)

    class Meta:
        ordering = ["col_name"]
        constraints = [
            models.UniqueConstraint(
                fields=["dataset", "col_name"],
                name="uniq_dashboard_meta_column_dataset_name",
            )
        ]

    def __str__(self):
        return f"{self.col_name} ({self.dtype})"


class SavedWidget(models.Model):
    """Persisted widget configuration from the builder (JSON blob)."""

    name = models.CharField(max_length=255, blank=True)
    dataset = models.ForeignKey(
        Dataset,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="saved_widgets",
    )
    widget_type = models.CharField(max_length=64)
    config = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]

    def __str__(self):
        return self.name or f"widget-{self.pk}"
