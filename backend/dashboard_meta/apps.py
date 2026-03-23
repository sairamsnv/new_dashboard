from django.apps import AppConfig


class DashboardMetaConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "dashboard_meta"
    verbose_name = "Dashboard builder metadata"
