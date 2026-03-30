from django.urls import path

from data_ingestion import views

urlpatterns = [
    path('api/ingest/upload/', views.upload_file, name='ingest-upload'),
    path('api/ingest/db-connect/', views.db_connect, name='ingest-db-connect'),
    path('api/ingest/files/', views.list_files, name='ingest-files'),
    path('api/ingest/connections/', views.list_db_connections, name='ingest-connections'),
    path('api/ingest/status/<int:job_id>/', views.job_status, name='ingest-job-status'),
]
