from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    TotalReturnOrdersViewSet,
    PodUpdatedOrdersViewSet,
    OrdersPendingDeliveriesViewSet,
    OrdersAssignedToDriversViewSet,
    TotalLoadPlansViewSet,
    TotalSalesOrdersViewSet,
    dr_dashboard_kpis,
    dr_dashboard_stats,
    dr_active_drivers,
    dr_active_orders,
    dr_document_types,
    dr_driver_assignments_today,
    dr_debug_dates
)

router = DefaultRouter()
router.register(r'return-orders', TotalReturnOrdersViewSet)
router.register(r'pod-updated-orders', PodUpdatedOrdersViewSet)
router.register(r'pending-deliveries', OrdersPendingDeliveriesViewSet)
router.register(r'assigned-to-drivers', OrdersAssignedToDriversViewSet)
router.register(r'load-plans', TotalLoadPlansViewSet)
router.register(r'sales-orders', TotalSalesOrdersViewSet)

urlpatterns = [
    path('api/dr/', include(router.urls)),
    path('api/dr/kpis/', dr_dashboard_kpis),
    path('api/dr/stats/', dr_dashboard_stats),
    path('api/dr/active-drivers/', dr_active_drivers),
    path('api/dr/active-orders/', dr_active_orders),
    path('api/dr/document-types/', dr_document_types),
    path('api/dr/driver-assignments-today/', dr_driver_assignments_today),
    path('api/dr/debug-dates/', dr_debug_dates),
]
