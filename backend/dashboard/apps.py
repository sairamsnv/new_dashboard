from django.apps import AppConfig
import logging

class DashboardConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard'
    def ready(self):
        from dashboard.background_thread import start_scheduler
        logging.info("Initializing APScheduler from ready()...")
        start_scheduler()
