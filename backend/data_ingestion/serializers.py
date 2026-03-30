from rest_framework import serializers

from data_ingestion.models import DatabaseConnection, IngestionJob, UploadedFile


class UploadedFileSerializer(serializers.ModelSerializer):
    class Meta:
        model = UploadedFile
        fields = [
            'id', 'original_filename', 'source_type', 'status',
            'row_count', 'col_count', 'dataset_slug', 'error_message',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields


class DatabaseConnectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DatabaseConnection
        fields = [
            'id', 'name', 'engine', 'host', 'port', 'db_name', 'username',
            'status', 'error_message', 'tables_discovered', 'created_at',
        ]
        read_only_fields = [
            'id', 'status', 'error_message', 'tables_discovered', 'created_at',
        ]
        extra_kwargs = {'password_enc': {'write_only': True}}


class DBConnectRequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    engine = serializers.ChoiceField(choices=['mysql', 'postgresql', 'mongodb'])
    host = serializers.CharField(max_length=255)
    port = serializers.IntegerField(min_value=1, max_value=65535)
    db_name = serializers.CharField(max_length=255)
    username = serializers.CharField(max_length=255)
    password = serializers.CharField(max_length=512)
    # Optional: specific schema to read tables from (PostgreSQL only; defaults to 'public')
    schema_name = serializers.CharField(max_length=255, required=False, default='public')


class IngestionJobSerializer(serializers.ModelSerializer):
    class Meta:
        model = IngestionJob
        fields = ['id', 'job_type', 'status', 'result', 'error_message', 'created_at', 'updated_at']
        read_only_fields = fields
