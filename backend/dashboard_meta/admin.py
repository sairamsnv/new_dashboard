from django.contrib import admin

from dashboard_meta.models import ColumnMeta, Dataset, SavedWidget


class ColumnMetaInline(admin.TabularInline):
    model = ColumnMeta
    extra = 0
    readonly_fields = (
        "col_name",
        "pg_type",
        "dtype",
        "null_rate",
        "cardinality",
        "is_dimension",
        "suggested_widget",
    )
    can_delete = False


@admin.register(Dataset)
class DatasetAdmin(admin.ModelAdmin):
    list_display = ("slug", "name", "schema_name", "table_name", "suggested_widget_type", "profiled_at")
    search_fields = ("slug", "name", "table_name")
    inlines = [ColumnMetaInline]


@admin.register(SavedWidget)
class SavedWidgetAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "widget_type", "dataset", "updated_at")
    search_fields = ("name",)
