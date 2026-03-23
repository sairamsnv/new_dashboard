from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView
from django.conf import settings
from collections import defaultdict
from datetime import datetime, timedelta, date, time
from django.utils import timezone
import calendar
import logging

from dashboard.models import (
    OpenPurchaseOrder, OpenSalesOrder,
    PackedOrPickedOrder, TotalOrdersReceived,
    PendingApprovalInventoryAdjustments, ReOrderItems,
    ItemsFromFulfillments, ItemsFromReceipts,
    TransactionsCreatedByWMS, InventoryAdjustmentData,
    InventoryCountData, PendingApprovalInventoryCounts
)
from dashboard.serializers import (
    WarehouseTrendSerializer,
    OpenSalesOrderSerializer,
    PackedOrPickedOrderSerializer,
    TotalOrdersReceivedSerializer,
    PendingApprovalInventoryAdjustmentsSerializer,
    ReOrderItemsSerializer
)
from django.views import View
from django.views.static import serve
from django.http import HttpResponse

from django.conf import settings
import os


def serve_react_assets(request, path):
    """Vite emits /assets/*.js and /assets/*.css; serve real files, not index.html."""
    static_assets = os.path.join(settings.STATIC_ROOT, 'assets')
    root = static_assets if os.path.isdir(static_assets) else os.path.join(settings.REACT_BUILD_DIR, 'assets')
    return serve(request, path, document_root=root)


def serve_react_file(request, name):
    """Root files from Vite dist (favicon.ico, robots.txt, etc.)."""
    for root in (settings.STATIC_ROOT, settings.REACT_BUILD_DIR):
        if os.path.isfile(os.path.join(root, name)):
            return serve(request, name, document_root=root)
    return serve(request, name, document_root=settings.REACT_BUILD_DIR)

# Optional ML imports - only use if available
try:
    from sklearn.ensemble import IsolationForest
    ML_AVAILABLE = True
except ImportError:
    ML_AVAILABLE = False
    logging.warning("scikit-learn not available. ML features disabled.")


class HTTPSPageNumberPagination(PageNumberPagination):
    """Custom pagination that ensures HTTPS URLs in production"""
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100
    
    def get_next_link(self):
        if not self.page.has_next():
            return None
        url = super().get_next_link()
        if url and 'rare.netscoretech.com' in settings.ALLOWED_HOSTS:
            url = url.replace('http://', 'https://')
        return url
    
    def get_previous_link(self):
        if not self.page.has_previous():
            return None
        url = super().get_previous_link()
        if url and 'rare.netscoretech.com' in settings.ALLOWED_HOSTS:
            url = url.replace('http://', 'https://')
        return url


def get_timeframe_date_range(timeframe: str):
    """
    Get start and end dates for the current period based on timeframe.
    
    Args:
        timeframe: 'today', 'yesterday', 'week', 'last week', 'month', 'last month', 'year', 'last year'
    
    Returns:
        tuple: (start_date, end_date) as datetime objects
        For 'today': both are today at 00:00:00
        For 'yesterday': both are yesterday at 00:00:00
        For 'week': Monday 00:00:00 to Sunday 23:59:59 of current week
        For 'last week': Monday 00:00:00 to Sunday 23:59:59 of previous week
        For 'month': First day 00:00:00 to last day 23:59:59 of current month
        For 'last month': First day 00:00:00 to last day 23:59:59 of previous month
        For 'year': January 1 00:00:00 to December 31 23:59:59 of current year
        For 'last year': January 1 00:00:00 to December 31 23:59:59 of previous year
    """
    now = timezone.now()
    today = now.date()
    
    if timeframe == 'today':
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        return start_date, end_date
    elif timeframe == 'yesterday':
        yesterday = today - timedelta(days=1)
        start_date = timezone.make_aware(datetime.combine(yesterday, time.min))
        end_date = timezone.make_aware(datetime.combine(yesterday, time.max))
        return start_date, end_date
    elif timeframe == 'week':
        # Get Monday of current week
        days_since_monday = today.weekday()  # Monday is 0
        monday = today - timedelta(days=days_since_monday)
        # Get Sunday of current week
        sunday = monday + timedelta(days=6)
        start_date = timezone.make_aware(datetime.combine(monday, time.min))
        end_date = timezone.make_aware(datetime.combine(sunday, time.max))
        return start_date, end_date
    elif timeframe == 'last week':
        # Get Monday of current week, then go back 7 days
        days_since_monday = today.weekday()  # Monday is 0
        current_monday = today - timedelta(days=days_since_monday)
        last_monday = current_monday - timedelta(days=7)
        last_sunday = last_monday + timedelta(days=6)
        start_date = timezone.make_aware(datetime.combine(last_monday, time.min))
        end_date = timezone.make_aware(datetime.combine(last_sunday, time.max))
        return start_date, end_date
    elif timeframe == 'month':
        # First day of current month
        first_day = today.replace(day=1)
        # Last day of current month
        last_day = today.replace(day=calendar.monthrange(today.year, today.month)[1])
        start_date = timezone.make_aware(datetime.combine(first_day, time.min))
        end_date = timezone.make_aware(datetime.combine(last_day, time.max))
        return start_date, end_date
    elif timeframe == 'last month':
        # First day of previous month
        if today.month == 1:
            first_day = today.replace(year=today.year - 1, month=12, day=1)
        else:
            first_day = today.replace(month=today.month - 1, day=1)
        # Last day of previous month
        last_day = first_day.replace(day=calendar.monthrange(first_day.year, first_day.month)[1])
        start_date = timezone.make_aware(datetime.combine(first_day, time.min))
        end_date = timezone.make_aware(datetime.combine(last_day, time.max))
        return start_date, end_date
    elif timeframe == 'year':
        # January 1 of current year
        first_day = today.replace(month=1, day=1)
        # December 31 of current year
        last_day = today.replace(month=12, day=31)
        start_date = timezone.make_aware(datetime.combine(first_day, time.min))
        end_date = timezone.make_aware(datetime.combine(last_day, time.max))
        return start_date, end_date
    elif timeframe == 'last year':
        # January 1 of previous year
        first_day = today.replace(year=today.year - 1, month=1, day=1)
        # December 31 of previous year
        last_day = today.replace(year=today.year - 1, month=12, day=31)
        start_date = timezone.make_aware(datetime.combine(first_day, time.min))
        end_date = timezone.make_aware(datetime.combine(last_day, time.max))
        return start_date, end_date
    else:
        # Default to today
        start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_date = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        return start_date, end_date


class FrontendAppView(View):
    def get(self, request):
        try:
            # Try STATIC_ROOT first (production - after collectstatic)
            file_path = os.path.join(settings.STATIC_ROOT, 'index.html')
            if not os.path.exists(file_path):
                # Fallback to REACT_BUILD_DIR (development)
                file_path = os.path.join(settings.REACT_BUILD_DIR, 'index.html')
            with open(file_path, 'r', encoding='utf-8') as f:
                return HttpResponse(f.read())
        except FileNotFoundError:
            return HttpResponse(
                "index.html not found. Run 'npm run build' in new_fronend, then 'python manage.py collectstatic' in backend.",
                status=404,
            )
        except Exception as e:
            return HttpResponse(f"Error serving frontend: {str(e)}", status=500)


@api_view(['GET'])
def get_kpis(request):
    """API view to fetch total, packed, picked, and received orders."""
    timeframe = request.GET.get('timeframe', 'today')
    
    from django.db.models import Q
    
    # Get date range for current period
    start_date, end_date = get_timeframe_date_range(timeframe)
    
    # Count picked and packed orders with timeframe filter
    # Picked orders: has picker (regardless of packer status) - matches chart logic
    picked = PackedOrPickedOrder.objects.filter(
        dateCreated__gte=start_date,
        dateCreated__lte=end_date
    ).filter(
        Q(picker__isnull=False) & ~Q(picker='')
    ).count()
    
    # Packed orders: has packer (regardless of picker status) - matches chart logic
    packed = PackedOrPickedOrder.objects.filter(
        dateCreated__gte=start_date,
        dateCreated__lte=end_date
    ).filter(
        Q(packer__isnull=False) & ~Q(packer='')
    ).count()
    
    received = TotalOrdersReceived.objects.filter(
        createdDate__gte=start_date.date(),
        createdDate__lte=end_date.date()
    ).count()
    
    # Calculate total as sum of picked + packed + received
    # Note: This may double-count orders that are both picked and packed
    # but this matches the chart logic for consistency
    total = picked + packed + received

    kpis = [
        {"title": "Total", "value": total},
        {"title": "Picked", "value": picked},
        {"title": "Packed", "value": packed},
        {"title": "Received", "value": received},
    ]
    return Response(kpis)

@api_view(['GET'])
def warehouse_trends_api(request):
    """
    API to view total sales and total purchase orders per month.

    Query Params:
    - ?type=all|po|so (filter by order type)
    """
    order_filter = request.GET.get('type', 'all')

    sales_data = OpenSalesOrder.objects.all()
    purchase_data = OpenPurchaseOrder.objects.all()

    if order_filter == "so":
        purchase_data = OpenPurchaseOrder.objects.none()
    elif order_filter == "po":
        sales_data = OpenSalesOrder.objects.none()

    sales_count = defaultdict(int)
    for order in sales_data:
        if order.dateCreated:
            key = order.dateCreated.strftime("%b %Y")
            sales_count[key] += 1

    purchase_count = defaultdict(int)
    for order in purchase_data:
        if order.tranDate:
            key = order.tranDate.strftime("%b %Y")
            purchase_count[key] += 1

    all_months = sorted(set(sales_count.keys()) | set(purchase_count.keys()))

    trends = []
    for month in all_months:
        trends.append({
            "month": month,
            "sales": sales_count.get(month, 0),
            "purchases": purchase_count.get(month, 0),
        })

    serialized = WarehouseTrendSerializer(trends, many=True)
    return Response(serialized.data)


class OrdersAPIView(APIView):
    """API view to retrieve orders with pagination and filters."""
    pagination_class = HTTPSPageNumberPagination

    def get(self, request):
        order_filter = request.query_params.get('type')
        customer = request.query_params.get('customer')
        date = request.query_params.get('date')
        timeframe = request.query_params.get('timeframe', 'today')
        
        # Get date range for current period
        start_date, end_date = get_timeframe_date_range(timeframe)

        if order_filter == "received":
            # Handle received orders from TotalOrdersReceived model
            orders = TotalOrdersReceived.objects.all()
            
            # Apply timeframe filter
            orders = orders.filter(
                createdDate__gte=start_date.date(),
                createdDate__lte=end_date.date()
            )
            
            # Apply customer filter (supplier for received orders)
            if customer:
                orders = orders.filter(supplier__icontains=customer)
            
            # Apply date filter
            if date:
                try:
                    dt = datetime.strptime(date, '%Y-%m-%d').date()
                    orders = orders.filter(createdDate=dt)
                except ValueError:
                    return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=400)
            
            paginator = self.pagination_class()
            page = paginator.paginate_queryset(orders, request)
            serialized = TotalOrdersReceivedSerializer(page, many=True)
            return paginator.get_paginated_response(serialized.data)
        else:
            # Handle picked and packed orders from PackedOrPickedOrder model
            orders = PackedOrPickedOrder.objects.all()
            
            # Apply timeframe filter
            orders = orders.filter(
                dateCreated__gte=start_date,
                dateCreated__lte=end_date
            )

            if order_filter == "picked":
                orders = orders.exclude(picker='').exclude(picker__isnull=True)
            elif order_filter == "packed":
                orders = orders.exclude(packer='').exclude(packer__isnull=True)

            if customer:
                orders = orders.filter(customer__icontains=customer)

            if date:
                try:
                    dt = datetime.strptime(date, '%Y-%m-%d')
                    orders = orders.filter(dateCreated__date=dt)
                except ValueError:
                    return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=400)

            paginator = self.pagination_class()
            page = paginator.paginate_queryset(orders, request)
            serialized = PackedOrPickedOrderSerializer(page, many=True)
            return paginator.get_paginated_response(serialized.data)


@api_view(['GET'])
def employee_performance_api(request):
    """API view to fetch employee performance data."""
    timeframe = request.GET.get('timeframe', 'today')
    
    from django.db.models import Count
    
    # Get date range for current period
    start_date, end_date = get_timeframe_date_range(timeframe)
    
    # Count orders by picker with timeframe filter - exclude None and empty values
    pickers = PackedOrPickedOrder.objects.filter(
        dateCreated__gte=start_date,
        dateCreated__lte=end_date
    ).exclude(picker='').exclude(picker__isnull=True).exclude(picker='- None -').values('picker').annotate(
        picked_count=Count('id')
    )
    
    # Count orders by packer with timeframe filter - exclude None and empty values
    packers = PackedOrPickedOrder.objects.filter(
        dateCreated__gte=start_date,
        dateCreated__lte=end_date
    ).exclude(packer='').exclude(packer__isnull=True).exclude(packer='- None -').values('packer').annotate(
        packed_count=Count('id')
    )
    
    # Count orders by receiver with timeframe filter - exclude None and empty values
    receivers = TotalOrdersReceived.objects.filter(
        createdDate__gte=start_date.date(),
        createdDate__lte=end_date.date()
    ).exclude(receivedBy='').exclude(receivedBy__isnull=True).exclude(receivedBy='- None -').values('receivedBy').annotate(
        received_count=Count('id')
    )
    
    # Combine all employees
    all_employees = set()
    for picker in pickers:
        if picker['picker'] and picker['picker'].strip():
            all_employees.add(picker['picker'].strip())
    for packer in packers:
        if packer['packer'] and packer['packer'].strip():
            all_employees.add(packer['packer'].strip())
    for receiver in receivers:
        if receiver['receivedBy'] and receiver['receivedBy'].strip():
            all_employees.add(receiver['receivedBy'].strip())
    
    # Define unique colors for each employee
    colors = [
        "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", 
        "#06b6d4", "#84cc16", "#f97316", "#ec4899", "#6366f1",
        "#14b8a6", "#f43f5e", "#a855f7", "#eab308", "#22c55e"
    ]
    
    # Build performance data - only include employees with activity
    bar_data = []
    pie_data = []
    
    for i, employee in enumerate(all_employees):
        picked_count = next((p['picked_count'] for p in pickers if p['picker'].strip() == employee), 0)
        packed_count = next((p['packed_count'] for p in packers if p['packer'].strip() == employee), 0)
        received_count = next((r['received_count'] for r in receivers if r['receivedBy'].strip() == employee), 0)
        
        total_activity = picked_count + packed_count + received_count
        
        # Only include employees with actual activity
        if total_activity > 0:
            bar_data.append({
                "name": employee,
                "picked": picked_count,
                "packed": packed_count,
                "received": received_count
            })
    
    # Calculate pie chart data with unique colors
    total_activities = sum(item['picked'] + item['packed'] + item['received'] for item in bar_data)
    
    for i, item in enumerate(bar_data):
        total_employee_activity = item['picked'] + item['packed'] + item['received']
        if total_employee_activity > 0:
            percentage = round((total_employee_activity / max(total_activities, 1)) * 100)
            pie_data.append({
                "name": item['name'],
                "value": percentage,
                "color": colors[i % len(colors)]  # Use unique color for each employee
            })
    
    return Response({
        "bar_data": bar_data,
        "pie_data": pie_data
    })


@api_view(['GET'])
def warehouse_trend_api(request):
    """API view to fetch warehouse trend data (picked, packed, received over time)."""
    from django.db.models import Count
    from django.utils import timezone
    from datetime import timedelta
    from django.db.models.functions import TruncMonth
    from django.utils.timezone import make_aware
    from datetime import datetime
    
    year = request.GET.get('year', '2025')
    
    # Get start and end dates for the specified year
    start_date = make_aware(datetime(int(year), 1, 1))
    end_date = make_aware(datetime(int(year), 12, 31, 23, 59, 59))
    
    # Monthly picked orders for the specified year
    picked_data = PackedOrPickedOrder.objects.filter(
        dateCreated__gte=start_date,
        dateCreated__lte=end_date,
        picker__isnull=False
    ).exclude(picker='').annotate(
        month=TruncMonth('dateCreated')
    ).values('month').annotate(count=Count('id')).order_by('month')
    
    # Monthly packed orders for the specified year
    packed_data = PackedOrPickedOrder.objects.filter(
        dateCreated__gte=start_date,
        dateCreated__lte=end_date,
        packer__isnull=False
    ).exclude(packer='').annotate(
        month=TruncMonth('dateCreated')
    ).values('month').annotate(count=Count('id')).order_by('month')
    
    # Monthly received orders for the specified year
    received_data = TotalOrdersReceived.objects.filter(
        createdDate__gte=start_date,
        createdDate__lte=end_date
    ).annotate(
        month=TruncMonth('createdDate')
    ).values('month').annotate(count=Count('id')).order_by('month')
    
    # Create trend data for all months in the year
    trend_data = []
    
    for month in range(1, 13):
        month_date = make_aware(datetime(int(year), month, 1))
        month_key = month_date.strftime('%Y-%m')
        month_label = month_date.strftime('%Y-%b')
        
        picked_count = next((item['count'] for item in picked_data if item['month'].strftime('%Y-%m') == month_key), 0)
        packed_count = next((item['count'] for item in packed_data if item['month'].strftime('%Y-%m') == month_key), 0)
        received_count = next((item['count'] for item in received_data if item['month'].strftime('%Y-%m') == month_key), 0)
        
        trend_data.append({
            "month": month_label,
            "picked": picked_count,
            "packed": packed_count,
            "received": received_count
        })
    
    return Response(trend_data)


@api_view(['GET'])
def sales_purchase_api(request):
    """API view to fetch sales and purchase orders with pagination."""
    pagination_class = HTTPSPageNumberPagination
    
    order_type = request.GET.get('type', 'all')
    timeframe = request.GET.get('timeframe', 'today')
    
    # Get date range for current period
    start_date, end_date = get_timeframe_date_range(timeframe)
    
    # Get orders with timeframe filter
    purchase_orders = OpenPurchaseOrder.objects.filter(
        tranDate__gte=start_date.date(),
        tranDate__lte=end_date.date()
    ).order_by('-tranDate')
    
    sales_orders = OpenSalesOrder.objects.filter(
        dateCreated__gte=start_date.date(),
        dateCreated__lte=end_date.date()
    ).order_by('-dateCreated')
    
    orders = []
    
    # Add purchase orders
    for po in purchase_orders:
        orders.append({
            "tranNo": po.tranId,
            "type": "PO",
            "location": po.location,
            "vendor": po.vendor,
            "date": po.tranDate.strftime('%d/%m/%Y') if po.tranDate else ''
        })
    
    # Add sales orders
    for so in sales_orders:
        orders.append({
            "tranNo": so.tranId,
            "type": "SO", 
            "location": so.location,
            "vendor": so.customer,
            "date": so.dateCreated.strftime('%d/%m/%Y') if so.dateCreated else ''
        })
    
    # Sort by date (most recent first)
    orders.sort(key=lambda x: x['date'], reverse=True)
    
    # Apply type filter
    if order_type == 'po':
        orders = [o for o in orders if o['type'] == 'PO']
    elif order_type == 'so':
        orders = [o for o in orders if o['type'] == 'SO']
    
    # Manual pagination for list
    page_size = pagination_class.page_size
    page_number = request.GET.get('page', 1)
    try:
        page_number = int(page_number)
    except (TypeError, ValueError):
        page_number = 1
    
    total_count = len(orders)
    start_index = (page_number - 1) * page_size
    end_index = start_index + page_size
    paginated_orders = orders[start_index:end_index]
    
    # Build pagination URLs manually
    from urllib.parse import urlencode
    
    base_url = request.build_absolute_uri('/api/sales-purchase/')
    query_params = request.GET.copy()
    
    next_url = None
    if end_index < total_count:
        query_params['page'] = str(page_number + 1)
        next_url = f"{base_url}?{query_params.urlencode()}"
    
    previous_url = None
    if page_number > 1:
        query_params['page'] = str(page_number - 1)
        previous_url = f"{base_url}?{query_params.urlencode()}"
    
    response_data = {
        'count': total_count,
        'next': next_url,
        'previous': previous_url,
        'results': paginated_orders
    }
    
    return Response(response_data)


@api_view(['GET'])
def sales_purchase_trends_api(request):
    """
    API to view total sales and total purchase orders per month.

    Query Params:
    - ?type=all|po|so (filter by order type)
    - ?timeframe=today|week|month|year (filter by timeframe)
    """
    order_filter = request.GET.get('type', 'all')
    timeframe = request.GET.get('timeframe', 'today')
    
    # Get date range for current period
    start_date, end_date = get_timeframe_date_range(timeframe)

    sales_data = OpenSalesOrder.objects.all()
    purchase_data = OpenPurchaseOrder.objects.all()

    if order_filter == "so":
        purchase_data = OpenPurchaseOrder.objects.none()
    elif order_filter == "po":
        sales_data = OpenSalesOrder.objects.none()

    # Apply timeframe filter
    sales_data = sales_data.filter(
        dateCreated__gte=start_date.date(),
        dateCreated__lte=end_date.date()
    )
    purchase_data = purchase_data.filter(
        tranDate__gte=start_date.date(),
        tranDate__lte=end_date.date()
    )

    sales_count = defaultdict(int)
    for order in sales_data:
        if order.dateCreated:
            key = order.dateCreated.strftime("%b %Y")
            sales_count[key] += 1

    purchase_count = defaultdict(int)
    for order in purchase_data:
        if order.tranDate:
            key = order.tranDate.strftime("%b %Y")
            purchase_count[key] += 1

    all_months = sorted(set(sales_count.keys()) | set(purchase_count.keys()))

    trends = []
    for month in all_months:
        trends.append({
            "month": month,
            "sales": sales_count.get(month, 0),
            "purchases": purchase_count.get(month, 0),
        })

    serialized = WarehouseTrendSerializer(trends, many=True)
    return Response(serialized.data)


def get_period_date_range(period: str):
    """Return start and end dates for the selected period (today, this week, etc.)"""
    today = timezone.now().date()
    if period == 'today':
        return today, today
    elif period == 'yesterday':
        yesterday = today - timedelta(days=1)
        return yesterday, yesterday
    elif period == 'this week':
        start = today - timedelta(days=today.weekday())  # Monday
        end = start + timedelta(days=6)  # Sunday
        return start, end
    elif period == 'last week':
        # Get Monday of current week, then go back 7 days
        days_since_monday = today.weekday()
        current_monday = today - timedelta(days=days_since_monday)
        last_monday = current_monday - timedelta(days=7)
        last_sunday = last_monday + timedelta(days=6)
        return last_monday, last_sunday
    elif period == 'this month':
        start = today.replace(day=1)
        end = today.replace(day=calendar.monthrange(today.year, today.month)[1])
        return start, end
    elif period == 'last month':
        # First day of previous month
        if today.month == 1:
            start = today.replace(year=today.year - 1, month=12, day=1)
        else:
            start = today.replace(month=today.month - 1, day=1)
        # Last day of previous month
        end = start.replace(day=calendar.monthrange(start.year, start.month)[1])
        return start, end
    elif period == 'this year':
        start = today.replace(month=1, day=1)
        end = today.replace(month=12, day=31)
        return start, end
    elif period == 'last year':
        start = today.replace(year=today.year - 1, month=1, day=1)
        end = today.replace(year=today.year - 1, month=12, day=31)
        return start, end
    else:
        raise ValueError("Invalid period. Use: today, yesterday, this week, last week, this month, last month, this year, last year")


def get_previous_period_range(period: str):
    """Calculate the equivalent previous period (e.g., last week, last year)."""
    # For month-based periods, use the specific "last month" logic
    if period == 'this month':
        return get_period_date_range('last month')
    elif period == 'this week':
        return get_period_date_range('last week')
    elif period == 'this year':
        return get_period_date_range('last year')
    elif period == 'last year':
        # Previous year for "last year" is the year before last year
        # If "last year" is 2024, previous should be 2023
        today = timezone.now().date()
        last_year = today.year - 1  # e.g., 2024 if today is 2025
        previous_year = last_year - 1  # e.g., 2023
        start = today.replace(year=previous_year, month=1, day=1)
        end = today.replace(year=previous_year, month=12, day=31)
        return start, end
    elif period == 'last month':
        # Previous month for "last month" is 2 months ago
        today = timezone.now().date()
        if today.month <= 2:
            start = today.replace(year=today.year - 1, month=12 + (today.month - 1), day=1)
        else:
            start = today.replace(month=today.month - 2, day=1)
        end = start.replace(day=calendar.monthrange(start.year, start.month)[1])
        return start, end
    elif period == 'today':
        return get_period_date_range('yesterday')
    else:
        # For other periods, use the generic delta calculation
        current_start, current_end = get_period_date_range(period)
        delta = current_end - current_start
        previous_end = current_start - timedelta(days=1)
        previous_start = previous_end - delta
        return previous_start, previous_end


def calculate_percentage_change(current: float, previous: float, decimals: int = 2, show_multiplier: bool = True, na_text: str = "new"):
    """Calculate % change between current and previous values."""
    if previous == 0:
        return None, na_text
    change_pct = (current - previous) / previous * 100.0
    if abs(change_pct) < 1e-9:
        return 0.0, "no change"
    if change_pct > 0:
        if show_multiplier and change_pct > 100:
            multiplier = current / previous
            return change_pct, f"increased by {multiplier:.{decimals}f}x"
        return change_pct, f"increased by {change_pct:.{decimals}f}%"
    return change_pct, f"decreased by {abs(change_pct):.{decimals}f}%"


def get_multi_period_ranges(period: str, num_periods: int = 4):
    """
    Get date ranges for multiple periods (for trend analysis).
    Returns list of (start, end) tuples from oldest to newest.
    """
    periods = []
    current_start, current_end = get_period_date_range(period)
    periods.append((current_start, current_end))
    
    for i in range(1, num_periods):
        prev_start, prev_end = get_previous_period_range(period)
        # Calculate the period before that
        delta = prev_end - prev_start
        period_before_end = prev_start - timedelta(days=1)
        period_before_start = period_before_end - delta
        periods.append((period_before_start, period_before_end))
        # Update period for next iteration
        period = 'previous'  # This will be recalculated
    
    # Reverse to get oldest first
    return list(reversed(periods))


def calculate_moving_average(values: list, window: int = 3) -> float:
    """Calculate moving average of values."""
    if not values or len(values) < window:
        return sum(values) / len(values) if values else 0.0
    return sum(values[-window:]) / window


def calculate_standard_deviation(values: list) -> float:
    """Calculate standard deviation of values."""
    if not values or len(values) < 2:
        return 0.0
    mean = sum(values) / len(values)
    variance = sum((x - mean) ** 2 for x in values) / len(values)
    return variance ** 0.5


def is_statistically_significant(current: float, historical: list, threshold_sigma: float = 2.0) -> tuple:
    """
    Check if current value is statistically significant compared to historical data.
    Returns (is_significant, confidence_score, trend_direction)
    """
    if not historical or len(historical) < 2:
        return False, 0.0, 'insufficient_data'
    
    mean = sum(historical) / len(historical)
    std_dev = calculate_standard_deviation(historical)
    
    if std_dev == 0:
        # All values are the same
        if current == mean:
            return False, 0.0, 'stable'
        return True, 1.0, 'increase' if current > mean else 'decrease'
    
    z_score = (current - mean) / std_dev
    is_significant = abs(z_score) >= threshold_sigma
    
    # Confidence score: 0-1, based on how many standard deviations away
    confidence = min(abs(z_score) / 3.0, 1.0)  # Cap at 3 sigma = 100% confidence
    
    direction = 'increase' if z_score > 0 else 'decrease' if z_score < 0 else 'stable'
    
    return is_significant, confidence, direction


def detect_trend_pattern(values: list) -> dict:
    """
    Detect trend patterns in historical data.
    Returns pattern info: type, strength, direction
    """
    if not values or len(values) < 3:
        return {'type': 'insufficient_data', 'strength': 0.0, 'direction': 'unknown'}
    
    # Calculate trend direction
    recent_avg = sum(values[-3:]) / 3
    older_avg = sum(values[:-3]) / (len(values) - 3) if len(values) > 3 else values[0]
    
    change_pct = ((recent_avg - older_avg) / older_avg * 100) if older_avg > 0 else 0
    
    # Determine pattern type
    if abs(change_pct) < 5:
        pattern_type = 'stable'
        strength = 0.3
    elif change_pct > 20:
        pattern_type = 'accelerating_growth'
        strength = min(abs(change_pct) / 50, 1.0)
    elif change_pct > 5:
        pattern_type = 'steady_growth'
        strength = min(abs(change_pct) / 30, 1.0)
    elif change_pct < -20:
        pattern_type = 'rapid_decline'
        strength = min(abs(change_pct) / 50, 1.0)
    elif change_pct < -5:
        pattern_type = 'steady_decline'
        strength = min(abs(change_pct) / 30, 1.0)
    else:
        pattern_type = 'volatile'
        strength = 0.5
    
    direction = 'up' if change_pct > 0 else 'down' if change_pct < 0 else 'flat'
    
    return {
        'type': pattern_type,
        'strength': strength,
        'direction': direction,
        'change_percentage': change_pct
    }


def get_period_thresholds(period: str) -> dict:
    """Get minimum thresholds based on period length."""
    period_lower = period.lower()
    
    if 'today' in period_lower or 'yesterday' in period_lower:
        return {
            'min_quantity': 5,
            'min_change_pct': 30,
            'min_significance_sigma': 2.5
        }
    elif 'week' in period_lower:
        return {
            'min_quantity': 10,
            'min_change_pct': 20,
            'min_significance_sigma': 2.0
        }
    elif 'month' in period_lower:
        return {
            'min_quantity': 20,
            'min_change_pct': 15,
            'min_significance_sigma': 1.5
        }
    else:  # year
        return {
            'min_quantity': 50,
            'min_change_pct': 10,
            'min_significance_sigma': 1.5
        }


def ml_anomaly_detection(values: list, contamination: float = 0.1) -> tuple:
    """
    Advanced anomaly detection using ML (Isolation Forest).
    Only used when statistical methods might miss complex patterns.
    
    Args:
        values: List of numerical values (e.g., quantities over time)
        contamination: Expected proportion of anomalies (0.1 = 10%)
    
    Returns:
        (is_anomaly: bool, anomaly_score: float, confidence: float)
        Returns (False, 0.0, 0.0) if ML not available or insufficient data
    """
    if not ML_AVAILABLE:
        return False, 0.0, 0.0
    
    if not values or len(values) < 5:
        # Need at least 5 data points for ML
        return False, 0.0, 0.0
    
    try:
        # Reshape for sklearn (needs 2D array)
        import numpy as np
        values_array = np.array(values).reshape(-1, 1)
        
        # Use Isolation Forest for anomaly detection
        iso_forest = IsolationForest(contamination=contamination, random_state=42)
        predictions = iso_forest.fit_predict(values_array)
        scores = iso_forest.score_samples(values_array)
        
        # Check if last value (most recent) is an anomaly
        is_anomaly = predictions[-1] == -1
        anomaly_score = float(scores[-1])
        
        # Convert score to confidence (lower score = more anomalous)
        # Normalize to 0-1 scale (more negative = higher confidence it's anomaly)
        min_score = scores.min()
        max_score = scores.max()
        if max_score != min_score:
            normalized_score = (anomaly_score - min_score) / (max_score - min_score)
            confidence = 1.0 - normalized_score if is_anomaly else normalized_score
        else:
            confidence = 0.5
        
        return is_anomaly, anomaly_score, confidence
    except Exception as e:
        logging.warning(f"ML anomaly detection failed: {str(e)}")
        return False, 0.0, 0.0


def should_use_ml_analysis(historical_data: list, min_data_points: int = 10) -> bool:
    """
    Determine if we have enough data to justify ML analysis.
    ML is more expensive, so only use when:
    1. We have sufficient data
    2. Statistical methods might miss patterns
    """
    if not ML_AVAILABLE:
        return False
    
    if not historical_data or len(historical_data) < min_data_points:
        return False
    
    # Check if data has enough variation (ML is useful for complex patterns)
    if len(historical_data) >= 2:
        variance = calculate_standard_deviation(historical_data)
        mean_val = sum(historical_data) / len(historical_data)
        coefficient_of_variation = variance / mean_val if mean_val > 0 else 0
        
        # Use ML if there's significant variation (complex patterns)
        # or if we have a lot of data (ML can find subtle patterns)
        return coefficient_of_variation > 0.2 or len(historical_data) >= 20
    
    return False


@api_view(['GET'])
def insights_api(request):
    """
    API endpoint for WMS Insights Dashboard.
    Calculates KPIs, staff performance, completion rates, and prescriptive recommendations.
    
    ADVANCED FEATURES WITH DATA CONDENSATION:
    - Multi-period trend analysis (4 periods) for items
    - Statistical significance checks using z-scores
    - Moving averages and pattern recognition
    - Period-aware thresholds (stricter for short periods)
    - Confidence scores for recommendations
    - Trend pattern detection (accelerating growth, steady decline, etc.)
    
    Query Params:
    - period: 'today', 'this week', 'this month', 'this year' (default: 'this month')
    """
    try:
        period = request.GET.get('period', 'this month').lower()
        
        # Get date ranges
        current_start, current_end = get_period_date_range(period)
        previous_start, previous_end = get_previous_period_range(period)
        
        # Log date ranges for debugging
        logging.info(f"Insights API - Period: {period}")
        logging.info(f"Current period: {current_start} to {current_end}")
        logging.info(f"Previous period: {previous_start} to {previous_end}")
        
        # Filter data for current period
        current_po = OpenPurchaseOrder.objects.filter(
            tranDate__gte=current_start,
            tranDate__lte=current_end
        )
        current_so = OpenSalesOrder.objects.filter(
            dateCreated__gte=current_start,
            dateCreated__lte=current_end
        )
        current_packed = PackedOrPickedOrder.objects.filter(
            dateCreated__date__gte=current_start,
            dateCreated__date__lte=current_end
        )
        current_received = TotalOrdersReceived.objects.filter(
            createdDate__gte=current_start,
            createdDate__lte=current_end
        )
        
        # Filter data for previous period
        previous_po = OpenPurchaseOrder.objects.filter(
            tranDate__gte=previous_start,
            tranDate__lte=previous_end
        )
        previous_so = OpenSalesOrder.objects.filter(
            dateCreated__gte=previous_start,
            dateCreated__lte=previous_end
        )
        previous_packed = PackedOrPickedOrder.objects.filter(
            dateCreated__date__gte=previous_start,
            dateCreated__date__lte=previous_end
        )
        previous_received = TotalOrdersReceived.objects.filter(
            createdDate__gte=previous_start,
            createdDate__lte=previous_end
        )
        
        # Calculate order metrics
        po_current = current_po.count()
        so_current = current_so.count()
        total_current = po_current + so_current
        
        po_previous = previous_po.count()
        so_previous = previous_so.count()
        total_previous = po_previous + so_previous
        
        _, total_change = calculate_percentage_change(total_current, total_previous, decimals=1)
        _, po_change = calculate_percentage_change(po_current, po_previous, decimals=1)
        _, so_change = calculate_percentage_change(so_current, so_previous, decimals=1)
        
        # Calculate top performer (staff with most actions: pick + pack + receive)
        def compute_staff_activity(packed_qs, received_qs):
            activity = defaultdict(lambda: [0, 0, 0])  # [pick, pack, receive]
            for order in packed_qs:
                if order.picker:
                    activity[order.picker][0] += 1
                if order.packer:
                    activity[order.packer][1] += 1
            for order in received_qs:
                if order.receivedBy:
                    activity[order.receivedBy][2] += 1
            totals = {k: sum(v) for k, v in activity.items()}
            if not totals:
                return '(no activity)', 0, activity
            top = max(totals.items(), key=lambda x: x[1])
            return top[0], top[1], activity
        
        top_name, top_count, curr_act = compute_staff_activity(current_packed, current_received)
        _, prev_count, prev_act = compute_staff_activity(previous_packed, previous_received)
        _, perf_change = calculate_percentage_change(top_count, prev_count, decimals=1)
        
        # Calculate top customer and vendor
        from django.db.models import Count
        cust_counts = current_so.values('customer').annotate(count=Count('id')).order_by('-count')
        top_cust = cust_counts[0]['customer'] if cust_counts else '(none)'
        top_cust_cnt = cust_counts[0]['count'] if cust_counts else 0
        prev_cust_counts = previous_so.values('customer').annotate(count=Count('id')).order_by('-count')
        prev_cust_cnt = prev_cust_counts[0]['count'] if prev_cust_counts else 0
        _, cust_change = calculate_percentage_change(top_cust_cnt, prev_cust_cnt, decimals=1)
        
        vend_counts = current_po.values('vendor').annotate(count=Count('id')).order_by('-count')
        top_vend = vend_counts[0]['vendor'] if vend_counts else '(none)'
        top_vend_cnt = vend_counts[0]['count'] if vend_counts else 0
        prev_vend_counts = previous_po.values('vendor').annotate(count=Count('id')).order_by('-count')
        prev_vend_cnt = prev_vend_counts[0]['count'] if prev_vend_counts else 0
        _, vend_change = calculate_percentage_change(top_vend_cnt, prev_vend_cnt, decimals=1)
        
        # Calculate Total Transaction metrics (Card 1: Fulfilments, PO, SO)
        from django.db.models import Sum, Q
        from django.db.models.functions import Coalesce
        
        # Calculate Total Orders metrics (Card 1: Item Receipts, Item Fulfillments)
        # Item Receipts: Count all TotalOrdersReceived records (no grouping by createdFrom)
        current_purchase_fulfilments = current_received.count()
        previous_purchase_fulfilments = previous_received.count()
        
        # Item Fulfillments: Count all PackedOrPickedOrder records (no grouping by createdFrom)
        current_sales_fulfilments = current_packed.count()
        previous_sales_fulfilments = previous_packed.count()
        
        total_transaction_current = current_purchase_fulfilments + current_sales_fulfilments
        total_transaction_previous = previous_purchase_fulfilments + previous_sales_fulfilments
        _, total_transaction_change = calculate_percentage_change(total_transaction_current, total_transaction_previous, decimals=1)
        _, purchase_fulfilments_change = calculate_percentage_change(current_purchase_fulfilments, previous_purchase_fulfilments, decimals=1)
        _, sales_fulfilments_change = calculate_percentage_change(current_sales_fulfilments, previous_sales_fulfilments, decimals=1)
        
        # Convert date to datetime for datetime field filtering (for Inventory Operations)
        current_start_dt = timezone.make_aware(datetime.combine(current_start, time.min))
        current_end_dt = timezone.make_aware(datetime.combine(current_end, time.max))
        previous_start_dt = timezone.make_aware(datetime.combine(previous_start, time.min))
        previous_end_dt = timezone.make_aware(datetime.combine(previous_end, time.max))
        
        # Calculate Inventory Operations (Card 3: Bin Transfer, Inventory Adjustments, Inventory Counts)
        # Bin Transfer: Count transactions with type == "Bin Trnfr" (as per notebook)
        current_bin_transfers = TransactionsCreatedByWMS.objects.filter(
            dateCreated__gte=current_start_dt,
            dateCreated__lte=current_end_dt,
            type='Bin Trnfr'
        ).count()
        
        previous_bin_transfers = TransactionsCreatedByWMS.objects.filter(
            dateCreated__gte=previous_start_dt,
            dateCreated__lte=previous_end_dt,
            type='Bin Trnfr'
        ).count()
        
        # Inventory Adjustments: Count transactions with type == "InvAdjst" (as per notebook)
        current_inv_adjustments = TransactionsCreatedByWMS.objects.filter(
            dateCreated__gte=current_start_dt,
            dateCreated__lte=current_end_dt,
            type='InvAdjst'
        ).count()
        
        previous_inv_adjustments = TransactionsCreatedByWMS.objects.filter(
            dateCreated__gte=previous_start_dt,
            dateCreated__lte=previous_end_dt,
            type='InvAdjst'
        ).count()
        
        # Inventory Counts: Count transactions with type == "InvCount" (as per notebook)
        current_inv_counts = TransactionsCreatedByWMS.objects.filter(
            dateCreated__gte=current_start_dt,
            dateCreated__lte=current_end_dt,
            type='InvCount'
        ).count()
        
        previous_inv_counts = TransactionsCreatedByWMS.objects.filter(
            dateCreated__gte=previous_start_dt,
            dateCreated__lte=previous_end_dt,
            type='InvCount'
        ).count()
        
        _, bin_transfer_change = calculate_percentage_change(current_bin_transfers, previous_bin_transfers, decimals=1)
        _, inv_adjustments_change = calculate_percentage_change(current_inv_adjustments, previous_inv_adjustments, decimals=1)
        _, inv_counts_change = calculate_percentage_change(current_inv_counts, previous_inv_counts, decimals=1)
        
        # Calculate Top Moving Items (Card 4: Top Selling Item, Top Receiving Item)
        # Top Selling Item: Aggregate by item from ItemsFromFulfillments, sum quantities
        from django.db.models import Sum as DjangoSum
        from decimal import Decimal
        
        def safe_int(value):
            """Safely convert value to integer, rounding decimal values."""
            if value is None or value == '':
                return 0
            try:
                return int(round(float(value)))
            except (ValueError, TypeError):
                return 0
        
        # ========== ADVANCED: Multi-Period Analysis for Items ==========
        # Get thresholds based on period
        thresholds = get_period_thresholds(period)
        
        # Collect multi-period data for trend analysis (4 periods)
        def get_item_quantities_for_period(start_dt, end_dt, is_selling=True):
            """Get item quantities for a specific period."""
            totals = {}
            model = ItemsFromFulfillments if is_selling else ItemsFromReceipts
            
            # Get all records for the period
            records = model.objects.filter(
                dateCreated__gte=start_dt,
                dateCreated__lte=end_dt
            ).exclude(item__isnull=True).exclude(item='')
            
            # Aggregate quantities by item
            for record in records:
                item_name = record.item
                if item_name not in totals:
                    totals[item_name] = 0
                totals[item_name] += safe_int(record.quantity)
            
            return totals
        
        # Get historical periods for trend analysis
        period_ranges = []
        temp_period = period
        for i in range(4):  # Get 4 periods of data
            if i == 0:
                period_ranges.append((current_start_dt, current_end_dt))
            else:
                # Calculate previous period based on original period
                if temp_period == 'today':
                    days_back = i
                    prev_date = current_start - timedelta(days=days_back)
                    prev_s_dt = timezone.make_aware(datetime.combine(prev_date, time.min))
                    prev_e_dt = timezone.make_aware(datetime.combine(prev_date, time.max))
                elif temp_period == 'this week':
                    days_back = i * 7
                    prev_start = current_start - timedelta(days=days_back + current_start.weekday())
                    prev_end = prev_start + timedelta(days=6)
                    prev_s_dt = timezone.make_aware(datetime.combine(prev_start, time.min))
                    prev_e_dt = timezone.make_aware(datetime.combine(prev_end, time.max))
                elif temp_period == 'this month':
                    # Go back i months
                    if current_start.month - i <= 0:
                        year = current_start.year - 1
                        month = 12 + (current_start.month - i)
                    else:
                        year = current_start.year
                        month = current_start.month - i
                    prev_start = date(year, month, 1)
                    prev_end = date(year, month, calendar.monthrange(year, month)[1])
                    prev_s_dt = timezone.make_aware(datetime.combine(prev_start, time.min))
                    prev_e_dt = timezone.make_aware(datetime.combine(prev_end, time.max))
                else:  # Use get_previous_period_range for other periods
                    prev_s, prev_e = get_previous_period_range(temp_period)
                    prev_s_dt = timezone.make_aware(datetime.combine(prev_s, time.min))
                    prev_e_dt = timezone.make_aware(datetime.combine(prev_e, time.max))
                period_ranges.append((prev_s_dt, prev_e_dt))
        
        # Collect multi-period selling data
        selling_history = []
        for start_dt, end_dt in reversed(period_ranges):  # Oldest first
            selling_history.append(get_item_quantities_for_period(start_dt, end_dt, is_selling=True))
        
        # Collect multi-period receiving data
        receiving_history = []
        for start_dt, end_dt in reversed(period_ranges):  # Oldest first
            receiving_history.append(get_item_quantities_for_period(start_dt, end_dt, is_selling=False))
        
        # Top Selling Item: Current period
        selling_totals = selling_history[-1] if selling_history else {}
        top_selling_item = ''
        top_selling_quantity = 0
        if selling_totals:
            top_selling_item = max(selling_totals.items(), key=lambda x: x[1])[0]
            top_selling_quantity = int(max(selling_totals.values()))
        
        # Top Selling Item: Previous period
        prev_selling_totals = selling_history[-2] if len(selling_history) >= 2 else {}
        prev_top_selling_item = ''
        prev_top_selling_quantity = 0
        if prev_selling_totals:
            prev_top_selling_item = max(prev_selling_totals.items(), key=lambda x: x[1])[0]
            prev_top_selling_quantity = int(max(prev_selling_totals.values()))
        
        # Advanced analysis for top selling item
        top_selling_historical = []
        top_selling_trend = None
        top_selling_significance = (False, 0.0, 'stable')
        top_selling_ml_anomaly = (False, 0.0, 0.0)  # Initialize ML results
        if top_selling_item:
            # Get historical quantities for top selling item
            for period_data in selling_history:
                top_selling_historical.append(float(period_data.get(top_selling_item, 0)))
            
            # Detect trend pattern
            if len(top_selling_historical) >= 3:
                top_selling_trend = detect_trend_pattern(top_selling_historical)
                # Check statistical significance
                historical_values = top_selling_historical[:-1]  # Exclude current
                current_value = top_selling_historical[-1]
                top_selling_significance = is_statistically_significant(
                    current_value, 
                    historical_values, 
                    threshold_sigma=thresholds['min_significance_sigma']
                )
                
                # Optional: ML-based anomaly detection (complements statistical analysis)
                # Only use if we have enough data and ML is available
                if should_use_ml_analysis(top_selling_historical, min_data_points=5):
                    is_anomaly, anomaly_score, ml_confidence = ml_anomaly_detection(top_selling_historical)
                    top_selling_ml_anomaly = (is_anomaly, anomaly_score, ml_confidence)
                    # If ML detects anomaly but stats don't, it might be a complex pattern worth flagging
                    if is_anomaly and not top_selling_significance[0]:
                        logging.info(f"ML detected anomaly for {top_selling_item} that statistical methods missed")
        
        # Top Receiving Item: Current period
        receiving_totals = receiving_history[-1] if receiving_history else {}
        top_receiving_item = ''
        top_receiving_quantity = 0
        if receiving_totals:
            top_receiving_item = max(receiving_totals.items(), key=lambda x: x[1])[0]
            top_receiving_quantity = int(max(receiving_totals.values()))
        
        # Top Receiving Item: Previous period
        prev_receiving_totals = receiving_history[-2] if len(receiving_history) >= 2 else {}
        prev_top_receiving_item = ''
        prev_top_receiving_quantity = 0
        if prev_receiving_totals:
            prev_top_receiving_item = max(prev_receiving_totals.items(), key=lambda x: x[1])[0]
            prev_top_receiving_quantity = int(max(prev_receiving_totals.values()))
        
        # Advanced analysis for top receiving item
        top_receiving_historical = []
        top_receiving_trend = None
        top_receiving_significance = (False, 0.0, 'stable')
        top_receiving_ml_anomaly = (False, 0.0, 0.0)  # Initialize ML results
        if top_receiving_item:
            # Get historical quantities for top receiving item
            for period_data in receiving_history:
                top_receiving_historical.append(float(period_data.get(top_receiving_item, 0)))
            
            # Detect trend pattern
            if len(top_receiving_historical) >= 3:
                top_receiving_trend = detect_trend_pattern(top_receiving_historical)
                # Check statistical significance
                historical_values = top_receiving_historical[:-1]  # Exclude current
                current_value = top_receiving_historical[-1]
                top_receiving_significance = is_statistically_significant(
                    current_value, 
                    historical_values, 
                    threshold_sigma=thresholds['min_significance_sigma']
                )
                
                # Optional: ML-based anomaly detection (complements statistical analysis)
                if should_use_ml_analysis(top_receiving_historical, min_data_points=5):
                    is_anomaly, anomaly_score, ml_confidence = ml_anomaly_detection(top_receiving_historical)
                    top_receiving_ml_anomaly = (is_anomaly, anomaly_score, ml_confidence)
                    if is_anomaly and not top_receiving_significance[0]:
                        logging.info(f"ML detected anomaly for {top_receiving_item} that statistical methods missed")
        
        # Calculate completion rates
        # SO Completion: % with shipDate filled
        so_total = current_so.count()
        so_completed = current_so.exclude(shipDate__isnull=True).count()
        so_rate = (so_completed / so_total * 100) if so_total > 0 else 0
        
        prev_so_total = previous_so.count()
        prev_so_completed = previous_so.exclude(shipDate__isnull=True).count()
        prev_so_rate = (prev_so_completed / prev_so_total * 100) if prev_so_total > 0 else 0
        
        # Calculate change in completion rate percentage (not just count)
        _, so_comp_change = calculate_percentage_change(so_rate, prev_so_rate, decimals=1)
        
        # PO Completion: Match PO tranId with received orders
        # Strategy: For each received order, extract the PO ID it references,
        # then check if that PO was created in the current period
        import re
        po_tran_ids = set(current_po.values_list('tranId', flat=True))
        received_po_ids = set()
        
        # Get a map of all PO tranIds to their creation dates for quick lookup
        all_pos_with_dates = {
            po.tranId: po.tranDate 
            for po in OpenPurchaseOrder.objects.all()
        }
        
        # Strategy 0: Direct tranId match (received order tranId matches PO tranId)
        received_tran_ids = set(current_received.values_list('tranId', flat=True))
        matched_direct = po_tran_ids & received_tran_ids
        received_po_ids.update(matched_direct)
        unmatched_po_ids = po_tran_ids - matched_direct
        
        # Extract PO IDs from received orders' createdFrom field
        patterns = [
            r'Purchase\s+Order\s+#?\s*(\S+)',  # "Purchase Order #P23402"
            r'PO\s*#?\s*(\S+)',  # "PO #P23402"
            r'#\s*(\S+)',  # "#P23402"
            r'(\w+\d+)',  # Alphanumeric like "P23402"
        ]
        
        for recv in current_received:
            if not recv.createdFrom:
                continue
                
            created_from_str = str(recv.createdFrom).strip()
            extracted_po_id = None
            
            # Strategy 1: Direct string match (check if any PO ID from current period is in createdFrom)
            for po_id in list(unmatched_po_ids):
                if po_id == created_from_str or po_id in created_from_str:
                    received_po_ids.add(po_id)
                    unmatched_po_ids.discard(po_id)
                    extracted_po_id = po_id
                    break
            
            if extracted_po_id or not unmatched_po_ids:
                continue
            
            # Strategy 2: Extract PO ID from createdFrom using regex patterns
            for pattern in patterns:
                match = re.search(pattern, created_from_str, re.IGNORECASE)
                if match:
                    extracted_id = match.group(1).strip()
                    
                    # Check if extracted PO ID exists in database and was created in current period
                    if extracted_id in po_tran_ids:
                        # PO exists and was created in current period - count it!
                        received_po_ids.add(extracted_id)
                        unmatched_po_ids.discard(extracted_id)
                        break
                    elif extracted_id in all_pos_with_dates:
                        # PO exists but was created outside current period
                        po_date = all_pos_with_dates[extracted_id]
                        if po_date < current_start:
                            logging.debug(f"Received order references PO {extracted_id} created on {po_date} (before current period {current_start})")
                        elif po_date > current_end:
                            logging.debug(f"Received order references PO {extracted_id} created on {po_date} (after current period {current_end})")
                    else:
                        # PO doesn't exist in database
                        logging.debug(f"Received order references PO {extracted_id} which doesn't exist in database")
                    break
        
        po_completed = len(po_tran_ids & received_po_ids)
        po_total = len(po_tran_ids)
        po_rate = (po_completed / po_total * 100) if po_total > 0 else 0
        
        # Previous period calculation (same logic as current period)
        prev_po_tran_ids = set(previous_po.values_list('tranId', flat=True))
        prev_received_po_ids = set()
        
        # Get PO map for previous period lookup
        prev_all_pos_with_dates = {
            po.tranId: po.tranDate 
            for po in OpenPurchaseOrder.objects.all()
        }
        
        # Strategy 0: Direct tranId match
        prev_received_tran_ids = set(previous_received.values_list('tranId', flat=True))
        prev_matched_direct = prev_po_tran_ids & prev_received_tran_ids
        prev_received_po_ids.update(prev_matched_direct)
        prev_unmatched_po_ids = prev_po_tran_ids - prev_matched_direct
        
        # Extract PO IDs from received orders' createdFrom field (same patterns as current period)
        patterns = [
            r'Purchase\s+Order\s+#?\s*(\S+)',
            r'PO\s*#?\s*(\S+)',
            r'#\s*(\S+)',
            r'(\w+\d+)',
        ]
        
        for recv in previous_received:
            if not recv.createdFrom:
                continue
                
            created_from_str = str(recv.createdFrom).strip()
            extracted_po_id = None
            
            # Strategy 1: Direct string match
            for po_id in list(prev_unmatched_po_ids):
                if po_id == created_from_str or po_id in created_from_str:
                    prev_received_po_ids.add(po_id)
                    prev_unmatched_po_ids.discard(po_id)
                    extracted_po_id = po_id
                    break
            
            if extracted_po_id or not prev_unmatched_po_ids:
                continue
            
            # Strategy 2: Extract PO ID using regex
            for pattern in patterns:
                match = re.search(pattern, created_from_str, re.IGNORECASE)
                if match:
                    extracted_id = match.group(1).strip()
                    
                    # Check if extracted PO ID was created in previous period
                    if extracted_id in prev_po_tran_ids:
                        # PO exists and was created in previous period - count it!
                        prev_received_po_ids.add(extracted_id)
                        prev_unmatched_po_ids.discard(extracted_id)
                        break
                    elif extracted_id in prev_all_pos_with_dates:
                        # PO exists but was created outside previous period
                        po_date = prev_all_pos_with_dates[extracted_id]
                        logging.info(f"Previous period: Received order references PO {extracted_id} created on {po_date} (not in period {previous_start} to {previous_end})")
                    else:
                        # PO doesn't exist in database
                        logging.info(f"Previous period: Received order references PO {extracted_id} which doesn't exist in database")
                    break
        
        prev_po_completed = len(prev_po_tran_ids & prev_received_po_ids)
        prev_po_total = len(prev_po_tran_ids)
        prev_po_rate = (prev_po_completed / prev_po_total * 100) if prev_po_total > 0 else 0
        
        # Calculate change in completion rate percentage (not just count)
        _, po_comp_change = calculate_percentage_change(po_rate, prev_po_rate, decimals=1)
        
        # Log for debugging
        logging.info(f"PO Completion: {po_completed}/{po_total} = {po_rate:.1f}% (Current period)")
        logging.info(f"  - Direct tranId matches: {len(matched_direct)}")
        logging.info(f"  - CreatedFrom matches: {len(received_po_ids) - len(matched_direct)}")
        logging.info(f"  - Unmatched POs: {len(unmatched_po_ids)}")
        logging.info(f"PO Completion Previous: {prev_po_completed}/{prev_po_total} = {prev_po_rate:.1f}%")
        logging.info(f"  - Previous period direct tranId matches: {len(prev_matched_direct)}")
        logging.info(f"  - Previous period createdFrom matches: {len(prev_received_po_ids) - len(prev_matched_direct)}")
        logging.info(f"  - Previous period unmatched POs: {len(prev_unmatched_po_ids)}")
        logging.info(f"  - Previous period received orders count: {previous_received.count()}")
        
        # Debug: Show sample data for previous period if no matches
        if len(prev_po_tran_ids) > 0 and len(prev_received_po_ids) == 0:
            sample_po_ids = list(prev_po_tran_ids)[:3]
            logging.info(f"Sample previous PO IDs (first 3): {sample_po_ids}")
            # Check received orders in previous period
            prev_received_count = previous_received.count()
            logging.info(f"Previous period received orders: {prev_received_count}")
            if prev_received_count > 0:
                prev_received_sample = list(previous_received[:5])
                for recv in prev_received_sample:
                    logging.info(f"  Received - tranId: '{recv.tranId}', createdFrom: '{recv.createdFrom}', receivedDate: {recv.createdDate}")
                    # Try to extract PO ID from createdFrom
                    created_from_str = str(recv.createdFrom) if recv.createdFrom else ""
                    for pattern in patterns:
                        match = re.search(pattern, created_from_str, re.IGNORECASE)
                        if match:
                            extracted_id = match.group(1).strip()
                            logging.info(f"    -> Extracted PO ID: {extracted_id}")
                            # Check if this PO was created in previous period
                            if extracted_id in prev_po_tran_ids:
                                logging.info(f"      -> MATCH! PO {extracted_id} was created in previous period")
                            elif extracted_id in prev_all_pos_with_dates:
                                po_date = prev_all_pos_with_dates[extracted_id]
                                logging.info(f"      -> PO {extracted_id} exists but was created on {po_date} (outside period {previous_start} to {previous_end})")
                            else:
                                logging.info(f"      -> PO {extracted_id} does not exist in database")
                            break
            else:
                logging.info("  No received orders in previous period - this explains 0% completion rate")
        
        # Build staff performance table
        def format_change(current, previous):
            """
            Returns a change indicator matching notebook logic:
              - "new" / "—" for zero previous
              - "no change" when equal
              - "2.5x" for large increases (>= 100%)
              - "0.5x ↓" for large decreases (<= -50%)
              - percentage or "x ↓" for decreases
            """
            if previous == 0:
                return "new" if current > 0 else "—"
            if current == previous:
                return "no change"
            ratio = current / previous
            pct_change = (current - previous) / previous * 100
            if pct_change >= 100:
                # Format as "2x" or "2.5x"
                return f"{ratio:.1f}x".replace(".0x", "x")
            if pct_change <= -50:
                # Format as "0.5x ↓"
                return f"{ratio:.1f}x ↓".replace(".0x", "x")
            sign = "+" if pct_change > 0 else ""
            return f"{sign}{pct_change:.0f}%"
        
        staff_table = []
        for name, (pick, pack, recv) in curr_act.items():
            total = pick + pack + recv
            p_pick, p_pack, p_recv = prev_act.get(name, (0, 0, 0))
            p_total = p_pick + p_pack + p_recv
            
            # Calculate percentage changes
            def calc_pct_change(current, previous):
                if previous == 0:
                    return None  # No previous data
                return ((current - previous) / previous) * 100
            
            pick_pct = calc_pct_change(pick, p_pick)
            pack_pct = calc_pct_change(pack, p_pack)
            recv_pct = calc_pct_change(recv, p_recv)
            total_pct = calc_pct_change(total, p_total)
            
            staff_table.append({
                'name': name,
                'pickerCount': pick,
                'pickerPrevious': p_pick,
                'pickerChange': format_change(pick, p_pick),
                'pickerPercentage': pick_pct,
                'packerCount': pack,
                'packerPrevious': p_pack,
                'packerChange': format_change(pack, p_pack),
                'packerPercentage': pack_pct,
                'receivedCount': recv,
                'receivedPrevious': p_recv,
                'receivedChange': format_change(recv, p_recv),
                'receivedPercentage': recv_pct,
                'totalCount': total,
                'totalPrevious': p_total,
                'totalChange': format_change(total, p_total),
                'totalPercentage': total_pct
            })
        
        # Sort by total actions descending
        staff_table.sort(key=lambda x: x['totalCount'], reverse=True)
        
        # Generate prescriptive recommendations - Focus on 3 areas:
        # 1. Staff Involvement, 2. Top Selling Item, 3. Top Receiving Item
        recommendations = []
        
        # ========== 1. STAFF INVOLVEMENT RECOMMENDATIONS ==========
        if staff_table:
            # Check for workload imbalance
            if len(staff_table) > 1:
                top_staff_total = staff_table[0]['totalCount']
                avg_others = sum(s['totalCount'] for s in staff_table[1:]) / (len(staff_table) - 1)
                if top_staff_total > avg_others * 2.5:
                    recommendations.append({
                        'type': 'warning',
                        'priority': 'high',
                        'title': 'Staff Workload Imbalance',
                        'message': f'{staff_table[0]["name"]} is handling {top_staff_total} actions while others average {avg_others:.0f}. Redistribute workload for better efficiency and prevent burnout.',
                        'impact': 'Expected improvement: 20-30% better team efficiency and reduced risk of errors'
                    })
            
            # Check for declining staff performance
            for staff in staff_table:
                if staff['totalPercentage'] is not None and staff['totalPercentage'] < -30:
                    recommendations.append({
                        'type': 'warning',
                        'priority': 'medium',
                        'title': f'Performance Decline: {staff["name"]}',
                        'message': f'{staff["name"]} shows {abs(staff["totalPercentage"]):.0f}% decrease in total actions. Review training needs, workload, or potential issues.',
                        'impact': 'Addressing performance issues can improve overall warehouse productivity by 15-25%'
                    })
                    break  # Only show one at a time
            
            # Check for underutilized staff
            if len(staff_table) > 2:
                low_performers = [s for s in staff_table if s['totalCount'] < 5 and s['totalPrevious'] < 5]
                if low_performers:
                    recommendations.append({
                        'type': 'info',
                        'priority': 'medium',
                        'title': 'Underutilized Staff Members',
                        'message': f'{len(low_performers)} staff member(s) have very low activity. Consider cross-training or reassigning tasks to optimize team utilization.',
                        'impact': 'Better staff utilization can improve overall throughput by 10-15%'
                    })
        
        # ========== 2. TOP SELLING ITEM RECOMMENDATIONS (ENHANCED) ==========
        if top_selling_item and top_selling_quantity >= thresholds['min_quantity']:
            # Check if recommendation is statistically significant
            is_significant, confidence, direction = top_selling_significance
            ml_is_anomaly, ml_score, ml_confidence = top_selling_ml_anomaly
            
            if top_selling_item == prev_top_selling_item and prev_top_selling_item:
                # Same item was top seller - check trend
                change_pct = ((top_selling_quantity - prev_top_selling_quantity) / prev_top_selling_quantity * 100) if prev_top_selling_quantity > 0 else 0
                
                if top_selling_quantity >= prev_top_selling_quantity * 0.8:  # Still high (within 20%)
                    # Check if trend shows sustained growth
                    if top_selling_trend and top_selling_trend['type'] in ['accelerating_growth', 'steady_growth']:
                        recommendations.append({
                            'type': 'success',
                            'priority': 'high',
                            'title': 'Sustained High-Demand Item with Growth Trend',
                            'message': f'"{top_selling_item}" maintains top position ({top_selling_quantity:,.0f} units) with {top_selling_trend["change_percentage"]:.0f}% growth trend over {len(top_selling_historical)} periods. Increase stock allocation proactively.',
                            'impact': 'Proactive stock management for trending items prevents stockouts and can increase sales by 20-30%',
                            'confidence': round(confidence * 100) if confidence > 0 else 85,
                            'trend': top_selling_trend['type']
                        })
                    else:
                        recommendations.append({
                            'type': 'success',
                            'priority': 'high',
                            'title': 'Maintain Stock for Top Selling Item',
                            'message': f'"{top_selling_item}" was the top selling item last period ({prev_top_selling_quantity:,.0f} units) and continues to be this period ({top_selling_quantity:,.0f} units). Ensure adequate stock levels to meet demand.',
                            'impact': 'Maintaining optimal stock prevents stockouts and maintains customer satisfaction, potentially increasing sales by 10-15%',
                            'confidence': 75
                        })
                elif top_selling_quantity < prev_top_selling_quantity * 0.5 and is_significant:  # Significant drop
                    # Add ML insights if ML detected anomaly that stats confirmed
                    ml_note = ""
                    if ml_is_anomaly and ml_confidence > 0.7:
                        ml_note = f" ML analysis also detected this as an anomaly (confidence: {round(ml_confidence * 100)}%)."
                    
                    recommendations.append({
                        'type': 'warning',
                        'priority': 'high',
                        'title': 'Top Selling Item Demand Decline (Statistically Significant)',
                        'message': f'"{top_selling_item}" dropped significantly from {prev_top_selling_quantity:,.0f} to {top_selling_quantity:,.0f} units ({abs(change_pct):.0f}% decrease). This is a statistically significant change.{ml_note} Review market trends and adjust inventory accordingly.',
                        'impact': 'Optimizing inventory for changing demand can reduce carrying costs by 15-20%',
                        'confidence': round(confidence * 100),
                        'trend': top_selling_trend['type'] if top_selling_trend else 'decline',
                        'ml_enhanced': ml_is_anomaly
                    })
                elif ml_is_anomaly and not is_significant and ml_confidence > 0.7:
                    # ML detected something stats missed - worth flagging
                    recommendations.append({
                        'type': 'info',
                        'priority': 'medium',
                        'title': 'Potential Pattern Change Detected (ML Analysis)',
                        'message': f'"{top_selling_item}" shows unusual patterns that statistical methods didn\'t flag. ML analysis suggests a potential shift (confidence: {round(ml_confidence * 100)}%). Monitor closely for emerging trends.',
                        'impact': 'Early detection of pattern changes can help optimize inventory management by 10-15%',
                        'confidence': round(ml_confidence * 100),
                        'trend': 'ml_detected',
                        'ml_enhanced': True
                    })
            elif prev_top_selling_item and prev_top_selling_quantity > 0:
                # Different item is now top seller
                if is_significant or top_selling_quantity >= prev_top_selling_quantity * 1.2:  # At least 20% higher
                    recommendations.append({
                        'type': 'info',
                        'priority': 'high',
                        'title': 'New Top Selling Item Identified',
                        'message': f'"{top_selling_item}" is now the top seller ({top_selling_quantity:,.0f} units), replacing "{prev_top_selling_item}" ({prev_top_selling_quantity:,.0f} units). Increase stock allocation for this item.',
                        'impact': 'Proactive stock management for trending items can prevent stockouts and capture 15-25% more sales',
                        'confidence': round(confidence * 100) if confidence > 0 else 70,
                        'trend': top_selling_trend['type'] if top_selling_trend else 'emerging'
                    })
            elif not prev_top_selling_item:
                # New item emerged as top seller - check if it's significant
                if is_significant or top_selling_quantity >= thresholds['min_quantity'] * 2:
                    recommendations.append({
                        'type': 'success',
                        'priority': 'high',
                        'title': 'New High-Demand Item',
                        'message': f'"{top_selling_item}" is the top selling item this period ({top_selling_quantity:,.0f} units). Ensure sufficient stock is maintained to meet ongoing demand.',
                        'impact': 'Maintaining adequate stock for high-demand items prevents lost sales and improves customer satisfaction by 20-30%',
                        'confidence': round(confidence * 100) if confidence > 0 else 80,
                        'trend': 'emerging'
                    })
        
        # ========== 3. TOP RECEIVING ITEM RECOMMENDATIONS (ENHANCED) ==========
        if top_receiving_item and top_receiving_quantity >= thresholds['min_quantity']:
            # Check if recommendation is statistically significant
            is_significant, confidence, direction = top_receiving_significance
            
            if top_receiving_item == prev_top_receiving_item and prev_top_receiving_item:
                # Same item was top received - check trend
                change_pct = ((top_receiving_quantity - prev_top_receiving_quantity) / prev_top_receiving_quantity * 100) if prev_top_receiving_quantity > 0 else 0
                
                if top_receiving_quantity >= prev_top_receiving_quantity * 0.8:  # Still high
                    if top_receiving_trend and top_receiving_trend['type'] in ['accelerating_growth', 'steady_growth']:
                        recommendations.append({
                            'type': 'info',
                            'priority': 'high',
                            'title': 'Sustained High Receiving Volume with Growth Trend',
                            'message': f'"{top_receiving_item}" maintains top receiving position ({top_receiving_quantity:,.0f} units) with {top_receiving_trend["change_percentage"]:.0f}% growth trend. Plan for increased storage and receiving capacity.',
                            'impact': 'Proactive capacity planning prevents bottlenecks and maintains receiving efficiency by 20-25%',
                            'confidence': round(confidence * 100) if confidence > 0 else 85,
                            'trend': top_receiving_trend['type']
                        })
                    else:
                        recommendations.append({
                            'type': 'info',
                            'priority': 'medium',
                            'title': 'Consistent High Receiving Volume',
                            'message': f'"{top_receiving_item}" continues to be the top received item ({top_receiving_quantity:,.0f} units this period vs {prev_top_receiving_quantity:,.0f} last period). Verify storage capacity and receiving processes are optimized.',
                            'impact': 'Optimized receiving processes can reduce handling time by 15-20% and improve inventory accuracy',
                            'confidence': 75
                        })
                elif top_receiving_quantity > prev_top_receiving_quantity * 1.5 and is_significant:  # Significant increase
                    recommendations.append({
                        'type': 'warning',
                        'priority': 'high',
                        'title': 'Rapid Increase in Receiving Volume (Statistically Significant)',
                        'message': f'"{top_receiving_item}" receiving increased by {change_pct:.0f}% ({top_receiving_quantity:,.0f} vs {prev_top_receiving_quantity:,.0f} units). This is a statistically significant spike. Ensure receiving staff and storage space can handle the increased volume.',
                        'impact': 'Proper capacity planning prevents bottlenecks and maintains receiving efficiency by 20-25%',
                        'confidence': round(confidence * 100),
                        'trend': top_receiving_trend['type'] if top_receiving_trend else 'rapid_growth'
                    })
            elif prev_top_receiving_item:
                # Different item is now top received
                if is_significant or top_receiving_quantity >= prev_top_receiving_quantity * 1.2:
                    recommendations.append({
                        'type': 'info',
                        'priority': 'medium',
                        'title': 'Receiving Pattern Change',
                        'message': f'Receiving focus shifted to "{top_receiving_item}" ({top_receiving_quantity:,.0f} units) from "{prev_top_receiving_item}" ({prev_top_receiving_quantity:,.0f} units). Adjust receiving schedules and storage allocation accordingly.',
                        'impact': 'Adapting to receiving patterns improves warehouse efficiency by 10-15%',
                        'confidence': round(confidence * 100) if confidence > 0 else 70,
                        'trend': top_receiving_trend['type'] if top_receiving_trend else 'shift'
                    })
            elif not prev_top_receiving_item:
                # New item emerged as top received
                if is_significant or top_receiving_quantity >= thresholds['min_quantity'] * 2:
                    recommendations.append({
                        'type': 'info',
                        'priority': 'medium',
                        'title': 'New High-Volume Receiving Item',
                        'message': f'"{top_receiving_item}" is the top received item this period ({top_receiving_quantity:,.0f} units). Review receiving processes and storage allocation to ensure smooth operations.',
                        'impact': 'Optimized receiving for high-volume items can improve processing speed by 15-20%',
                        'confidence': round(confidence * 100) if confidence > 0 else 75,
                        'trend': 'emerging'
                    })
        
        # Generate user-friendly comparison label based on period
        if period == 'today':
            comparison_label = 'Yesterday'
        elif period == 'yesterday':
            # Compare with day before yesterday - show the date
            comparison_label = previous_start.strftime('%B %d, %Y')
        elif period == 'this week':
            comparison_label = 'Last Week'
        elif period == 'last week':
            # Compare with week before last week - show the date range
            comparison_label = f"{previous_start.strftime('%b %d')} - {previous_end.strftime('%b %d, %Y')}"
        elif period == 'this month':
            comparison_label = 'Last Month'
        elif period == 'last month':
            # Compare with month before last month - show the month
            comparison_label = previous_start.strftime('%B %Y')
        elif period == 'this year':
            comparison_label = 'Last Year'
        elif period == 'last year':
            # Compare with year before last year - show the year
            comparison_label = str(previous_start.year)
        else:
            comparison_label = previous_start.strftime('%B %Y')
        
        return Response({
            'period': period,
            'dateRange': {
                'current': {
                    'start': current_start.isoformat(),
                    'end': current_end.isoformat()
                },
                'previous': {
                    'start': previous_start.isoformat(),
                    'end': previous_end.isoformat()
                }
            },
            'totalTransaction': {
                'total': {
                    'count': total_transaction_current,
                    'change': total_transaction_change
                },
                'purchaseFulfilments': {
                    'count': current_purchase_fulfilments,
                    'change': purchase_fulfilments_change
                },
                'salesFulfilments': {
                    'count': current_sales_fulfilments,
                    'change': sales_fulfilments_change
                }
            },
            'orderMetrics': {
                'total': {
                    'count': total_current,
                    'change': total_change
                },
                'purchaseOrders': {
                    'count': po_current,
                    'change': po_change
                },
                'salesOrders': {
                    'count': so_current,
                    'change': so_change
                }
            },
            'topPerformer': {
                'name': top_name,
                'count': top_count,
                'change': perf_change
            },
            'inventoryOperations': {
                'binTransfer': {
                    'count': current_bin_transfers,
                    'change': bin_transfer_change
                },
                'inventoryAdjustments': {
                    'count': current_inv_adjustments,
                    'change': inv_adjustments_change
                },
                'inventoryCounts': {
                    'count': current_inv_counts,
                    'change': inv_counts_change
                }
            },
            'topMovingItems': {
                'topSellingItem': {
                    'name': top_selling_item,
                    'quantity': int(top_selling_quantity)
                },
                'topReceivingItem': {
                    'name': top_receiving_item,
                    'quantity': int(top_receiving_quantity)
                }
            },
            'topCustomer': {
                'name': top_cust,
                'count': top_cust_cnt,
                'change': cust_change
            },
            'topVendor': {
                'name': top_vend,
                'count': top_vend_cnt,
                'change': vend_change
            },
            'completionRates': {
                'salesOrders': {
                    'rate': round(so_rate, 1),
                    'completed': so_completed,
                    'total': so_total,
                    'change': so_comp_change
                },
                'purchaseOrders': {
                    'rate': round(po_rate, 1),
                    'completed': po_completed,
                    'total': po_total,
                    'change': po_comp_change
                }
            },
            'staffInvolvement': staff_table,
            'recommendations': recommendations,
            'summary': (
                f"Compared to {comparison_label}: "
                f"Item Receipts {current_purchase_fulfilments} ({purchase_fulfilments_change}), Item Fulfillments {current_sales_fulfilments} ({sales_fulfilments_change})"
            )
        })
        
    except Exception as e:
        import traceback
        logging.error(f"Error in insights_api: {str(e)}\n{traceback.format_exc()}")
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def pending_approval_inventory_adjustments_api(request):
    """API view to retrieve pending approval inventory adjustments with pagination and filters."""
    pagination_class = HTTPSPageNumberPagination
    
    location = request.query_params.get('location', '')
    status = request.query_params.get('status', '')
    timeframe = request.query_params.get('timeframe', 'today')
    
    adjustments = PendingApprovalInventoryAdjustments.objects.all()
    
    # Always filter by "Pending Approval" status by default (unless a different status is explicitly provided)
    # This ensures only pending items are shown, and completed items are excluded
    if status:
        # If status filter is provided, use it (for additional filtering)
        adjustments = adjustments.filter(status__icontains=status)
    else:
        # Default: only show "Pending Approval" status
        adjustments = adjustments.filter(status__icontains='Pending Approval')
    
    # Apply location filter
    if location:
        adjustments = adjustments.filter(location__icontains=location)
    
    # Note: Removed date/timeframe filter as per requirement - table should not depend on date created
    # The table shows all pending approvals regardless of when they were created
    
    # Order by date created (most recent first)
    adjustments = adjustments.order_by('-dateCreated')
    
    paginator = pagination_class()
    page = paginator.paginate_queryset(adjustments, request)
    serialized = PendingApprovalInventoryAdjustmentsSerializer(page, many=True)
    return paginator.get_paginated_response(serialized.data)


@api_view(['GET'])
def reorder_items_api(request):
    """API view to retrieve reorder items with pagination and filters."""
    pagination_class = HTTPSPageNumberPagination
    
    item_name = request.query_params.get('itemName', '')
    timeframe = request.query_params.get('timeframe', 'today')
    
    # Note: ReOrderItems doesn't have a date field, so timeframe filter doesn't apply
    # But we'll keep the parameter for consistency with other APIs
    
    items = ReOrderItems.objects.all()
    
    # Apply filters
    if item_name:
        items = items.filter(itemName__icontains=item_name)
    
    # Order by item name
    items = items.order_by('itemName')
    
    paginator = pagination_class()
    page = paginator.paginate_queryset(items, request)
    serialized = ReOrderItemsSerializer(page, many=True)
    return paginator.get_paginated_response(serialized.data)

