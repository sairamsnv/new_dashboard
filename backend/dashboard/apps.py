from django.apps import AppConfig
from django.conf import settings
import logging


class DashboardConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'dashboard'

    def ready(self):
        if not getattr(settings, "ENABLE_BACKGROUND_SCHEDULER", True):
            logging.info(
                "Background APScheduler skipped (ENABLE_BACKGROUND_SCHEDULER is off)."
            )
            return
        from dashboard.background_thread import start_scheduler

        logging.info("Initializing APScheduler from ready()...")
        start_scheduler()
