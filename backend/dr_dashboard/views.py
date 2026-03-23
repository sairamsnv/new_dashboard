from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.viewsets import ReadOnlyModelViewSet
from rest_framework.views import APIView
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta, datetime
from django.core.exceptions import FieldDoesNotExist


def filter_by_timeframe(queryset, timeframe, date_field):
    """
    Simple timestamp-based filtering for all DR dashboard tables.
    No string matching needed since columns are DateTimeField.
    
    Args:
        queryset: Django QuerySet to filter
        timeframe: 'today', 'week', 'month', or 'year'
        date_field: Name of the date field to filter on
    
    Returns:
        Filtered QuerySet
    """
    now = timezone.now()
    #print(now)
    if timeframe == 'today':
        return queryset.filter(**{f'{date_field}__date': now.date()})
    elif timeframe == 'week':
        # Match SQL: WHERE date >= CURRENT_DATE - interval '7 days' AND date <= CURRENT_DATE
        start_date = now.date() - timedelta(days=7)
        return queryset.filter(**{
            f'{date_field}__date__gte': start_date,
            f'{date_field}__date__lte': now.date()
        })
    elif timeframe == 'month':
        # Match SQL: WHERE date >= CURRENT_DATE - interval '30 days' AND date <= CURRENT_DATE
        start_date = now.date() - timedelta(days=30)
        return queryset.filter(**{
            f'{date_field}__date__gte': start_date,
            f'{date_field}__date__lte': now.date()
        })
    elif timeframe == 'year':
        # Match SQL: WHERE date >= CURRENT_DATE - interval '365 days' AND date <= CURRENT_DATE
        start_date = now.date() - timedelta(days=365)
        return queryset.filter(**{
            f'{date_field}__date__gte': start_date,
            f'{date_field}__date__lte': now.date()
        })
    
    return queryset


def get_driver_performance(queryset):
    """Get driver performance data from filtered queryset."""
    driver_stats = {}
    
    for obj in queryset:
        driver = obj.driver
        if not driver:
            continue
            
        if driver not in driver_stats:
            driver_stats[driver] = {'completed': 0, 'in_progress': 0, 'not_started': 0}
        
        # Categorize status
        status = obj.lpStatus.lower() if obj.lpStatus else ''
        if status in ['completed', 'delivered', 'finished', 'done']:
            driver_stats[driver]['completed'] += 1
        elif status in ['in process', 'active', 'started', 'in progress', 'process', 'ongoing']:
            driver_stats[driver]['in_progress'] += 1
        else:
            driver_stats[driver]['not_started'] += 1
    
    # Convert to list format expected by frontend
    driver_performance = []
    for driver, stats in driver_stats.items():
        total = stats['completed'] + stats['in_progress'] + stats['not_started']
        driver_performance.append({
            'driver': driver,
            'completed': stats['completed'],
            'in_progress': stats['in_progress'],
            'not_started': stats['not_started'],
            'total': total
        })
    
    # Sort by total load plans and take top 10
    driver_performance = sorted(driver_performance, key=lambda x: x['total'], reverse=True)[:10]
    
    return driver_performance


def get_load_plan_status(queryset):
    """Get load plan status distribution from filtered queryset."""
    status_counts = {'completed': 0, 'in_progress': 0, 'not_started': 0}
    
    for obj in queryset:
        status = obj.lpStatus.lower() if obj.lpStatus else ''
        if status in ['completed', 'delivered', 'finished', 'done']:
            status_counts['completed'] += 1
        elif status in ['in process', 'active', 'started', 'in progress', 'process', 'ongoing']:
            status_counts['in_progress'] += 1
        else:
            status_counts['not_started'] += 1
    
    # Convert to list format expected by frontend
    load_plan_status = []
    for status, count in status_counts.items():
        if count > 0:  # Only include statuses with data
            load_plan_status.append({
                'name': status.replace('_', ' ').title(),
                'count': count
            })
    
    return load_plan_status
from .models import (
    TotalReturnOrders,
    PodUpdatedOrders, 
    OrdersPendingDeliveries,
    OrdersAssignedToDrivers,
    TotalLoadPlans,
    TotalSalesOrders
)
from .serializers import (
    TotalReturnOrdersSerializer,
    PodUpdatedOrdersSerializer,
    OrdersPendingDeliveriesSerializer,
    OrdersAssignedToDriversSerializer,
    TotalLoadPlansSerializer,
    TotalSalesOrdersSerializer
)


class DRPagination(PageNumberPagination):
    """Custom pagination for DR dashboard."""
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class DriverAssignmentsPagination(PageNumberPagination):
    """Special pagination for driver assignments - show only 2 orders per page"""
    page_size = 2
    page_size_query_param = 'page_size'
    max_page_size = 10


class ModalTablePagination(PageNumberPagination):
    """Pagination for modal tables - show 5 items per page with next/previous buttons"""
    page_size = 5
    page_size_query_param = 'page_size'
    max_page_size = 20


@api_view(['GET'])
def dr_active_drivers(request):
    """API view to fetch unique active drivers with timeframe filtering."""
    try:
        # Get timeframe parameter (default to 'today' for backward compatibility)
        timeframe = request.GET.get('timeframe', 'today')
        
        # Get active drivers from TotalLoadPlans - use same logic as KPI
        active_drivers_queryset = TotalLoadPlans.objects.filter(
            lpStatus__in=['In Process', 'Active', 'Started', 'In Progress', 'Process']
        )
        
        # If no exact matches, try case-insensitive search
        if not active_drivers_queryset.exists():
            active_drivers_queryset = TotalLoadPlans.objects.filter(
                lpStatus__icontains='process'
            )
        
        # Apply timeframe filter on deliverydate (same as KPI calculation)
        active_drivers_queryset = filter_by_timeframe(active_drivers_queryset, timeframe, 'deliverydate')
        
        # Get unique drivers with their details
        # Group by driver and get the first occurrence's location and deliverydate
        drivers_list = []
        seen_drivers = set()
        
        for plan in active_drivers_queryset.order_by('driver', '-deliverydate'):
            driver = plan.driver
            if driver and driver not in seen_drivers:
                seen_drivers.add(driver)
                
                # Format delivery date
                delivery_date = plan.deliverydate
                if hasattr(delivery_date, 'strftime'):
                    delivery_date_str = delivery_date.strftime('%Y-%m-%d')
                else:
                    delivery_date_str = str(delivery_date) if delivery_date else 'N/A'
                
                drivers_list.append({
                    'driver': driver,
                    'status': plan.lpStatus or 'Active',
                    'location': plan.location or 'N/A',
                    'deliverydate': delivery_date_str
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
        
        # Get all load plans and apply timeframe filtering
        load_plans = TotalLoadPlans.objects.exclude(
            driver__isnull=True
        ).exclude(
            driver=''
        )
        
        # Apply timeframe filtering using simple timestamp-based filtering
        load_plans = filter_by_timeframe(load_plans, timeframe, 'deliverydate')
        
        # Apply status filtering - use same categorization logic as charts
        if status == 'in_progress':
            # Use same logic as get_driver_performance function
            load_plans = load_plans.extra(
                where=["LOWER(lpStatus) IN ('in process', 'active', 'started', 'in progress', 'process', 'ongoing')"]
            )
        elif status == 'not_started':
            # Use same logic as get_driver_performance function
            load_plans = load_plans.extra(
                where=["LOWER(lpStatus) NOT IN ('completed', 'delivered', 'finished', 'done', 'in process', 'active', 'started', 'in progress', 'process', 'ongoing')"]
            )
        elif status == 'completed':
            # Use same logic as get_driver_performance function
            load_plans = load_plans.extra(
                where=["LOWER(lpStatus) IN ('completed', 'delivered', 'finished', 'done')"]
            )
        
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
def dr_driver_assignments_today(request):
    """API view to fetch driver assignments for today from OrdersAssignedToDrivers using created_date."""
    try:
        from django.db import connection
        from datetime import datetime, timedelta
        
        # Get today's date
        today = datetime.now().date()
        print(f"🔍 Looking for driver assignments for today: {today}")
        
        # Get filter parameters
        driver_filter = request.GET.get('driver', '').strip()
        status_filter = request.GET.get('status', '').strip()
        
        # Build the WHERE clause dynamically - use created_date instead of joining with TotalLoadPlans
        where_conditions = ["o.created_date::date = %s", "o.documentno IS NOT NULL", "o.documentno != ''"]
        params = [today]
        
        if driver_filter:
            where_conditions.append("o.driver ILIKE %s")
            params.append(f"%{driver_filter}%")
            
        if status_filter:
            where_conditions.append("o.deliverystatus ILIKE %s")
            params.append(f"%{status_filter}%")
        
        where_clause = " AND ".join(where_conditions)
        
        # Query directly from dr_orders_assigned_to_drivers using created_date
        with connection.cursor() as cursor:
            cursor.execute(f"""
                SELECT 
                    o.documentno,
                    o.driver,
                    o.customer_or_supplier,
                    o.loadplan,
                    o.deliverystatus,
                    o.created_date,
                    o.shippingcity,
                    o.shippingaddress
                FROM rare_dr.dr_orders_assigned_to_drivers o
                WHERE {where_clause}
                ORDER BY o.driver, o.documentno
            """, params)
            
            results = cursor.fetchall()
            print(f"🔍 Found {len(results)} driver assignments for today")
        
        # Convert to the expected format
        assignments = []
        for row in results:
            # Convert datetime to string for JSON serialization
            created_date = row[5]
            if hasattr(created_date, 'strftime'):
                created_date = created_date.strftime('%Y-%m-%d')
            
            assignments.append({
                'documentno': row[0] or '',
                'driver': row[1] or '',
                'customer_or_supplier': row[2] or '',
                'loadplan': row[3] or '',
                'deliverystatus': row[4] or '',
                'deliverydate': created_date,  # Using created_date as deliverydate
                'location': row[6] or '',  # Using shippingcity as location
                'lpStatus': '',  # Not available from OrdersAssignedToDrivers
                'shippingaddress': row[7] or ''
            })
        
        print(f"🔍 Returning {len(assignments)} assignments")
        return Response(assignments)
        
    except Exception as e:
        print(f"❌ Error in dr_driver_assignments_today: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def dr_document_types(request):
    """API view to fetch document types from OrdersAssignedToDrivers using created_date."""
    try:
        from django.db.models import Count, Q
        from django.db import connection
        from collections import defaultdict
        import re
        
        timeframe = request.query_params.get('timeframe', 'today')
        filter_type = request.query_params.get('filter', 'All')
        
        # Get the date range based on timeframe
        now = timezone.now().date()
        if timeframe == 'today':
            start_date = now
            end_date = now
        elif timeframe == 'week':
            start_date = now - timedelta(days=7)
            end_date = now
        elif timeframe == 'month':
            start_date = now - timedelta(days=30)
            end_date = now
        elif timeframe == 'year':
            start_date = now - timedelta(days=365)
            end_date = now
        else:
            start_date = now
            end_date = now
        
        # Query directly from dr_orders_assigned_to_drivers using created_date
        results = []
        if timeframe == 'today':
            # First try today
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        o.documentno
                    FROM rare_dr.dr_orders_assigned_to_drivers o
                    WHERE o.created_date::date >= %s 
                    AND o.created_date::date <= %s
                    AND o.documentno IS NOT NULL 
                    AND o.documentno != ''
                """, [start_date, end_date])
                
                results = cursor.fetchall()
            
            # If no data for today, try last 7 days
            if len(results) == 0:
                print(f"🔍 No data for today ({now}), trying last 7 days...")
                start_date = now - timedelta(days=7)
                end_date = now
                # Query again with extended date range
                with connection.cursor() as cursor:
                    cursor.execute("""
                        SELECT 
                            o.documentno
                        FROM rare_dr.dr_orders_assigned_to_drivers o
                        WHERE o.created_date::date >= %s 
                        AND o.created_date::date <= %s
                        AND o.documentno IS NOT NULL 
                        AND o.documentno != ''
                    """, [start_date, end_date])
                    
                    results = cursor.fetchall()
        else:
            # For other timeframes, just query once
            with connection.cursor() as cursor:
                cursor.execute("""
                    SELECT 
                        o.documentno
                    FROM rare_dr.dr_orders_assigned_to_drivers o
                    WHERE o.created_date::date >= %s 
                    AND o.created_date::date <= %s
                    AND o.documentno IS NOT NULL 
                    AND o.documentno != ''
                """, [start_date, end_date])
                
                results = cursor.fetchall()
        
        # Extract prefixes and count document types
        prefix_counts = defaultdict(int)
        
        print(f"🔍 Processing {len(results)} document records for timeframe: {timeframe}, filter: {filter_type}")
        
        for row in results:
            documentno = row[0]
            if documentno:
                # Extract prefix using regex (same as your Python code)
                match = re.match(r'^([A-Z]+)', documentno.upper())
                if match:
                    prefix = match.group(1)
                    prefix_counts[prefix] += 1
        
        print(f"🔍 Found prefixes: {dict(prefix_counts)}")
        
        # Convert to the expected format and apply name mapping
        def get_document_type_name(prefix):
            prefix_map = {
                'IF': 'Item Fulfillment',
                'P': 'Purchase Order', 
                'PO': 'Purchase Order',
                'SO': 'Sales Order',
                'RO': 'Return Order',
                'R': 'Return Order',
                'WO': 'Work Order',
                'INV': 'Invoice',
                'EST': 'Estimate',
                'QUO': 'Quote'
            }
            return prefix_map.get(prefix.upper(), prefix)
        
        document_types = []
        for prefix, count in sorted(prefix_counts.items()):
            document_types.append({
                'name': prefix,  # Keep original prefix for backend filtering
                'count': count
            })
        
        # Apply filtering based on filter_type
        print(f"🔍 Before filtering: {len(document_types)} document types")
        print(f"🔍 Document types: {[doc['name'] for doc in document_types]}")
        
        if filter_type != 'All':
            # Map filter types to their corresponding prefixes
            filter_mapping = {
                'Item Fulfillment': ['IF'],
                'Purchase Orders': ['PO', 'P'],  # Include both PO and P prefixes
                'Return Orders': ['RO'],
                'Other': []  # Will be populated with non-matching types
            }
            
            print(f"🔍 Applying filter: {filter_type}")
            print(f"🔍 Filter mapping: {filter_mapping}")
            
            if filter_type in filter_mapping:
                if filter_type == 'Other':
                    # For "Other", show all types except the main ones
                    main_prefixes = ['IF', 'PO', 'P', 'RO']  # Include both P and PO
                    filtered_document_types = [
                        doc for doc in document_types 
                        if doc['name'] not in main_prefixes
                    ]
                    print(f"🔍 Other filter - excluding: {main_prefixes}")
                else:
                    # For specific types, show only matching prefixes
                    target_prefixes = filter_mapping[filter_type]
                    filtered_document_types = [
                        doc for doc in document_types 
                        if doc['name'] in target_prefixes
                    ]
                    print(f"🔍 Specific filter - looking for: {target_prefixes}")
                
                print(f"🔍 After filtering: {len(filtered_document_types)} document types")
                print(f"🔍 Filtered types: {[doc['name'] for doc in filtered_document_types]}")
                document_types = filtered_document_types
        
        return Response(document_types)
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def dr_dashboard_kpis(request):
    """API view to fetch DR dashboard KPIs with timeframe filtering."""
    timeframe = request.GET.get('timeframe', 'today')
    
    try:
        # 1. Total Assigned Orders - Count of orders that are assigned only
        assigned_orders_queryset = OrdersAssignedToDrivers.objects.filter(
            deliverystatus__in=['Assigned']
        )
        
        # If no exact matches, try case-insensitive search for assigned status
        if not assigned_orders_queryset.exists():
            assigned_orders_queryset = OrdersAssignedToDrivers.objects.filter(
                deliverystatus__icontains='assigned'
            )
        
        # Apply timeframe filter on created_date if it exists
        try:
            field = OrdersAssignedToDrivers._meta.get_field('created_date')
            assigned_orders_queryset = filter_by_timeframe(assigned_orders_queryset, timeframe, 'created_date')
        except FieldDoesNotExist:
            pass
        
        total_orders = assigned_orders_queryset.count()
        
        # 2. Total Return Orders - Count with timeframe filtering
        return_orders_queryset = TotalReturnOrders.objects.all()
        return_orders_queryset = filter_by_timeframe(return_orders_queryset, timeframe, 'date')
        total_return_orders = return_orders_queryset.count()
        
        # 3. Total Sales Orders - Count with timeframe filtering
        sales_orders_queryset = TotalSalesOrders.objects.all()
        # Apply timeframe filter on created_date if it exists
        try:
            # Try to get the field to check if it exists
            field = TotalSalesOrders._meta.get_field('created_date')
            # If we get here, the field exists
            sales_orders_queryset = filter_by_timeframe(sales_orders_queryset, timeframe, 'created_date')
        except FieldDoesNotExist:
            # Field doesn't exist, use all records
            pass
        total_sales_orders = sales_orders_queryset.count()
        
        # 4. Active Drivers - Count of unique drivers with active load plans
        # This includes drivers with "In Process", "Active", "Started", etc. status
        active_drivers_queryset = TotalLoadPlans.objects.filter(
            lpStatus__in=['In Process', 'Active', 'Started', 'In Progress', 'Process']
        )
        
        # If no exact matches, try case-insensitive search
        if not active_drivers_queryset.exists():
            active_drivers_queryset = TotalLoadPlans.objects.filter(
                lpStatus__icontains='process'
            )
        
        # Apply timeframe filter on deliverydate
        active_drivers_queryset = filter_by_timeframe(active_drivers_queryset, timeframe, 'deliverydate')
        active_drivers = active_drivers_queryset.values('driver').distinct().count()
        
        # 5. Top Delivered Location - Most frequent shipping city from OrdersAssignedToDrivers
        top_location_queryset = OrdersAssignedToDrivers.objects.exclude(
            shippingcity__isnull=True
        ).exclude(
            shippingcity=''
        )
        
        # Apply timeframe filter if created_date exists
        try:
            field = OrdersAssignedToDrivers._meta.get_field('created_date')
            top_location_queryset = filter_by_timeframe(top_location_queryset, timeframe, 'created_date')
        except FieldDoesNotExist:
            pass
        
        top_location_data = top_location_queryset.values('shippingcity').annotate(
            delivery_count=Count('shippingcity')
        ).order_by('-delivery_count').first()
        
        top_delivered_location = top_location_data['shippingcity'] if top_location_data else "No deliveries"
        
        kpis = [
            {"title": "Total Assigned Orders", "value": total_orders, "icon": "Package"},
            {"title": "Total Return Orders", "value": total_return_orders, "icon": "RotateCcw"},
            {"title": "Sales Orders Ship To Not Fulfilled", "value": total_sales_orders, "icon": "ShoppingCart"},
            {"title": "Active Drivers", "value": active_drivers, "icon": "Users"},
            {"title": "Top Delivered Location", "value": top_delivered_location, "icon": "MapPin"}
        ]
        
        return Response(kpis)
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)


@api_view(['GET'])
def dr_dashboard_stats(request):
    """API view to fetch DR dashboard statistics for charts."""
    timeframe = request.GET.get('timeframe', 'today')
    
    try:
        # Get base queryset for load plans
        queryset = TotalLoadPlans.objects.exclude(driver__isnull=True).exclude(driver='')
        
        # Apply timeframe filtering using the unified function
        queryset = filter_by_timeframe(queryset, timeframe, 'deliverydate')
        
        # Get driver performance data
        driver_performance = get_driver_performance(queryset)
        
        # Get load plan status data
        load_plan_status = get_load_plan_status(queryset)
        
        # Location Distribution - using all load plans (not filtered by timeframe)
        try:
            location_data = TotalLoadPlans.objects.values('location').annotate(
                count=Count('loadplan')
            ).order_by('-count')[:10]
            
            location_distribution = []
            for item in location_data:
                location_distribution.append({
                    'location': item['location'],
                    'count': item['count']
                })
        except Exception as e:
            print(f"❌ Error in location distribution calculation: {e}")
            location_distribution = []
        
        # Return Reasons - using all return orders (not filtered by timeframe)
        try:
            return_reasons_data = TotalReturnOrders.objects.values('returnNotes').annotate(
                count=Count('documentno')
            ).order_by('-count')[:10]
            
            return_reasons = []
            for item in return_reasons_data:
                if item['returnNotes']:  # Only include non-empty return notes
                    return_reasons.append({
                        'reason': item['returnNotes'],
                        'count': item['count']
                    })
        except Exception as e:
            print(f"❌ Error in return reasons calculation: {e}")
            return_reasons = []
        
        # Return the data
        return Response({
            'driver_performance': driver_performance,
            'load_plan_status': load_plan_status,
            'location_distribution': location_distribution,
            'return_reasons': return_reasons
        })
        
    except Exception as e:
        return Response({"error": str(e)}, status=500)


# ViewSets for individual data tables
class TotalReturnOrdersViewSet(ReadOnlyModelViewSet):
    """ViewSet for return orders with filtering and pagination."""
    queryset = TotalReturnOrders.objects.all()
    serializer_class = TotalReturnOrdersSerializer
    pagination_class = ModalTablePagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        customer = self.request.query_params.get('customer')
        timeframe = self.request.query_params.get('timeframe', 'today')
        date_filter = self.request.query_params.get('date')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if customer:
            queryset = queryset.filter(customer__icontains=customer)
        
        # Apply date range filter if provided
        if date_from and date_to:
            try:
                from datetime import datetime
                from_date = datetime.strptime(date_from, '%Y-%m-%d').date()
                to_date = datetime.strptime(date_to, '%Y-%m-%d').date()
                queryset = queryset.filter(date__date__range=[from_date, to_date])
            except ValueError:
                # If date format is invalid, ignore the filter
                pass
        # Apply specific date filter if provided (single date)
        elif date_filter:
            try:
                from datetime import datetime
                filter_date = datetime.strptime(date_filter, '%Y-%m-%d').date()
                queryset = queryset.filter(date__date=filter_date)
            except ValueError:
                # If date format is invalid, ignore the filter
                pass
        else:
            # Apply timeframe filtering using the unified function
            queryset = filter_by_timeframe(queryset, timeframe, 'date')
        
        return queryset


class PodUpdatedOrdersViewSet(ReadOnlyModelViewSet):
    """ViewSet for POD updated orders with filtering and pagination."""
    queryset = PodUpdatedOrders.objects.all()
    serializer_class = PodUpdatedOrdersSerializer
    pagination_class = ModalTablePagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        driver = self.request.query_params.get('driver')
        status = self.request.query_params.get('status')
        timeframe = self.request.query_params.get('timeframe', 'today')
        date_filter = self.request.query_params.get('date')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if driver:
            queryset = queryset.filter(driver__icontains=driver)
        
        if status:
            queryset = queryset.filter(deliveryStatus__icontains=status)
        
        # Apply date range filter if provided
        if date_from and date_to:
            try:
                from datetime import datetime
                from_date = datetime.strptime(date_from, '%Y-%m-%d').date()
                to_date = datetime.strptime(date_to, '%Y-%m-%d').date()
                queryset = queryset.extra(where=["DATE(\"deliveryTime\") >= %s AND DATE(\"deliveryTime\") <= %s"], 
                                        params=[from_date, to_date])
            except ValueError:
                # If date format is invalid, ignore the filter
                pass
        # Apply specific date filter if provided (single date)
        elif date_filter:
            try:
                from datetime import datetime
                filter_date = datetime.strptime(date_filter, '%Y-%m-%d').date()
                queryset = queryset.extra(where=["DATE(\"deliveryTime\") = %s"], params=[filter_date])
            except ValueError:
                # If date format is invalid, ignore the filter
                pass
        else:
            # Apply timeframe filtering using raw SQL for deliveryTime field
            from django.db import connection
            
            if timeframe == 'today':
                today = timezone.now().date()
                queryset = queryset.extra(where=["DATE(\"deliveryTime\") = %s"], params=[today])
            elif timeframe == 'week':
                start_date = timezone.now().date() - timedelta(days=7)
                end_date = timezone.now().date()
                queryset = queryset.extra(where=["DATE(\"deliveryTime\") >= %s AND DATE(\"deliveryTime\") <= %s"], 
                                        params=[start_date, end_date])
            elif timeframe == 'month':
                start_date = timezone.now().date() - timedelta(days=30)
                end_date = timezone.now().date()
                queryset = queryset.extra(where=["DATE(\"deliveryTime\") >= %s AND DATE(\"deliveryTime\") <= %s"], 
                                        params=[start_date, end_date])
            elif timeframe == 'year':
                start_date = timezone.now().date() - timedelta(days=365)
                end_date = timezone.now().date()
                queryset = queryset.extra(where=["DATE(\"deliveryTime\") >= %s AND DATE(\"deliveryTime\") <= %s"], 
                                        params=[start_date, end_date])
        
        return queryset


class OrdersPendingDeliveriesViewSet(ReadOnlyModelViewSet):
    """ViewSet for pending delivery orders with filtering and pagination."""
    queryset = OrdersPendingDeliveries.objects.all()
    serializer_class = OrdersPendingDeliveriesSerializer
    pagination_class = ModalTablePagination


class OrdersAssignedToDriversViewSet(ReadOnlyModelViewSet):
    """ViewSet for orders assigned to drivers with filtering and pagination."""
    queryset = OrdersAssignedToDrivers.objects.all()
    serializer_class = OrdersAssignedToDriversSerializer
    pagination_class = DriverAssignmentsPagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        driver = self.request.query_params.get('driver')
        timeframe = self.request.query_params.get('timeframe', 'today')
        
        if driver:
            queryset = queryset.filter(driver__icontains=driver)
        
        # Filter for active orders only (Assigned, Received) - matching KPI logic
        queryset = queryset.filter(
            deliverystatus__in=['Assigned', 'Received']
        )
        
        # If no exact matches, try case-insensitive search
        if not queryset.exists():
            queryset = OrdersAssignedToDrivers.objects.filter(
                deliverystatus__icontains='assigned'
            ) | OrdersAssignedToDrivers.objects.filter(
                deliverystatus__icontains='received'
            )
            if driver:
                queryset = queryset.filter(driver__icontains=driver)
        
        # Apply timeframe filtering by linking with TotalLoadPlans
        if timeframe and timeframe != 'year':
            # Get filtered load plans using the unified function
            load_plans_queryset = TotalLoadPlans.objects.all()
            load_plans_queryset = filter_by_timeframe(load_plans_queryset, timeframe, 'deliverydate')
            load_plan_ids = load_plans_queryset.values_list('loadplan', flat=True)
            queryset = queryset.filter(loadplan__in=load_plan_ids)
        
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


class TotalSalesOrdersViewSet(ReadOnlyModelViewSet):
    """ViewSet for total sales orders with filtering and pagination."""
    queryset = TotalSalesOrders.objects.all()
    serializer_class = TotalSalesOrdersSerializer
    pagination_class = ModalTablePagination
    
    def get_queryset(self):
        queryset = super().get_queryset()
        customer = self.request.query_params.get('customer')
        location = self.request.query_params.get('location')
        status = self.request.query_params.get('status')
        timeframe = self.request.query_params.get('timeframe', 'today')
        date_filter = self.request.query_params.get('date')
        date_from = self.request.query_params.get('date_from')
        date_to = self.request.query_params.get('date_to')
        
        if customer:
            queryset = queryset.filter(customer__icontains=customer)
        
        if location:
            queryset = queryset.filter(location__icontains=location)
        
        if status:
            queryset = queryset.filter(status__icontains=status)
        
        # Apply date range filter if provided
        if date_from and date_to:
            try:
                from datetime import datetime
                from_date = datetime.strptime(date_from, '%Y-%m-%d').date()
                to_date = datetime.strptime(date_to, '%Y-%m-%d').date()
                queryset = queryset.filter(created_date__date__range=[from_date, to_date])
            except ValueError:
                pass
        # Apply specific date filter if provided (single date)
        elif date_filter:
            try:
                from datetime import datetime
                filter_date = datetime.strptime(date_filter, '%Y-%m-%d').date()
                queryset = queryset.filter(created_date__date=filter_date)
            except ValueError:
                pass
        else:
            # Apply timeframe filtering using the unified function
            queryset = filter_by_timeframe(queryset, timeframe, 'created_date')
        
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
