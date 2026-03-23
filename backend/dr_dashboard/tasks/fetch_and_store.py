import requests
import json
from django.db import transaction
from datetime import datetime
from django.utils import timezone
from dr_dashboard.models import (
    TotalReturnOrders, 
    PodUpdatedOrders, 
    OrdersPendingDeliveries, 
    OrdersAssignedToDrivers, 
    TotalLoadPlans,
    TotalSalesOrders
)

def parse_date_string(date_str):
    """
    Parse date string from various formats to datetime object.
    Handles formats like '17/9/2025', '17/09/2025', etc.
    """
    if not date_str or date_str == '':
        return None
    
    # Convert to string if it's not already
    date_str = str(date_str).strip()
    
    # Handle timezone abbreviations by removing them
    if ' PDT' in date_str or ' PST' in date_str or ' EST' in date_str or ' CST' in date_str or ' MST' in date_str:
        # Remove timezone abbreviations
        date_str = date_str.replace(' PDT', '').replace(' PST', '').replace(' EST', '').replace(' CST', '').replace(' MST', '')
    
    # Handle 24-hour format with AM/PM (like "9/1/2025 15:37:16 pm")
    # Convert to 12-hour format by removing AM/PM and using 24-hour format
    if ' pm' in date_str or ' am' in date_str:
        # Remove AM/PM for 24-hour parsing
        date_str_24h = date_str.replace(' pm', '').replace(' am', '')
        try:
            parsed_date = datetime.strptime(date_str_24h, '%m/%d/%Y %H:%M:%S')
            parsed_date = timezone.make_aware(parsed_date)
            print(f"Parsed '{date_str}' as 24-hour format: {parsed_date}")
            return parsed_date
        except ValueError:
            pass  # Continue to other formats
    
    # Try various date formats in order of likelihood
    formats_to_try = [
        '%Y-%m-%d %H:%M:%S',        # 2025-09-02 21:21:43 (timestamp without timezone)
        '%Y-%m-%d',                 # 2025-09-02
        '%B %d, %Y %I:%M:%S %p',     # September 2, 2025 9:21:43 PM
        '%B %d, %Y',                 # September 2, 2025
        '%d/%m/%Y',                  # 1/9/2025
        '%m/%d/%Y',                  # 9/1/2025
    ]
    
    for fmt in formats_to_try:
        try:
            parsed_date = datetime.strptime(date_str, fmt)
            parsed_date = timezone.make_aware(parsed_date)
            print(f"Parsed '{date_str}' as {fmt}: {parsed_date}")
            return parsed_date
        except ValueError:
            continue
    
    # If all formats fail, use current time
    print(f"Warning: Could not parse date '{date_str}', using current time")
    return timezone.now()

def fetch_and_store_dr_data():
    """
    Fetch data from NetSuite API and store in DR dashboard models.
    """
    try:
        # NetSuite API URL
        url = "https://4043665.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=1114&deploy=1&compid=4043665&ns-at=AAEJ7tMQAhgVooaRoC21gd9UBbp-vPT2i6E1qvLSpEfAKQa_4jE"
        
        # Fetch data from API
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        # Debug: Print sample data to understand the format
        print("=== DR Dashboard API Data Sample ===")
        if 'totalReturnOrders' in data and data['totalReturnOrders']:
            sample_order = data['totalReturnOrders'][0]
            print(f"Sample TotalReturnOrders date: '{sample_order.get('date', 'N/A')}'")
        if 'podUpdatedOrders' in data and data['podUpdatedOrders']:
            sample_pod = data['podUpdatedOrders'][0]
            print(f"Sample PodUpdatedOrders transactionDate: '{sample_pod.get('transactionDate', 'N/A')}'")
        if 'totalLoadPlans' in data and data['totalLoadPlans']:
            sample_load = data['totalLoadPlans'][0]
            print(f"Sample TotalLoadPlans deliverydate: '{sample_load.get('deliverydate', 'N/A')}'")
        if 'ordersAssignedToDrivers' in data and data['ordersAssignedToDrivers']:
            sample_assigned = data['ordersAssignedToDrivers'][0]
            print(f"Sample OrdersAssignedToDrivers fields: {list(sample_assigned.keys())}")
            print(f"Sample OrdersAssignedToDrivers data: {sample_assigned}")
        if 'totalSalesOrders' in data and data['totalSalesOrders']:
            sample_sales = data['totalSalesOrders'][0] if isinstance(data['totalSalesOrders'], list) else data['totalSalesOrders']
            if isinstance(sample_sales, dict):
                print(f"Sample TotalSalesOrders fields: {list(sample_sales.keys())}")
                print(f"Sample TotalSalesOrders data: {sample_sales}")
        print("=====================================")
        
        # Store data in database
        with transaction.atomic():
            # Store Total Return Orders
            if 'totalReturnOrders' in data:
                for order_data in data['totalReturnOrders']:
                    # Skip records without documentno
                    if 'documentno' not in order_data or not order_data['documentno']:
                        print(f"Skipping TotalReturnOrders record without documentno: {order_data}")
                        continue
                        
                    # Parse the date with debug logging
                    raw_date = order_data.get('date', '')
                    parsed_date = parse_date_string(raw_date)
                    print(f"Raw TotalReturnOrders date: '{raw_date}' -> Parsed: {parsed_date}")
                    
                    # Skip if date parsing failed
                    if parsed_date is None:
                        print(f"⚠️ Skipping TotalReturnOrders record due to invalid date: {raw_date}")
                        continue
                    
                    TotalReturnOrders.objects.update_or_create(
                        documentno=order_data['documentno'],
                        defaults={
                            'transaction': order_data.get('transaction', ''),
                            'documentText': order_data.get('documentText', ''),  # New field
                            'vendor': order_data.get('vendor', ''),
                            'customer': order_data.get('customer', ''),
                            'date': parsed_date,
                            'createdFrom': order_data.get('createdFrom', ''),
                            'location': order_data.get('location', ''),
                            'returnNotes': order_data.get('returnNotes', ''),
                        }
                    )
            
            # Store POD Updated Orders
            if 'podUpdatedOrders' in data:
                for order_data in data['podUpdatedOrders']:
                    # Skip records without documentno
                    if 'documentno' not in order_data or not order_data['documentno']:
                        print(f"Skipping PodUpdatedOrders record without documentno: {order_data}")
                        continue
                        
                    # Parse the transactionDate with debug logging
                    raw_date = order_data.get('transactionDate', '')
                    parsed_date = parse_date_string(raw_date)
                    print(f"Raw transactionDate: '{raw_date}' -> Parsed: {parsed_date}")
                    
                    # Parse the deliveryTime with debug logging
                    raw_delivery_time = order_data.get('deliveryTime', '')
                    parsed_delivery_time = parse_date_string(raw_delivery_time)
                    print(f"Raw deliveryTime: '{raw_delivery_time}' -> Parsed: {parsed_delivery_time}")
                    
                    # Skip if either date parsing failed
                    if parsed_date is None:
                        print(f"⚠️ Skipping PodUpdatedOrders record due to invalid transactionDate: {raw_date}")
                        continue
                    
                    if parsed_delivery_time is None:
                        print(f"⚠️ Skipping PodUpdatedOrders record due to invalid deliveryTime: {raw_delivery_time}")
                        continue
                    
                    PodUpdatedOrders.objects.update_or_create(
                        documentno=order_data['documentno'],
                        defaults={
                            'loadplan': order_data.get('loadplan', ''),
                            'deliveredBy': order_data.get('deliveredBy', ''),
                            'driver': order_data.get('driver', ''),  # New field
                            'driverId': order_data.get('driverId', ''),  # New field
                            'transactionDate': parsed_date,
                            'deliveryStatus': order_data.get('deliveryStatus', ''),
                            'deliveryTime': parsed_delivery_time,  # Store parsed deliveryTime
                            'signature': order_data.get('signature', ''),
                            'pod1': order_data.get('pod1', ''),
                            'pod2': order_data.get('pod2', ''),
                        }
                    )
            
            # Store Orders Pending Deliveries
            if 'ordersPendingDeliveries' in data:
                for order_data in data['ordersPendingDeliveries']:
                    # Skip records without documentno
                    if 'documentno' not in order_data or not order_data['documentno']:
                        print(f"Skipping OrdersPendingDeliveries record without documentno: {order_data}")
                        continue
                        
                    OrdersPendingDeliveries.objects.update_or_create(
                        documentno=order_data['documentno'],
                        defaults={
                            'status': order_data.get('status', 'Pending'),
                        }
                    )
            
            # Store Orders Assigned to Drivers
            if 'ordersAssignedToDrivers' in data:
                for order_data in data['ordersAssignedToDrivers']:
                    # Skip records without documentno
                    if 'documentno' not in order_data or not order_data['documentno']:
                        print(f"Skipping OrdersAssignedToDrivers record without documentno: {order_data}")
                        continue
                    
                    # Parse created_date from API - check multiple spellings
                    created_date_value = None
                    # Try different spellings of the date field
                    date_field_candidates = ['creataed_date', 'created_date', 'createDate', 'createdDate']
                    
                    for field_name in date_field_candidates:
                        if field_name in order_data and order_data[field_name]:
                            raw_date = order_data[field_name]
                            created_date_value = parse_date_string(str(raw_date))
                            if created_date_value:
                                print(f"Found ordersAssignedToDrivers date from field '{field_name}': '{raw_date}' -> {created_date_value}")
                                break
                    
                    if not created_date_value:
                        print(f"⚠️ No date field found in order_data. Available fields: {list(order_data.keys())}")
                    update_data = {
                        'driver': order_data.get('driver', ''),
                        'deliverystatus': order_data.get('deliveryStatus', ''),
                        'customer_or_supplier': order_data.get('customer_or_supplier', ''),
                        'createdFrom': order_data.get('createdFrom', ''),
                        'loadplan': order_data.get('loadplan', ''),
                        'shippingcity': order_data.get('shippingCity', ''),
                        'billingcity': order_data.get('billingCity', ''),
                        'shippingaddress': order_data.get('shippingAddress', ''),
                    }
                    
                    # Only add created_date if we parsed it successfully
                    if created_date_value:
                        update_data['created_date'] = created_date_value
                    
                    OrdersAssignedToDrivers.objects.update_or_create(
                        documentno=order_data['documentno'],
                        defaults=update_data
                    )
            
            # Store Total Load Plans
            if 'totalLoadPlans' in data:
                for plan_data in data['totalLoadPlans']:
                    # Skip records without loadplan
                    if 'loadplan' not in plan_data or not plan_data['loadplan']:
                        print(f"Skipping TotalLoadPlans record without loadplan: {plan_data}")
                        continue
                        
                    # Parse the deliverydate with debug logging
                    raw_date = plan_data.get('deliverydate', '')
                    parsed_date = parse_date_string(raw_date)
                    print(f"Raw TotalLoadPlans deliverydate: '{raw_date}' -> Parsed: {parsed_date}")
                    
                    # Skip if date parsing failed
                    if parsed_date is None:
                        print(f"⚠️ Skipping TotalLoadPlans record due to invalid date: {raw_date}")
                        continue
                    
                    TotalLoadPlans.objects.update_or_create(
                        loadplan=plan_data['loadplan'],
                        defaults={
                            'deliverydate': parsed_date,
                            'location': plan_data.get('location', ''),
                            'driver': plan_data.get('driver', ''),
                            'driverid': plan_data.get('driverId', ''),  # New field
                            'noOfOrders': plan_data.get('noOfOrders', ''),
                            'warehouse': plan_data.get('warehouse', ''),
                            'totalStops': plan_data.get('totalStops', ''),
                            'lpStatus': plan_data.get('lpStatus', ''),
                            'truckType': plan_data.get('truckType', ''),
                            'truckWeight': plan_data.get('truckWeight', ''),
                            'totalLpWeight': plan_data.get('totalLpWeight', ''),
                        }
                    )
            
            # Store Total Sales Orders (detailed records)
            if 'totalSalesOrders' in data and data['totalSalesOrders'] is not None:
                sales_orders_data = data['totalSalesOrders']
                
                # Check if it's an array of objects
                if isinstance(sales_orders_data, list):
                    for sales_order in sales_orders_data:
                        # Skip records without documentno
                        if not isinstance(sales_order, dict) or 'documentno' not in sales_order or not sales_order['documentno']:
                            print(f"Skipping TotalSalesOrders record without documentno: {sales_order}")
                            continue
                        
                        # Parse created_date from API - check multiple spellings
                        created_date_value = None
                        # Try different spellings of the date field
                        date_field_candidates = ['creataed_date', 'created_date', 'createDate', 'createdDate']
                        
                        for field_name in date_field_candidates:
                            if field_name in sales_order and sales_order[field_name]:
                                raw_date = sales_order[field_name]
                                created_date_value = parse_date_string(str(raw_date))
                                if created_date_value:
                                    print(f"Found TotalSalesOrders date from field '{field_name}': '{raw_date}' -> {created_date_value}")
                                    break
                        
                        if not created_date_value:
                            print(f"⚠️ No date field found in sales_order. Available fields: {list(sales_order.keys())}")
                        
                        # Only add created_date if we parsed it successfully
                        update_data = {
                            'customer': sales_order.get('customer', ''),
                            'location': sales_order.get('location', ''),
                            'status': sales_order.get('status', ''),
                            'shippingAddress': sales_order.get('shippingAddress', ''),
                        }
                        
                        if created_date_value:
                            update_data['created_date'] = created_date_value
                        
                        TotalSalesOrders.objects.update_or_create(
                            documentno=sales_order['documentno'],
                            defaults=update_data
                        )
                    print(f"Stored {len([so for so in sales_orders_data if isinstance(so, dict) and so.get('documentno')])} Total Sales Orders")
                else:
                    print(f"totalSalesOrders data is not in expected array format: {type(sales_orders_data)}")
            else:
                print("No totalSalesOrders data found in API response")
        
        print("DR Dashboard data fetched and stored successfully!")
        return True
        
    except Exception as e:
        print(f"Error fetching DR dashboard data: {str(e)}")
        return False

def test_fetch_dr_data():
    """
    Test function to fetch and display DR data without storing.
    """
    try:
        url = "https://4043665.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=1114&deploy=1&compid=4043665&ns-at=AAEJ7tMQAhgVooaRoC21gd9UBbp-vPT2i6E1qvLSpEfAKQa_4jE"
        
        response = requests.get(url, timeout=30)
        response.raise_for_status()
        
        data = response.json()
        
        print("DR Dashboard API Response:")
        print(f"Total Return Orders: {len(data.get('totalReturnOrders', []))}")
        print(f"POD Updated Orders: {len(data.get('podUpdatedOrders', []))}")
        print(f"Orders Pending Deliveries: {len(data.get('ordersPendingDeliveries', []))}")
        print(f"Orders Assigned to Drivers: {len(data.get('ordersAssignedToDrivers', []))}")
        print(f"Total Load Plans: {len(data.get('totalLoadPlans', []))}")
        print(f"Total Sales Orders: {data.get('totalSalesOrders', 'N/A')}")
        
        return data
        
    except Exception as e:
        print(f"Error testing DR dashboard data: {str(e)}")
        return None
