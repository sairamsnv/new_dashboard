from django.db import models


class AIJob(models.Model):
    """Tracks async AI tasks dispatched via Kafka."""

    TYPE_INSIGHTS = 'insights'
    TYPE_GRAPH_SUGGESTIONS = 'graph_suggestions'
    TYPE_NL_QUERY = 'nl_query'
    TYPE_WIDGET_BUILD = 'widget_build'
    TYPE_CHOICES = [
        (TYPE_INSIGHTS, 'Insights'),
        (TYPE_GRAPH_SUGGESTIONS, 'Graph Suggestions'),
        (TYPE_NL_QUERY, 'NL Query'),
        (TYPE_WIDGET_BUILD, 'Widget Build'),
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

    job_type = models.CharField(max_length=30, choices=TYPE_CHOICES)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_QUEUED)
    payload = models.JSONField(default=dict)
    result = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"AIJob #{self.pk} {self.job_type} ({self.status})"
