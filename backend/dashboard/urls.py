from django.urls import path,re_path


app_name = 'dashboard'





from .views import (
    get_kpis, warehouse_trends_api, OrdersAPIView, FrontendAppView,
    employee_performance_api, warehouse_trend_api, sales_purchase_api,
    sales_purchase_trends_api, insights_api,
    pending_approval_inventory_adjustments_api, reorder_items_api,
    serve_react_assets, serve_react_file,
)


urlpatterns = [
    path('api/kpis/', get_kpis),
    path('api/warehouse_trends/', warehouse_trends_api),
    path('api/orders/', OrdersAPIView.as_view()),
    path('api/employee-performance/', employee_performance_api),
    path('api/warehouse-trend/', warehouse_trend_api),
    path('api/sales-purchase/', sales_purchase_api),
    path('api/sales-purchase-trends/', sales_purchase_trends_api),
    path('api/insights/', insights_api),
    path('api/pending-approval-inventory-adjustments/', pending_approval_inventory_adjustments_api),
    path('api/reorder-items/', reorder_items_api),

    # Vite build: hashed JS/CSS under /assets/ (must run before SPA catch-all)
    re_path(r'^assets/(?P<path>.*)$', serve_react_assets),
    re_path(r'^favicon\.ico$', serve_react_file, kwargs={'name': 'favicon.ico'}),
    re_path(r'^robots\.txt$', serve_react_file, kwargs={'name': 'robots.txt'}),
    re_path(r'^placeholder\.svg$', serve_react_file, kwargs={'name': 'placeholder.svg'}),

    # Only catch non-API and non-auth routes for React fallback
    # Exclude: /api/*, /auth/*, /admin/*, /assets/*, /graphql/* (Strawberry)
    re_path(
        r'^(?!api/)(?!auth/)(?!admin/)(?!assets/)(?!graphql/).*$',
        FrontendAppView.as_view(),
        name='frontend',
    ),
]
