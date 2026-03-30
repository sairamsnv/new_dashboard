from django.db import models


class UploadedFile(models.Model):
    """Tracks every CSV/Excel file uploaded by a user."""

    SOURCE_CSV = 'csv'
    SOURCE_EXCEL = 'excel'
    SOURCE_CHOICES = [(SOURCE_CSV, 'CSV'), (SOURCE_EXCEL, 'Excel')]

    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_READY = 'ready'
    STATUS_ERROR = 'error'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_READY, 'Ready'),
        (STATUS_ERROR, 'Error'),
    ]

    original_filename = models.CharField(max_length=255)
    file_path = models.CharField(max_length=512)
    source_type = models.CharField(max_length=10, choices=SOURCE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    error_message = models.TextField(blank=True)
    row_count = models.IntegerField(null=True, blank=True)
    col_count = models.IntegerField(null=True, blank=True)
    # slug of the dashboard_meta.Dataset created after loading
    dataset_slug = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.original_filename} ({self.status})"


class DatabaseConnection(models.Model):
    """Stored external DB credentials for connecting MySQL/PostgreSQL/MongoDB."""

    ENGINE_MYSQL = 'mysql'
    ENGINE_POSTGRES = 'postgresql'
    ENGINE_MONGO = 'mongodb'
    ENGINE_CHOICES = [
        (ENGINE_MYSQL, 'MySQL'),
        (ENGINE_POSTGRES, 'PostgreSQL'),
        (ENGINE_MONGO, 'MongoDB'),
    ]

    STATUS_PENDING = 'pending'
    STATUS_CONNECTED = 'connected'
    STATUS_ERROR = 'error'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_CONNECTED, 'Connected'),
        (STATUS_ERROR, 'Error'),
    ]

    name = models.CharField(max_length=255)
    engine = models.CharField(max_length=20, choices=ENGINE_CHOICES)
    host = models.CharField(max_length=255)
    port = models.IntegerField()
    db_name = models.CharField(max_length=255)
    username = models.CharField(max_length=255)
    password_enc = models.TextField()  # store encrypted in production
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)
    error_message = models.TextField(blank=True)
    tables_discovered = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.engine})"


class IngestionJob(models.Model):
    """Async job record — tracks Kafka-dispatched ingestion + profiling work."""

    JOB_FILE_INGEST = 'file_ingest'
    JOB_DB_CONNECT = 'db_connect'
    JOB_TYPE_CHOICES = [
        (JOB_FILE_INGEST, 'File Ingestion'),
        (JOB_DB_CONNECT, 'DB Connection'),
    ]

    STATUS_QUEUED = 'queued'
    STATUS_RUNNING = 'running'
    STATUS_DONE = 'done'
    STATUS_ERROR = 'error'
    STATUS_CHOICES = [
        (STATUS_QUEUED, 'Queued'),
        (STATUS_RUNNING, 'Running'),
        (STATUS_DONE, 'Done'),
        (STATUS_ERROR, 'Error'),
    ]

    job_type = models.CharField(max_length=30, choices=JOB_TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_QUEUED)
    payload = models.JSONField(default=dict)
    result = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Job #{self.pk} {self.job_type} ({self.status})"
