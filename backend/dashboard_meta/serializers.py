from rest_framework import serializers

from dashboard_meta.models import ColumnMeta, Dataset, SavedWidget


class ColumnMetaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ColumnMeta
        fields = (
            "col_name",
            "pg_type",
            "dtype",
            "null_rate",
            "cardinality",
            "is_dimension",
            "suggested_widget",
        )


class DatasetSerializer(serializers.ModelSerializer):
    columns = ColumnMetaSerializer(many=True, read_only=True)

    class Meta:
        model = Dataset
        fields = (
            "id",
            "slug",
            "name",
            "schema_name",
            "table_name",
            "owner",
            "default_filters",
            "profiled_at",
            "suggested_widget_type",
            "is_active",
            "created_at",
            "updated_at",
            "columns",
        )


class DatasetRegisterSerializer(serializers.Serializer):
    slug = serializers.SlugField(max_length=128)
    name = serializers.CharField(max_length=255)
    schema_name = serializers.CharField(max_length=63, default="public")
    table_name = serializers.CharField(max_length=127)
    owner = serializers.CharField(max_length=255, required=False, allow_blank=True)
    default_filters = serializers.JSONField(required=False, default=dict)

    def validate_slug(self, value):
        if Dataset.objects.filter(slug=value).exists():
            raise serializers.ValidationError("This slug is already registered.")
        return value


class DataQuerySerializer(serializers.Serializer):
    dataset = serializers.SlugField()
    columns = serializers.ListField(
        child=serializers.CharField(), required=False, allow_null=True
    )
    filters = serializers.ListField(
        child=serializers.DictField(), required=False, default=list
    )
    limit = serializers.IntegerField(required=False, default=500, min_value=1, max_value=5000)
    order_by = serializers.CharField(required=False, allow_null=True, allow_blank=True)


class SavedWidgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedWidget
        fields = ("id", "name", "dataset", "widget_type", "config", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")
