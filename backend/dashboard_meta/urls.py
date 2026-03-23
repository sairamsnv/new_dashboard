from django.urls import path

from dashboard_meta import views

urlpatterns = [
    path("api/schema/inspect/", views.schema_inspect, name="schema-inspect"),
    path("api/schema/datasets/", views.dataset_list, name="schema-datasets"),
    path("api/data/query/", views.data_query, name="data-query"),
    path("api/data/aggregate/", views.data_aggregate, name="data-aggregate"),
    path("api/widgets/", views.widgets_api, name="widgets-list-create"),
    path("api/widgets/<int:pk>/", views.widget_detail, name="widgets-detail"),
]
