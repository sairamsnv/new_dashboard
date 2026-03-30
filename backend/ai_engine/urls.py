from django.urls import path

from ai_engine import views

urlpatterns = [
    path('api/ai/insights/', views.ai_insights, name='ai-insights'),
    path('api/ai/graph-suggestions/', views.ai_graph_suggestions, name='ai-graph-suggestions'),
    path('api/ai/nl-query/', views.ai_nl_query, name='ai-nl-query'),
    path('api/ai/widget-build/', views.ai_widget_build, name='ai-widget-build'),
    path('api/ai/jobs/<int:job_id>/', views.ai_job_status, name='ai-job-status'),
]
