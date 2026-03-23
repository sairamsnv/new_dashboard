from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.viewsets import ReadOnlyModelViewSet
from rest_framework.views import APIView
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta, datetime
from .models import (
    TotalReturnOrders,
    PodUpdatedOrders, 
    OrdersPendingDeliveries,
    OrdersAssignedToDrivers,
    TotalLoadPlans
)
from .serializers import (
    TotalReturnOrdersSerializer,
    PodUpdatedOrdersSerializer,
    OrdersPendingDeliveriesSerializer,
    OrdersAssignedToDriversSerializer,
    TotalLoadPlansSerializer
)


def filter_by_timeframe(queryset, timeframe):
    """Filter queryset by timeframe using proper date filtering."""
    from django.utils import timezone
    from datetime import timedelta
    
    now = timezone.now()
    if timeframe == 'today':
        return queryset.filter(deliverydate__date=now.date())
    elif timeframe == 'week':
        return queryset.filter(deliverydate__gte=now - timedelta(days=7))
    elif timeframe == 'month':
        return queryset.filter(deliverydate__gte=now - timedelta(days=30))
    return queryset

def get_driver_performance(queryset):
    """Get driver performance data from filtered queryset."""
    driver_performance_data = queryset.values('driver', 'lpStatus').annotate(
        count=Count('loadplan')
    ).order_by('driver', 'lpStatus')
    
    # Group by driver to show completed vs in progress
    driver_stats = {}
    for item in driver_performance_data:
        driver = item['driver']
        status = item['lpStatus']
        count = item['count']
        
        if driver not in driver_stats:
            driver_stats[driver] = {'completed': 0, 'in_progress': 0, 'not_started': 0, 'total': 0}
        
        # Categorize status into three categories: Completed, In Progress, Not Started
        status_lower = status.lower()
        if status_lower in ['completed', 'delivered', 'finished', 'done', 'closed', 'finalized']:
            driver_stats[driver]['completed'] += count
        elif status_lower in ['in process', 'active', 'in progress', 'process', 'assigned', 'loading', 'on route']:
            driver_stats[driver]['in_progress'] += count
        elif status_lower in ['not started', 'pending', 'scheduled', 'created', 'new']:
            driver_stats[driver]['not_started'] += count
        else:
            # For any unknown status, default to not_started
            driver_stats[driver]['not_started'] += count
        
        driver_stats[driver]['total'] += count
    
    # Convert to list format for chart
    driver_performance = []
    for driver, stats in driver_stats.items():
        driver_performance.append({
            'driver': driver,
            'completed': stats['completed'],
            'in_progress': stats['in_progress'],
            'not_started': stats['not_started'],
            'total': stats['total']
        })
    
    # Sort by total count (descending) and limit to top 10
    return sorted(driver_performance, key=lambda x: x['total'], reverse=True)[:10]

def get_load_plan_status(queryset):
    """Get load plan status data from filtered queryset."""
    try:
        load_plan_status_data = queryset.values('lpStatus').annotate(
            count=Count('loadplan')
        ).order_by('-count')
        
        # Categorize statuses into groups that match frontend expectations
        status_categories = {}
        for item in load_plan_status_data:
            status = item['lpStatus']
            count = item['count']
            status_lower = status.lower()
            
            # Categorize status to match frontend color mapping
            if status_lower in ['completed', 'delivered', 'finished', 'done', 'closed', 'finalized']:
                category = 'Completed'
            elif status_lower in ['in process', 'active', 'started', 'in progress', 'process', 'pending', 'assigned', 'loading', 'on route']:
                category = 'In Progress'
            elif status_lower in ['not started', 'pending', 'scheduled']:
                category = 'Not Started'
            else:
                # For any unknown status, default to "In Progress"
                category = 'In Progress'
            
            if category not in status_categories:
                status_categories[category] = 0
            status_categories[category] += count
        
        # Convert to list format for chart
        load_plan_status = []
        for category, count in status_categories.items():
            load_plan_status.append({
                'name': category,
                'count': count
            })
        
        return load_plan_status
    except Exception as e:
        return []

def get_location_distribution():
    """Get location distribution data."""
    return TotalLoadPlans.objects.values('location').annotate(
        loadplan_count=Count('loadplan')
    ).order_by('-loadplan_count')[:10]

def get_return_reasons():
    """Get return reasons data."""
    return TotalReturnOrders.objects.exclude(
        returnNotes=''
    ).values('returnNotes').annotate(
        count=Count('documentno')
    ).order_by('-count')[:5]


class DRPagination(PageNumberPagination):
    """Custom pagination for DR dashboard."""
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


@api_view(['GET'])
def dr_active_drivers(request):
    """API view to fetch unique active drivers for today."""
    try:
        # Get unique active drivers from TotalLoadPlans (only driver names, no duplicates)
        active_drivers = TotalLoadPlans.objects.filter(
            lpStatus__in=['In Process', 'Active', 'Started', 'In Progress', 'Process']
        ).values('driver').distinct()
        
        # If no exact matches, try case-insensitive search
        if not active_drivers.exists():
            active_drivers = TotalLoadPlans.objects.filter(
                lpStatus__icontains='process'
            ).values('driver').distinct()
        
        # Convert to list format - only unique driver names
        drivers_list = []
        for driver in active_drivers:
            if driver['driver']:  # Only add non-empty driver names
                drivers_list.append({
                    'driver': driver['driver'],
                    'status': 'Active',
                    'location': 'Campbelltown',  # Default location
                    'deliverydate': 'Today'
                })
        
        return Response({
            'count': len(drivers_list),
            'results': drivers_list
        })
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def dr_active_orders(request):
    """API view to fetch all active (non-delivered) orders with pagination."""
    try:
        from rest_framework.pagination import PageNumberPagination
        
        # Get all non-delivered orders (matching KPI logic)
        queryset = OrdersAssignedToDrivers.objects.exclude(
            deliverystatus__icontains='delivered'
        ).order_by('-id')
        
        # Apply pagination
        paginator = PageNumberPagination()
        paginator.page_size = 10
        
        page = paginator.paginate_queryset(queryset, request)
        if page is not None:
            serializer = OrdersAssignedToDriversSerializer(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        
        # If no pagination needed
        serializer = OrdersAssignedToDriversSerializer(queryset, many=True)
        return Response({
            'count': queryset.count(),
            'results': serializer.data
        })
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def dr_debug_dates(request):
    """Debug endpoint to check date formats in database."""
    try:
        from django.utils import timezone
        
        # Get sample delivery dates from TotalLoadPlans
        delivery_dates = TotalLoadPlans.objects.values_list('deliverydate', flat=True).distinct()[:10]
        
        # Get sample dates from TotalReturnOrders
        return_dates = TotalReturnOrders.objects.values_list('date', flat=True).distinct()[:10]
        
        # Get current time in different formats
        now = timezone.now()
        local_now = datetime.now()
        
        return Response({
            'delivery_dates': list(delivery_dates),
            'return_dates': list(return_dates),
            'timezone_now': now.strftime('%Y-%m-%d %H:%M:%S %Z'),
            'local_now': local_now.strftime('%Y-%m-%d %H:%M:%S'),
            'today_dd_mm_yyyy': local_now.strftime('%#d/%#m/%Y'),
            'today_mm_dd_yyyy': local_now.strftime('%#m/%#d/%Y'),
            'today_dd_mm_yyyy_tz': now.strftime('%#d/%#m/%Y'),
            'today_mm_dd_yyyy_tz': now.strftime('%#m/%#d/%Y'),
        })
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def dr_load_plans(request):
    """API view to fetch load plan details with status filtering."""
    timeframe = request.GET.get('timeframe', 'today')
    status = request.GET.get('status', 'all')
    
    try:
        from datetime import datetime, timedelta
        from django.db.models import Q
        
        # Use local datetime instead of UTC to match database timezone
        now = datetime.now()
        
        # Get all load plans and apply timeframe filtering
        load_plans = TotalLoadPlans.objects.exclude(
            driver__isnull=True
        ).exclude(
            driver=''
        )
        
        # Apply timeframe filtering using deliverydate field
        if timeframe == 'today':
            today_q = Q()
            today_formats = [
                now.strftime('%#d/%#m/%Y'),  # 16/9/2025 (DD/MM/YYYY without zero padding)
                now.strftime('%d/%m/%Y'),    # 16/09/2025 (DD/MM/YYYY with zero padding)
                now.strftime('%#m/%#d/%Y'),  # 9/16/2025 (MM/DD/YYYY without zero padding)
                now.strftime('%m/%d/%Y'),    # 09/16/2025 (MM/DD/YYYY with zero padding)
                f"{now.day}/{now.month}/{now.year}"  # 16/9/2025 ✅ EXACT MATCH
            ]
            
            for date_str in today_formats:
                today_q |= Q(deliverydate__icontains=date_str)
            load_plans = load_plans.filter(today_q)
        elif timeframe == 'week':
            week_q = Q()
            
            # Show date range for week filter
            start_date = now - timedelta(days=7)
            end_date = now
            print(f"📅 Week filter: {start_date.day}/{start_date.month}/{start_date.year} to {end_date.day}/{end_date.month}/{end_date.year}")
            
            for i in range(8):
                date = now - timedelta(days=i)
                # Generate date formats to match your database format: DD/MM/YYYY (like 22/9/2025)
                date_formats = [
                    f"{date.day}/{date.month}/{date.year}",  # 22/9/2025 - EXACT MATCH for your database
                    date.strftime('%#d/%#m/%Y'),  # 22/9/2025 - alternative way to generate same format
                ]
                
                for date_str in date_formats:
                    week_q |= Q(deliverydate__icontains=date_str)
            
            load_plans = load_plans.filter(week_q)
        elif timeframe == 'month':
            month_q = Q()
            for i in range(31):
                date = now - timedelta(days=i)
                date_formats = [
                    date.strftime('%#d/%#m/%Y'),
                    date.strftime('%d/%m/%Y'),
                    date.strftime('%#m/%#d/%Y'),
                    date.strftime('%m/%d/%Y'),
                    f"{date.day}/{date.month}/{date.year}"
                ]
                for date_str in date_formats:
                    month_q |= Q(deliverydate__icontains=date_str)
            load_plans = load_plans.filter(month_q)
        
        # Apply status filtering - use exact status values from database
        if status == 'in_progress':
            load_plans = load_plans.filter(lpStatus='In Progress')
        elif status == 'not_started':
            load_plans = load_plans.filter(lpStatus='Not Started')
        elif status == 'completed':
            load_plans = load_plans.filter(lpStatus='Completed')
        
        # Serialize the data
        results = []
        for plan in load_plans:
            results.append({
                'loadplan': plan.loadplan,
                'driver': plan.driver,
                'lpStatus': plan.lpStatus,
                'deliverydate': plan.deliverydate,
                'location': plan.location,
                'noOfOrders': plan.noOfOrders,
                'warehouse': plan.warehouse,
                'totalStops': plan.totalStops,
                'truckType': plan.truckType,
                'truckWeight': plan.truckWeight,
                'totalLpWeight': plan.totalLpWeight
            })
        
        return Response({
            'count': len(results),
            'results': results
        })
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def dr_document_types(request):
    """API view to fetch document types from pod_updated_orders with timeframe filtering."""
    try:
        from django.db.models import Count
        from datetime import datetime, timedelta
        
        timeframe = request.query_params.get('timeframe', 'today')
        filter_type = request.query_params.get('filter', 'All')
        
        
        # Get queryset for pod_updated_orders
        queryset = PodUpdatedOrders.objects.all()
        
        # Apply timeframe filtering based on deliveryTime field
        # Date format: "9/15/2025 17:55:22 pm" -> convert to "9/15/2025" for filtering
        if timeframe and timeframe != 'year':
            now = datetime.now()
            
            # Debug: Check sample deliveryTime values from database
            sample_times = queryset.values_list('deliveryTime', flat=True).distinct()[:5]
            
            if timeframe == 'today':
                # Try multiple date formats to match database
                from django.db.models import Q
                today_q = Q()
                
                # Try different M/D/YYYY formats
                today_formats = [
                    now.strftime('%#m/%#d/%Y'),  # 9/16/2025 (M/D/YYYY without zero padding)
                    now.strftime('%m/%d/%Y'),    # 09/16/2025 (M/D/YYYY with zero padding)
                    now.strftime('%#d/%#m/%Y'),  # 16/9/2025 (D/M/YYYY without zero padding)
                    now.strftime('%d/%m/%Y'),    # 16/09/2025 (D/M/YYYY with zero padding)
                    f"{now.month}/{now.day}/{now.year}",  # 9/16/2025 ✅ EXACT MATCH
                    f"{now.day}/{now.month}/{now.year}",  # 16/9/2025 ✅ EXACT MATCH
                ]
                
                for date_str in today_formats:
                    count = queryset.filter(deliveryTime__icontains=date_str).count()
                    today_q |= Q(deliveryTime__icontains=date_str)
                
                queryset = queryset.filter(today_q)
                
            elif timeframe == 'week':
                # Filter for last 7 days with comprehensive date format matching
                from django.db.models import Q
                week_q = Q()
                
                for i in range(7):
                    date = now - timedelta(days=i)
                    # Try multiple date formats for each day
                    date_formats = [
                        date.strftime('%#m/%#d/%Y'),  # 9/16/2025 (M/D/YYYY without zero padding)
                        date.strftime('%m/%d/%Y'),    # 09/16/2025 (M/D/YYYY with zero padding)
                        date.strftime('%#d/%#m/%Y'),  # 16/9/2025 (D/M/YYYY without zero padding)
                        date.strftime('%d/%m/%Y'),    # 16/09/2025 (D/M/YYYY with zero padding)
                        f"{date.month}/{date.day}/{date.year}",  # 9/16/2025 ✅ EXACT MATCH
                        f"{date.day}/{date.month}/{date.year}",  # 16/9/2025 ✅ EXACT MATCH
                    ]
                    
                    for date_str in date_formats:
                        week_q |= Q(deliveryTime__icontains=date_str)
                
                queryset = queryset.filter(week_q)
                
            elif timeframe == 'month':
                # Filter for last 30 days with comprehensive date format matching
                from django.db.models import Q
                month_q = Q()
                
                for i in range(30):
                    date = now - timedelta(days=i)
                    # Try multiple date formats for each day
                    date_formats = [
                        date.strftime('%#m/%#d/%Y'),  # 9/16/2025 (M/D/YYYY without zero padding)
                        date.strftime('%m/%d/%Y'),    # 09/16/2025 (M/D/YYYY with zero padding)
                        date.strftime('%#d/%#m/%Y'),  # 16/9/2025 (D/M/YYYY without zero padding)
                        date.strftime('%d/%m/%Y'),    # 16/09/2025 (D/M/YYYY with zero padding)
                        f"{date.month}/{date.day}/{date.year}",  # 9/16/2025 ✅ EXACT MATCH
                        f"{date.day}/{date.month}/{date.year}",  # 16/9/2025 ✅ EXACT MATCH
                    ]
                    
                    for date_str in date_formats:
                        month_q |= Q(deliveryTime__icontains=date_str)
                
                queryset = queryset.filter(month_q)
        
        # Get all unique document numbers first
        all_docs = queryset.values_list('documentno', flat=True).distinct()
        
        # Categorize documents based on document number prefix patterns
        item_fulfillment_count = 0
        purchase_orders_count = 0
        return_orders_count = 0
        other_count = 0
        
        for doc_no in all_docs:
            if not doc_no:
                continue
                
            doc_upper = doc_no.upper().strip()
            
            # Check for Item Fulfillment - IF prefix
            if doc_upper.startswith('IF'):
                item_fulfillment_count += 1
            # Check for Return Orders - RA prefix
            elif doc_upper.startswith('RA'):
                return_orders_count += 1
            # Check for Purchase Orders - P prefix (but not PA, PO, etc.)
            elif doc_upper.startswith('P') and not doc_upper.startswith(('PA', 'PO', 'PR')):
                purchase_orders_count += 1
            # Check for other return order patterns
            elif doc_upper.startswith(('RO', 'RET')):
                return_orders_count += 1
            # Check for other purchase order patterns
            elif doc_upper.startswith(('PO', 'PUR')):
                purchase_orders_count += 1
            # Check for other item fulfillment patterns
            elif doc_upper.startswith(('SO', 'SAL')):
                item_fulfillment_count += 1
            # Default to other for unknown patterns
            else:
                other_count += 1
        
        
        # Apply document type filtering based on prefix
        document_types = []
        
        if filter_type == 'All':
            # Show all categories that have data
            if item_fulfillment_count > 0:
                document_types.append({
                    'documentType': 'Item Fulfillment',
                    'count': item_fulfillment_count
                })
            
            if purchase_orders_count > 0:
                document_types.append({
                    'documentType': 'Purchase Orders',
                    'count': purchase_orders_count
                })
            
            if return_orders_count > 0:
                document_types.append({
                    'documentType': 'Return Orders',
                    'count': return_orders_count
                })
            
            if other_count > 0:
                document_types.append({
                    'documentType': 'Other',
                    'count': other_count
                })
        else:
            # Show only the filtered category
            if filter_type == 'Item Fulfillment' and item_fulfillment_count > 0:
                document_types.append({
                    'documentType': 'Item Fulfillment',
                    'count': item_fulfillment_count
                })
            elif filter_type == 'Purchase Orders' and purchase_orders_count > 0:
                document_types.append({
                    'documentType': 'Purchase Orders',
                    'count': purchase_orders_count
                })
            elif filter_type == 'Return Orders' and return_orders_count > 0:
                document_types.append({
                    'documentType': 'Return Orders',
                    'count': return_orders_count
                })
            elif filter_type == 'Other' and other_count > 0:
                document_types.append({
                    'documentType': 'Other',
                    'count': other_count
                })
        
        return Response({
            'count': len(document_types),
            'results': document_types
        })
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def dr_dashboard_kpis(request):
    """API view to fetch DR dashboard KPIs - NO timeframe filtering as these tables don't have date fields."""
    
    try:
        # 1. Total Orders - Count of orders that are NOT delivered (in progress/pending)
        # This shows orders that are still in progress, not completed
        # Note: OrdersAssignedToDrivers doesn't have date fields, so this is not timeframe-dependent
        total_orders = OrdersAssignedToDrivers.objects.exclude(
            deliverystatus__icontains='delivered'
        ).count()
        
        # 2. Total Return Orders - Count ALL return orders (no date filtering)
        # Since TotalReturnOrders has date field but KPI cards should show total counts
        total_return_orders = TotalReturnOrders.objects.count()
        
        # 3. Active Drivers - Count of unique drivers with active load plans
        # This includes drivers with "In Process", "Active", "Started", etc. status
        active_drivers = TotalLoadPlans.objects.filter(
            lpStatus__in=['In Process', 'Active', 'Started', 'In Progress', 'Process']
        ).values('driver').distinct().count()
        
        # If no exact matches, try case-insensitive search
        if active_drivers == 0:
            active_drivers = TotalLoadPlans.objects.filter(
                lpStatus__icontains='process'
            ).values('driver').distinct().count()
        
        # 4. Top Delivered Location - Most frequent shipping city from OrdersAssignedToDrivers
        # Since this table doesn't have date fields, we'll show the most frequent shipping city
        top_location_data = OrdersAssignedToDrivers.objects.exclude(
            shippingcity__isnull=True
        ).exclude(
            shippingcity=''
        ).values('shippingcity').annotate(
            delivery_count=Count('shippingcity')
        ).order_by('-delivery_count').first()
        
        top_delivered_location = top_location_data['shippingcity'] if top_location_data else "No deliveries"
        
        kpis = [
            {"title": "Total Active Orders", "value": total_orders, "icon": "Package"},
            {"title": "Total Return Orders", "value": total_return_orders, "icon": "RotateCcw"},
            {"title": "Active Drivers", "value": active_drivers, "icon": "Users"},
            {"title": "Top Delivered Location", "value": top_delivered_location, "icon": "MapPin"}
        ]
        
        # Debug logging
        
        return Response(kpis)
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def dr_dashboard_stats(request):
    """API view to fetch DR dashboard statistics for charts."""
    timeframe = request.GET.get('timeframe', 'today')
    
    try:
        # Driver Performance Chart - Using TotalLoadPlans with lpStatus
        # Show drivers and their load plan status (Completed vs In Progress)
        # Apply timeframe filtering using deliverydate field
        
        from datetime import datetime, timedelta
        from django.utils import timezone
        
        # Use local datetime instead of UTC to match database timezone
        from datetime import datetime
        now = datetime.now()  # Local time instead of UTC
        
        # Get all load plans and group by driver and status
        driver_performance_data = TotalLoadPlans.objects.exclude(
            driver__isnull=True
        ).exclude(
            driver=''
        )
        
        # Generate date formats for filtering
        today_formats = [
            now.strftime('%#d/%#m/%Y'),  # 15/9/2025 (DD/MM/YYYY)
            now.strftime('%d/%m/%Y'),    # 15/09/2025 (DD/MM/YYYY)
            now.strftime('%#m/%#d/%Y'),  # 9/15/2025 (MM/DD/YYYY) 
            now.strftime('%m/%d/%Y'),    # 09/15/2025 (MM/DD/YYYY)
        ]
        
        # Apply timeframe filtering using deliverydate field
        # Database format: "1/9/2025" (DD/MM/YYYY) - need to handle both local and production timezones
        if timeframe == 'today':
            from django.db.models import Q
            today_q = Q()
            
            # Try both DD/MM/YYYY and MM/DD/YYYY formats to handle timezone differences
            # Local server: generates 15/9/2025 (DD/MM/YYYY)
            # Production server: generates 16/09/2025 (DD/MM/YYYY with zero padding)
            # Database stores: 16/9/2025 (DD/MM/YYYY without zero padding)
            today_formats = [
                now.strftime('%#d/%#m/%Y'),  # 16/9/2025 (DD/MM/YYYY without zero padding) ✅ MATCHES DB
                now.strftime('%d/%m/%Y'),    # 16/09/2025 (DD/MM/YYYY with zero padding)
                now.strftime('%#m/%#d/%Y'),  # 9/16/2025 (MM/DD/YYYY without zero padding)
                now.strftime('%m/%d/%Y'),    # 09/16/2025 (MM/DD/YYYY with zero padding)
            ]
            
            # Add the exact format that matches your database: 16/9/2025
            # This is the critical fix - add the non-zero-padded format
            today_formats.append(f"{now.day}/{now.month}/{now.year}")  # 16/9/2025 ✅ EXACT MATCH
            
            # Only use today's formats - don't include yesterday for "today" filter
            all_formats = today_formats
            for date_str in all_formats:
                today_q |= Q(deliverydate__icontains=date_str)
            
            driver_performance_data = driver_performance_data.filter(today_q)
        elif timeframe == 'week':
            # Get records from last 7 days - create date range with multiple formats
            from django.db.models import Q
            week_q = Q()
            
            # Show date range for week filter
            start_date = now - timedelta(days=7)
            end_date = now
            print(f"📅 Week filter: {start_date.day}/{start_date.month}/{start_date.year} to {end_date.day}/{end_date.month}/{end_date.year}")
            
            for i in range(7):
                date = now - timedelta(days=i)
                # Try multiple date formats for each day to handle timezone differences
                # Include both zero-padded and non-zero-padded formats
                date_formats = [
                    date.strftime('%#d/%#m/%Y'),  # 16/9/2025 (DD/MM/YYYY without zero padding) ✅ MATCHES DB
                    date.strftime('%d/%m/%Y'),    # 16/09/2025 (DD/MM/YYYY with zero padding)
                    date.strftime('%#m/%#d/%Y'),  # 9/16/2025 (MM/DD/YYYY without zero padding)
                    date.strftime('%m/%d/%Y'),    # 09/16/2025 (MM/DD/YYYY with zero padding)
                ]
                
                # Add the exact format that matches your database: 16/9/2025
                date_formats.append(f"{date.day}/{date.month}/{date.year}")  # 16/9/2025 ✅ EXACT MATCH
                
                for date_str in date_formats:
                    week_q |= Q(deliverydate__icontains=date_str)
            
            driver_performance_data = driver_performance_data.filter(week_q)
            print(f"🔍 Week filter applied - Records found: {driver_performance_data.count()}")
        elif timeframe == 'month':
            # Get records from last 31 days - create date range with multiple formats
            from django.db.models import Q
            month_q = Q()
            
            for i in range(31):
                date = now - timedelta(days=i)
                # Try multiple date formats for each day to handle timezone differences
                # Include both zero-padded and non-zero-padded formats
                date_formats = [
                    date.strftime('%#d/%#m/%Y'),  # 16/9/2025 (DD/MM/YYYY without zero padding) ✅ MATCHES DB
                    date.strftime('%d/%m/%Y'),    # 16/09/2025 (DD/MM/YYYY with zero padding)
                    date.strftime('%#m/%#d/%Y'),  # 9/16/2025 (MM/DD/YYYY without zero padding)
                    date.strftime('%m/%d/%Y'),    # 09/16/2025 (MM/DD/YYYY with zero padding)
                ]
                
                # Add the exact format that matches your database: 16/9/2025
                date_formats.append(f"{date.day}/{date.month}/{date.year}")  # 16/9/2025 ✅ EXACT MATCH
                
                for date_str in date_formats:
                    month_q |= Q(deliverydate__icontains=date_str)
            
            driver_performance_data = driver_performance_data.filter(month_q)
        # For 'year', we get all records (no filtering)
        
        # Debug logging
        
        driver_performance_data = driver_performance_data.values('driver', 'lpStatus').annotate(
            count=Count('loadplan')
        ).order_by('driver', 'lpStatus')
        
        # Debug: Check grouped data
        grouped_data = list(driver_performance_data)
        
        # Group by driver to show completed vs in progress
        driver_stats = {}
        for item in driver_performance_data:
            driver = item['driver']
            status = item['lpStatus']
            count = item['count']
            
            
            if driver not in driver_stats:
                driver_stats[driver] = {'completed': 0, 'in_progress': 0, 'not_started': 0, 'total': 0}
            
            # Categorize status into three categories: Completed, In Progress, Not Started
            status_lower = status.lower()
            if status_lower in ['completed', 'delivered', 'finished', 'done', 'closed', 'finalized']:
                driver_stats[driver]['completed'] += count
            elif status_lower in ['in process', 'active', 'in progress', 'process', 'assigned', 'loading', 'on route']:
                driver_stats[driver]['in_progress'] += count
            elif status_lower in ['not started', 'pending', 'scheduled', 'created', 'new']:
                driver_stats[driver]['not_started'] += count
            else:
                # For any unknown status, default to not_started
                driver_stats[driver]['not_started'] += count
            
            driver_stats[driver]['total'] += count
        
        
        # Convert to list format for chart
        driver_performance = []
        for driver, stats in driver_stats.items():
            driver_performance.append({
                'driver': driver,
                'completed': stats['completed'],
                'in_progress': stats['in_progress'],
                'not_started': stats['not_started'],
                'total': stats['total']
            })
        
        # Sort by total load plans and take top 10
        driver_performance = sorted(driver_performance, key=lambda x: x['total'], reverse=True)[:10]
        
        # Load Plan Status Distribution - using SAME filtered queryset as driver performance
        try:
            # Use the SAME filtered queryset that was already filtered by timeframe
            # This ensures both charts show the same data
            load_plan_status_data = driver_performance_data.values('lpStatus').annotate(
                count=Count('loadplan')
            ).order_by('-count')
            print(f"🔍 Load Plan Status Data - Total records: {driver_performance_data.count()}")
            print(f"🔍 Load Plan Status Categories: {list(load_plan_status_data)}")
            
            
            # Categorize statuses into groups that match frontend expectations
            status_categories = {}
            for item in load_plan_status_data:
                status = item['lpStatus']
                count = item['count']
                status_lower = status.lower()
                
                
                # Categorize status to match frontend color mapping
                if status_lower in ['completed', 'delivered', 'finished', 'done', 'closed', 'finalized']:
                    category = 'Completed'
                elif status_lower in ['in process', 'active', 'started', 'in progress', 'process', 'pending', 'assigned', 'loading', 'on route']:
                    category = 'In Progress'
                elif status_lower in ['not started', 'pending', 'scheduled']:
                    category = 'Not Started'
                else:
                    # For any unknown status, default to "In Progress"
                    category = 'In Progress'
                
                if category not in status_categories:
                    status_categories[category] = 0
                status_categories[category] += count
                
            
            # Convert to list format for chart
            load_plan_status = []
            for category, count in status_categories.items():
                load_plan_status.append({
                    'name': category,
                    'count': count
                })
            
            
        except Exception as e:
            load_plan_status = []
        
        # Location distribution data based on timeframe
        # Note: TotalLoadPlans doesn't have date fields, so we'll use all records
        location_distribution = TotalLoadPlans.objects.values('location').annotate(
            loadplan_count=Count('loadplan')
        ).order_by('-loadplan_count')[:10]
        
        # Return orders by reason (if we have returnNotes) based on timeframe
        # Note: TotalReturnOrders uses different date format, so we'll get all records for now
        return_reasons = TotalReturnOrders.objects.exclude(
            returnNotes__isnull=True
        ).exclude(
            returnNotes=''
        ).values('returnNotes').annotate(
            count=Count('documentno')
        ).order_by('-count')[:5]
        
        # Debug logging - show data sources
        print(f"🔍 DR Stats Summary:")
        print(f"   - Driver Performance: {len(driver_performance)} drivers")
        print(f"   - Load Plan Status: {len(load_plan_status)} categories")
        print(f"   - Location Distribution: {len(list(location_distribution))} locations")
        print(f"   - Return Reasons: {len(list(return_reasons))} reasons")
        
        # Show sample data
        if driver_performance:
            print(f"   - Sample Driver: {driver_performance[0]}")
        if load_plan_status:
            print(f"   - Sample Load Plan Status: {load_plan_status[0]}")
        
        stats = {
            "driver_performance": driver_performance,
            "load_plan_status": load_plan_status,
            "location_distribution": list(location_distribution),
            "return_reasons": list(return_reasons)
        }
        
        return Response(stats)
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ViewSets for individual data tables
class TotalReturnOrdersViewSet(ReadOnlyModelViewSet):
    """ViewSet for return orders with filtering and pagination."""
    queryset = TotalReturnOrders.objects.all()
    serializer_class = TotalReturnOrdersSerializer
    pagination_class = DRPagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        customer = self.request.query_params.get('customer')
        timeframe = self.request.query_params.get('timeframe', 'today')
        
        if customer:
            queryset = queryset.filter(customer__icontains=customer)
        
        # Apply timeframe filtering based on date field
        # Date format: "September 8, 2025 6:45:39 PM PDT"
        if timeframe and timeframe != 'year':
            from datetime import datetime, timedelta
            now = datetime.now()  # Local time (same as WMS dashboard)
            
            if timeframe == 'today':
                # Filter for today's date
                today_str = now.strftime('%B %#d, %Y')  # "September 8, 2025"
                queryset = queryset.filter(date__icontains=today_str)
                
            elif timeframe == 'week':
                # Filter for last 7 days
                from django.db.models import Q
                week_dates = []
                for i in range(7):
                    date = now - timedelta(days=i)
                    week_dates.append(date.strftime('%B %#d, %Y'))  # "September 8, 2025"
                
                
                week_q = Q()
                for date_str in week_dates:
                    week_q |= Q(date__icontains=date_str)
                
                queryset = queryset.filter(week_q)
                
            elif timeframe == 'month':
                # Filter for last 30 days
                from django.db.models import Q
                month_dates = []
                for i in range(30):
                    date = now - timedelta(days=i)
                    month_dates.append(date.strftime('%B %#d, %Y'))  # "September 8, 2025"
                
                
                month_q = Q()
                for date_str in month_dates:
                    month_q |= Q(date__icontains=date_str)
                
                queryset = queryset.filter(month_q)
        
        # Order by date (most recent first)
        queryset = queryset.order_by('-date')
        
        return queryset


class PodUpdatedOrdersViewSet(ReadOnlyModelViewSet):
    """ViewSet for POD updated orders with filtering and pagination."""
    queryset = PodUpdatedOrders.objects.all()
    serializer_class = PodUpdatedOrdersSerializer
    pagination_class = DRPagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        driver = self.request.query_params.get('driver')
        status = self.request.query_params.get('status')
        timeframe = self.request.query_params.get('timeframe', 'today')
        
        if driver:
            queryset = queryset.filter(driver__icontains=driver)
        
        if status:
            queryset = queryset.filter(deliveryStatus__icontains=status)
        
        # Apply timeframe filtering based on deliveryTime field
        # Date format: "9/15/2025 17:55:22 pm" -> convert to "9/15/2025" for filtering
        if timeframe and timeframe != 'year':
            from datetime import datetime, timedelta
            now = datetime.now()  # Local time (same as WMS dashboard)
            
            # Debug: Check sample deliveryTime values from database
            sample_times = queryset.values_list('deliveryTime', flat=True).distinct()[:5]
            
            if timeframe == 'today':
                # Try multiple date formats to match database
                from django.db.models import Q
                today_q = Q()
                
                # Try different M/D/YYYY formats
                today_formats = [
                    now.strftime('%#m/%#d/%Y'),  # 9/16/2025 (M/D/YYYY without zero padding)
                    now.strftime('%m/%d/%Y'),    # 09/16/2025 (M/D/YYYY with zero padding)
                    now.strftime('%#d/%#m/%Y'),  # 16/9/2025 (D/M/YYYY without zero padding)
                    now.strftime('%d/%m/%Y'),    # 16/09/2025 (D/M/YYYY with zero padding)
                    f"{now.month}/{now.day}/{now.year}",  # 9/16/2025 ✅ EXACT MATCH
                    f"{now.day}/{now.month}/{now.year}",  # 16/9/2025 ✅ EXACT MATCH
                ]
                
                for date_str in today_formats:
                    count = queryset.filter(deliveryTime__icontains=date_str).count()
                    today_q |= Q(deliveryTime__icontains=date_str)
                
                queryset = queryset.filter(today_q)
                
            elif timeframe == 'week':
                # Filter for last 7 days with comprehensive date format matching
                from django.db.models import Q
                week_q = Q()
                
                for i in range(7):
                    date = now - timedelta(days=i)
                    # Try multiple date formats for each day
                    date_formats = [
                        date.strftime('%#m/%#d/%Y'),  # 9/16/2025 (M/D/YYYY without zero padding)
                        date.strftime('%m/%d/%Y'),    # 09/16/2025 (M/D/YYYY with zero padding)
                        date.strftime('%#d/%#m/%Y'),  # 16/9/2025 (D/M/YYYY without zero padding)
                        date.strftime('%d/%m/%Y'),    # 16/09/2025 (D/M/YYYY with zero padding)
                        f"{date.month}/{date.day}/{date.year}",  # 9/16/2025 ✅ EXACT MATCH
                        f"{date.day}/{date.month}/{date.year}",  # 16/9/2025 ✅ EXACT MATCH
                    ]
                    
                    for date_str in date_formats:
                        week_q |= Q(deliveryTime__icontains=date_str)
                
                queryset = queryset.filter(week_q)
                
            elif timeframe == 'month':
                # Filter for last 30 days with comprehensive date format matching
                from django.db.models import Q
                month_q = Q()
                
                for i in range(30):
                    date = now - timedelta(days=i)
                    # Try multiple date formats for each day
                    date_formats = [
                        date.strftime('%#m/%#d/%Y'),  # 9/16/2025 (M/D/YYYY without zero padding)
                        date.strftime('%m/%d/%Y'),    # 09/16/2025 (M/D/YYYY with zero padding)
                        date.strftime('%#d/%#m/%Y'),  # 16/9/2025 (D/M/YYYY without zero padding)
                        date.strftime('%d/%m/%Y'),    # 16/09/2025 (D/M/YYYY with zero padding)
                        f"{date.month}/{date.day}/{date.year}",  # 9/16/2025 ✅ EXACT MATCH
                        f"{date.day}/{date.month}/{date.year}",  # 16/9/2025 ✅ EXACT MATCH
                    ]
                    
                    for date_str in date_formats:
                        month_q |= Q(deliveryTime__icontains=date_str)
                
                queryset = queryset.filter(month_q)
        
        # Order by deliveryTime (most recent first)
        queryset = queryset.order_by('-deliveryTime')
        
        return queryset


class OrdersPendingDeliveriesViewSet(ReadOnlyModelViewSet):
    """ViewSet for pending delivery orders with filtering and pagination."""
    queryset = OrdersPendingDeliveries.objects.all()
    serializer_class = OrdersPendingDeliveriesSerializer
    pagination_class = DRPagination


class OrdersAssignedToDriversViewSet(ReadOnlyModelViewSet):
    """ViewSet for orders assigned to drivers with filtering and pagination."""
    queryset = OrdersAssignedToDrivers.objects.all()
    serializer_class = OrdersAssignedToDriversSerializer
    pagination_class = DRPagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        driver = self.request.query_params.get('driver')
        timeframe = self.request.query_params.get('timeframe')
        
        if driver:
            queryset = queryset.filter(driver__icontains=driver)
        
        # Apply timeframe filtering by linking with TotalLoadPlans
        # Only apply filtering if timeframe parameter is explicitly provided
        if timeframe and timeframe != 'year':
            from datetime import datetime, timedelta
            now = datetime.now()  # Local time (same as WMS dashboard)
            
            if timeframe == 'today':
                # Use the same comprehensive date format matching as main stats
                from django.db.models import Q
                today_q = Q()
                
                # Try multiple date formats to match database
                today_formats = [
                    now.strftime('%#d/%#m/%Y'),  # 16/9/2025 (DD/MM/YYYY without zero padding)
                    now.strftime('%d/%m/%Y'),    # 16/09/2025 (DD/MM/YYYY with zero padding)
                    now.strftime('%#m/%#d/%Y'),  # 9/16/2025 (MM/DD/YYYY without zero padding)
                    now.strftime('%m/%d/%Y'),    # 09/16/2025 (MM/DD/YYYY with zero padding)
                    f"{now.day}/{now.month}/{now.year}"  # 16/9/2025 ✅ EXACT MATCH
                ]
                
                # Also try yesterday in case of timezone differences
                yesterday = now - timedelta(days=1)
                yesterday_formats = [
                    yesterday.strftime('%#d/%#m/%Y'),
                    yesterday.strftime('%d/%m/%Y'),
                    yesterday.strftime('%#m/%#d/%Y'),
                    yesterday.strftime('%m/%d/%Y'),
                    f"{yesterday.day}/{yesterday.month}/{yesterday.year}"  # 15/9/2025 ✅ EXACT MATCH
                ]
                
                all_formats = today_formats + yesterday_formats
                
                for date_str in all_formats:
                    today_q |= Q(deliverydate__icontains=date_str)
                
                # Get load plans for today and filter assigned orders by those load plans
                today_load_plans = TotalLoadPlans.objects.filter(today_q).values_list('loadplan', flat=True)
                queryset = queryset.filter(loadplan__in=today_load_plans)
                
            elif timeframe == 'week':
                # Get load plans from last 7 days with comprehensive date format matching
                from django.db.models import Q
                week_q = Q()
                
                for i in range(7):
                    date = now - timedelta(days=i)
                    # Try multiple date formats for each day
                    date_formats = [
                        date.strftime('%#d/%#m/%Y'),  # 16/9/2025 (DD/MM/YYYY without zero padding)
                        date.strftime('%d/%m/%Y'),    # 16/09/2025 (DD/MM/YYYY with zero padding)
                        date.strftime('%#m/%#d/%Y'),  # 9/16/2025 (MM/DD/YYYY without zero padding)
                        date.strftime('%m/%d/%Y'),    # 09/16/2025 (MM/DD/YYYY with zero padding)
                        f"{date.day}/{date.month}/{date.year}"  # 16/9/2025 ✅ EXACT MATCH
                    ]
                    
                    for date_str in date_formats:
                        week_q |= Q(deliverydate__icontains=date_str)
                
                week_load_plans = TotalLoadPlans.objects.filter(week_q).values_list('loadplan', flat=True)
                queryset = queryset.filter(loadplan__in=week_load_plans)
                
            elif timeframe == 'month':
                # Get load plans from last 30 days with comprehensive date format matching
                from django.db.models import Q
                month_q = Q()
                
                for i in range(30):
                    date = now - timedelta(days=i)
                    # Try multiple date formats for each day
                    date_formats = [
                        date.strftime('%#d/%#m/%Y'),  # 16/9/2025 (DD/MM/YYYY without zero padding)
                        date.strftime('%d/%m/%Y'),    # 16/09/2025 (DD/MM/YYYY with zero padding)
                        date.strftime('%#m/%#d/%Y'),  # 9/16/2025 (MM/DD/YYYY without zero padding)
                        date.strftime('%m/%d/%Y'),    # 09/16/2025 (MM/DD/YYYY with zero padding)
                        f"{date.day}/{date.month}/{date.year}"  # 16/9/2025 ✅ EXACT MATCH
                    ]
                    
                    for date_str in date_formats:
                        month_q |= Q(deliverydate__icontains=date_str)
                
                month_load_plans = TotalLoadPlans.objects.filter(month_q).values_list('loadplan', flat=True)
                queryset = queryset.filter(loadplan__in=month_load_plans)
        
        return queryset


class TotalLoadPlansViewSet(ReadOnlyModelViewSet):
    """ViewSet for total load plans with filtering and pagination."""
    queryset = TotalLoadPlans.objects.all()
    serializer_class = TotalLoadPlansSerializer
    pagination_class = DRPagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        driver = self.request.query_params.get('driver')
        location = self.request.query_params.get('location')
        if driver:
            queryset = queryset.filter(driver__icontains=driver)
        if location:
            queryset = queryset.filter(location__icontains=location)
        return queryset


@api_view(['GET'])
def dr_debug_dates(request):
    """Debug endpoint to check date formats in the database."""
    try:
        from django.utils import timezone
        from datetime import datetime, timedelta
        from django.http import JsonResponse
        
        # Get current local datetime (same as WMS dashboard)
        from datetime import datetime
        now = datetime.now()
        
        # Check what formats we're generating
        formats = {
            'now_iso': now.isoformat(),
            'now_strftime_d_m_y': now.strftime('%#d/%#m/%Y'),
            'now_strftime_dd_mm_yyyy': now.strftime('%d/%m/%Y'),
            'now_strftime_m_d_y': now.strftime('%#m/%#d/%Y'),
            'now_strftime_mm_dd_yyyy': now.strftime('%m/%d/%Y'),
            'now_date_only': now.date().strftime('%#d/%#m/%Y'),
            'timezone_name': str(now.tzinfo),
        }
        
        # Get sample delivery dates from database
        sample_dates = TotalLoadPlans.objects.values_list('deliverydate', flat=True).distinct()[:10]
        
        # Test if any of our formats match the database dates
        matches = {}
        for format_name, format_str in formats.items():
            if isinstance(format_str, str) and format_str:
                count = TotalLoadPlans.objects.filter(deliverydate__icontains=format_str).count()
                matches[format_name] = count
        
        return JsonResponse({
            'timezone_now': formats,
            'sample_delivery_dates': list(sample_dates),
            'total_records': TotalLoadPlans.objects.count(),
            'format_matches': matches
        })
        
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
