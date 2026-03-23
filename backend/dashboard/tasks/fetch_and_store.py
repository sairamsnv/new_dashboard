import requests
import pandas as pd
import logging
from datetime import datetime, timezone
from django.db import transaction
from django.utils import timezone as django_timezone
from django.core.exceptions import ValidationError
from django.db.models import Count
import hashlib
import json
import base64

from dashboard.models import (
    Supplier, Customer, OpenPurchaseOrder,
    OpenSalesOrder, PackedOrPickedOrder, TotalOrdersReceived,
    PendingApprovalInventoryAdjustments, ReOrderItems,
    InventoryAdjustmentData, InventoryAdjustmentItems,
    InventoryCountData, InventoryCountItems,
    PendingApprovalInventoryCounts, PendingApprovalInventoryCountItems,
    TransactionsCreatedByWMS, EmployeeDetails, ItemsFromFulfillments,
    ItemsFromReceipts
)

def cleanup_duplicate_records():
    """Clean up duplicate records in the database."""
    try:
        # Find and remove duplicate PackedOrPickedOrder records
        duplicates = PackedOrPickedOrder.objects.values('documentNumber').annotate(
            count=Count('id')
        ).filter(count__gt=1)
        
        for duplicate in duplicates:
            doc_number = duplicate['documentNumber']
            # Keep the first record, delete the rest
            records = PackedOrPickedOrder.objects.filter(documentNumber=doc_number).order_by('id')
            first_record = records.first()
            if first_record:
                records.exclude(id=first_record.id).delete()
                logging.info(f"Cleaned up {duplicate['count'] - 1} duplicate records for documentNumber: {doc_number}")
        
        logging.info("Duplicate cleanup completed successfully!")
        
    except Exception as e:
        logging.error(f"Error during duplicate cleanup: {e}")

def generate_data_hash(data_dict):
    """Generate a hash for data comparison to detect changes."""
    # Create a stable string representation for hashing
    data_str = json.dumps(data_dict, sort_keys=True, default=str)
    return hashlib.md5(data_str.encode()).hexdigest()

def fetch_and_store_data():
    """
    Fetch from API, clean, and upsert into Postgres through ORM.
    Only processes new or changed data for efficiency.
    """
    # Clean up duplicates first
    cleanup_duplicate_records()
    
    url = "https://4043665.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=983&deploy=1&compid=4043665&ns-at=AAEJ7tMQEb6IEwLyDMBsBOTFkCPaodCwGSGA3_jxyVft-vOfTLo"
    
    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        logging.error(f"API fetch failed: {e}")
        return

    try:
        data = response.json()
    except ValueError as e:
        logging.error(f"Invalid JSON response: {e}")
        return

    def clean_dataframe(items):
        """Clean data - keep all valid data, only remove completely empty rows."""
        df = pd.DataFrame(items)
        if df.empty:
            return df
        df = df.copy()
        
        # Only remove rows where ALL fields are null/empty
        df = df.dropna(how='all')
        
        # Remove rows where key identifier is missing
        if 'documentNumber' in df.columns:
            df = df.dropna(subset=['documentNumber'])
        if 'tranId' in df.columns:
            df = df.dropna(subset=['tranId'])
        
        # Log what we're keeping
        logging.info(f"DataFrame shape after cleaning: {df.shape}")
        return df

    def parse_date(date_str, format_str='%d/%m/%Y'):
        """Safely parse date strings with Django timezone support."""
        if not date_str or pd.isna(date_str):
            return None
            
        try:
            # Try the main format first
            parsed_date = datetime.strptime(str(date_str).strip(), format_str)
            return django_timezone.make_aware(parsed_date, timezone=timezone.utc)
        except (ValueError, TypeError):
            try:
                # Try alternative format if main fails
                parsed_date = datetime.strptime(str(date_str).strip(), '%Y-%m-%d')
                return django_timezone.make_aware(parsed_date, timezone=timezone.utc)
            except (ValueError, TypeError):
                logging.warning(f"Could not parse date: {date_str}")
                return None

    def parse_datetime(datetime_str, format_str='%d/%m/%Y %I:%M %p'):
        """Safely parse datetime strings with Django timezone support."""
        if not datetime_str or pd.isna(datetime_str):
            return None
            
        try:
            # Try the main format first
            parsed_datetime = datetime.strptime(str(datetime_str).strip(), format_str)
            return django_timezone.make_aware(parsed_datetime, timezone=timezone.utc)
        except (ValueError, TypeError):
            # Try alternative formats
            alternative_formats = [
                '%Y-%m-%d %H:%M:%S',
                '%Y-%m-%d %H:%M',
                '%d/%m/%Y %H:%M:%S',
                '%d/%m/%Y %H:%M',
                '%Y-%m-%d',
                '%d/%m/%Y'
            ]
            
            for alt_format in alternative_formats:
                try:
                    parsed_datetime = datetime.strptime(str(datetime_str).strip(), alt_format)
                    logging.info(f"Parsed datetime '{datetime_str}' using alternative format '{alt_format}'")
                    return django_timezone.make_aware(parsed_datetime, timezone=timezone.utc)
                except (ValueError, TypeError):
                    continue
            
            logging.warning(f"Could not parse datetime: {datetime_str}")
            return None

    # Track suppliers and customers for later population
    suppliers = set()
    customers = set()
    
    # Statistics tracking
    stats = {
        'new_records': 0,
        'updated_records': 0,
        'unchanged_records': 0,
        'skipped_records': 0
    }

    # Use Django transaction for data consistency
    with transaction.atomic():
        for key in ['openPurchaseOrders', 'openSalesOrder', 'packedOrPickedIFDetails', 'totalOrdersReceived', 'pendingApprovalInventoryAdjustments', 'reOrderItems', 'invAdjData', 'invCountData', 'pendingApprovalInvCounts', 'transactionsCreatedByWMS', 'employeeDetails', 'itemsFromFulfillments', 'itemsFromReceipts']:
            if key not in data:
                logging.error(f"{key} not present in API.")
                continue

            # Skip dataframe cleaning for nested dictionary structures
            if key in ['invAdjData', 'invCountData', 'pendingApprovalInvCounts', 'transactionsCreatedByWMS']:
                logging.info(f"Processing {key} as nested dictionary structure")
                # Process directly without dataframe - will be handled in elif blocks below
                df = None  # Set df to None for nested structures
            else:
                df = clean_dataframe(data[key])
                logging.info(f"Raw data for {key}: {len(data[key])} records, after cleaning: {len(df)} records")

            # Skip empty check for nested structures (they don't use dataframes)
            if df is not None and df.empty:
                logging.info(f"No {key} to process.")
                continue

            if key == 'openPurchaseOrders':
                # Get existing records for comparison
                existing_records = {
                    obj.tranId: obj for obj in OpenPurchaseOrder.objects.all()
                }
                
                new_objects = []
                updated_count = 0
                unchanged_count = 0
                processed_tran_ids = set()  # Track tranIds processed in this batch to avoid duplicates
                
                for _, row in df.iterrows():
                    tran_id = row.get("tranId")
                    
                    # Skip if tranId is missing or invalid (like "Memorized" which is not a valid transaction ID)
                    if not tran_id or pd.isna(tran_id) or str(tran_id).strip().lower() in ['memorized', 'none', '']:
                        logging.warning(f"Skipping record with invalid tranId: {tran_id}")
                        stats['skipped_records'] += 1
                        continue
                    
                    # Skip if we've already processed this tranId in this batch
                    if tran_id in processed_tran_ids:
                        logging.warning(f"Skipping duplicate tranId in batch: {tran_id}")
                        stats['skipped_records'] += 1
                        continue
                    
                    processed_tran_ids.add(tran_id)
                    
                    # Track supplier
                    if pd.notna(row.get('vendor')):
                        suppliers.add(str(row['vendor']).strip())
                    
                    # Parse date safely
                    tran_date = parse_date(row.get('tranDate'))
                    if not tran_date:
                        logging.warning(f"Skipping record {tran_id}: Could not parse tranDate: {row.get('tranDate')}")
                        stats['skipped_records'] += 1
                        continue
                    
                    # Prepare data for comparison
                    current_data = {
                        'createdFrom': row.get('createdFrom'),
                        'location': row.get('location'),
                        'vendor': row.get('vendor'),
                        'tranDate': tran_date,
                        'memo': row.get('memo', '')
                    }
                    
                    # Check if record exists
                    if tran_id in existing_records:
                        existing_obj = existing_records[tran_id]
                        
                        # Generate hash for comparison
                        existing_hash = generate_data_hash({
                            'createdFrom': existing_obj.createdFrom,
                            'location': existing_obj.location,
                            'vendor': existing_obj.vendor,
                            'tranDate': existing_obj.tranDate,
                            'memo': existing_obj.memo or ''
                        })
                        
                        new_hash = generate_data_hash(current_data)
                        
                        if existing_hash != new_hash:
                            # Data has changed, update the record
                            for field, value in current_data.items():
                                setattr(existing_obj, field, value)
                            existing_obj.save()
                            updated_count += 1
                        else:
                            unchanged_count += 1
                    else:
                        # New record
                        new_objects.append(OpenPurchaseOrder(
                            tranId=tran_id,
                            **current_data
                        ))
                
                # Bulk create new records with ignore_conflicts to handle race conditions
                if new_objects:
                    try:
                        OpenPurchaseOrder.objects.bulk_create(new_objects, ignore_conflicts=True)
                        stats['new_records'] += len(new_objects)
                    except Exception as e:
                        logging.error(f"Error bulk creating OpenPurchaseOrders: {e}")
                        # Fallback: create one by one to identify problematic records
                        for obj in new_objects:
                            try:
                                obj.save()
                                stats['new_records'] += 1
                            except Exception as e2:
                                logging.error(f"Error creating OpenPurchaseOrder with tranId={obj.tranId}: {e2}")
                                stats['skipped_records'] += 1
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"OpenPurchaseOrders: {len(new_objects)} new, {updated_count} updated, {unchanged_count} unchanged.")

            elif key == 'openSalesOrder':
                # Get existing records for comparison
                existing_records = {
                    obj.tranId: obj for obj in OpenSalesOrder.objects.all()
                }
                
                new_objects = []
                updated_count = 0
                unchanged_count = 0
                processed_tran_ids = set()  # Track tranIds processed in this batch to avoid duplicates
                
                for _, row in df.iterrows():
                    tran_id = row.get("tranId")
                    
                    # Skip if tranId is missing or invalid
                    if not tran_id or pd.isna(tran_id) or str(tran_id).strip().lower() in ['memorized', 'none', '']:
                        logging.warning(f"Skipping record with invalid tranId: {tran_id}")
                        stats['skipped_records'] += 1
                        continue
                    
                    # Skip if we've already processed this tranId in this batch
                    if tran_id in processed_tran_ids:
                        logging.warning(f"Skipping duplicate tranId in batch: {tran_id}")
                        stats['skipped_records'] += 1
                        continue
                    
                    processed_tran_ids.add(tran_id)
                    
                    # Track customer
                    if pd.notna(row.get('customer')):
                        customers.add(str(row['customer']).strip())
                    
                    # Parse dates safely
                    date_created = parse_date(row.get('dateCreated'))
                    ship_date = parse_date(row.get('shipDate'))
                    if not date_created:
                        logging.warning(f"Skipping record {tran_id}: Could not parse dateCreated: {row.get('dateCreated')}")
                        stats['skipped_records'] += 1
                        continue
                    if not ship_date:
                        logging.warning(f"Skipping record {tran_id}: Could not parse shipDate: {row.get('shipDate')}")
                        stats['skipped_records'] += 1
                        continue
                    
                    # Prepare data for comparison
                    current_data = {
                        'location': row.get('location'),
                        'customer': row.get('customer'),
                        'dateCreated': date_created,
                        'shipDate': ship_date,
                        'memo': row.get('memo', ''),
                        'shipMethod': row.get('shipMethod')
                    }
                    
                    # Check if record exists
                    if tran_id in existing_records:
                        existing_obj = existing_records[tran_id]
                        
                        # Generate hash for comparison
                        existing_hash = generate_data_hash({
                            'location': existing_obj.location,
                            'customer': existing_obj.customer,
                            'dateCreated': existing_obj.dateCreated,
                            'shipDate': existing_obj.shipDate,
                            'memo': existing_obj.memo or '',
                            'shipMethod': existing_obj.shipMethod
                        })
                        
                        new_hash = generate_data_hash(current_data)
                        
                        if existing_hash != new_hash:
                            # Data has changed, update the record
                            for field, value in current_data.items():
                                setattr(existing_obj, field, value)
                            existing_obj.save()
                            updated_count += 1
                        else:
                            unchanged_count += 1
                    else:
                        # New record
                        new_objects.append(OpenSalesOrder(
                            tranId=tran_id,
                            **current_data
                        ))
                
                # Bulk create new records with ignore_conflicts to handle race conditions
                if new_objects:
                    try:
                        OpenSalesOrder.objects.bulk_create(new_objects, ignore_conflicts=True)
                        stats['new_records'] += len(new_objects)
                    except Exception as e:
                        logging.error(f"Error bulk creating OpenSalesOrders: {e}")
                        # Fallback: create one by one to identify problematic records
                        for obj in new_objects:
                            try:
                                obj.save()
                                stats['new_records'] += 1
                            except Exception as e2:
                                logging.error(f"Error creating OpenSalesOrder with tranId={obj.tranId}: {e2}")
                                stats['skipped_records'] += 1
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"OpenSalesOrder: {len(new_objects)} new, {updated_count} updated, {unchanged_count} unchanged.")

            elif key == 'packedOrPickedIFDetails':
                # Get existing records for comparison
                existing_records = {
                    obj.documentNumber: obj for obj in PackedOrPickedOrder.objects.all()
                }
                
                logging.info(f"Processing {len(df)} packed/picked order records")
                logging.info(f"Found {len(existing_records)} existing records in database")
                
                new_objects = []
                updated_count = 0
                unchanged_count = 0
                
                for _, row in df.iterrows():
                    doc_number = row.get('documentNumber')
                    
                    # Skip if documentNumber is missing
                    if not doc_number or pd.isna(doc_number):
                        logging.warning(f"Skipping record: documentNumber is missing")
                        stats['skipped_records'] += 1
                        continue
                    
                    # Track customer
                    if pd.notna(row.get('customer')):
                        customers.add(str(row['customer']).strip())
                    
                    # Clean picker/packer values
                    picker = row.get('picker')
                    packer = row.get('packer')
                    
                    # Convert "- None -" to None
                    if picker == "- None -" or picker == "":
                        picker = None
                    if packer == "- None -" or packer == "":
                        packer = None
                    
                    # Parse dates safely
                    ship_date = parse_date(row.get('shipDate'))
                    date_created = parse_datetime(row.get('dateCreated'))
                    if not ship_date:
                        logging.warning(f"Skipping record {doc_number}: Could not parse shipDate: {row.get('shipDate')}")
                        stats['skipped_records'] += 1
                        continue
                    if not date_created:
                        logging.warning(f"Skipping record {doc_number}: Could not parse dateCreated: {row.get('dateCreated')}")
                        stats['skipped_records'] += 1
                        continue
                    
                    # Prepare data for comparison
                    current_data = {
                        'createdFrom': row.get('createdFrom'),
                        'customer': row.get('customer'),
                        'packer': packer,
                        'picker': picker,
                        'location': row.get('location'),
                        'shipDate': ship_date,
                        'dateCreated': date_created,
                        'packedTime': row.get('packedTime')
                    }
                    
                    # Check if record exists
                    if doc_number in existing_records:
                        existing_obj = existing_records[doc_number]
                        
                        # Generate hash for comparison
                        existing_hash = generate_data_hash({
                            'createdFrom': existing_obj.createdFrom,
                            'customer': existing_obj.customer,
                            'packer': existing_obj.packer,
                            'picker': existing_obj.picker,
                            'location': existing_obj.location,
                            'shipDate': existing_obj.shipDate,
                            'dateCreated': existing_obj.dateCreated,
                            'packedTime': existing_obj.packedTime
                        })
                        
                        new_hash = generate_data_hash(current_data)
                        
                        if existing_hash != new_hash:
                            # Data has changed, update the record
                            for field, value in current_data.items():
                                setattr(existing_obj, field, value)
                            existing_obj.save()
                            updated_count += 1
                        else:
                            unchanged_count += 1
                    else:
                        # New record
                        new_objects.append(PackedOrPickedOrder(
                            documentNumber=doc_number,
                            **current_data
                        ))
                
                # Bulk create new records
                if new_objects:
                    PackedOrPickedOrder.objects.bulk_create(new_objects)
                    stats['new_records'] += len(new_objects)
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"PackedOrPickedOrder: {len(new_objects)} new, {updated_count} updated, {unchanged_count} unchanged, {stats['skipped_records']} skipped")
                
                # Debug: Show sample of what was processed
                if len(df) > 0:
                    sample_row = df.iloc[0]
                    logging.info(f"Sample row data: documentNumber={sample_row.get('documentNumber')}, picker={sample_row.get('picker')}, packer={sample_row.get('packer')}")

            elif key == 'totalOrdersReceived':
                # Get existing records for comparison
                existing_records = {
                    obj.tranId: obj for obj in TotalOrdersReceived.objects.all()
                }
                
                logging.info(f"Processing totalOrdersReceived: {len(df)} records from API, {len(existing_records)} existing in database")
                
                # Debug: Show column names and sample data
                if len(df) > 0:
                    logging.info(f"totalOrdersReceived columns: {list(df.columns)}")
                    sample_row = df.iloc[0]
                    logging.info(f"Sample row - tranId: {sample_row.get('tranId')}, createdDate: {sample_row.get('createdDate')}, supplier: {sample_row.get('supplier')}")
                
                new_objects = []
                updated_count = 0
                unchanged_count = 0
                processed_tran_ids = set()  # Track tranIds processed in this batch to avoid duplicates
                
                for _, row in df.iterrows():
                    tran_id = row.get('tranId')
                    
                    # Skip if tranId is missing or invalid
                    if not tran_id or pd.isna(tran_id) or str(tran_id).strip().lower() in ['memorized', 'none', '']:
                        logging.warning(f"Skipping record with invalid tranId: {tran_id}")
                        stats['skipped_records'] += 1
                        continue
                    
                    # Skip if we've already processed this tranId in this batch
                    if tran_id in processed_tran_ids:
                        logging.warning(f"Skipping duplicate tranId in batch: {tran_id}")
                        stats['skipped_records'] += 1
                        continue
                    
                    processed_tran_ids.add(tran_id)
                    
                    # Track supplier
                    if pd.notna(row.get('supplier')):
                        suppliers.add(str(row['supplier']).strip())
                    
                    # Clean receivedBy value
                    received_by = row.get('receivedBy')
                    if received_by == "- None -" or received_by == "":
                        received_by = None
                    
                    # Parse date safely
                    created_date = parse_date(row.get('createdDate'))
                    if not created_date:
                        logging.warning(f"Skipping record {tran_id}: Could not parse createdDate: {row.get('createdDate')}")
                        stats['skipped_records'] += 1
                        continue
                    
                    # Parse purchaseCreated date (optional field)
                    purchase_created = parse_date(row.get('purchaseCreated'))
                    # If purchaseCreated is not provided or can't be parsed, it will be None (allowed)
                    
                    # Prepare data for comparison
                    current_data = {
                        'supplier': row.get('supplier'),
                        'createdFrom': row.get('createdFrom'),
                        'createdDate': created_date,
                        'receivedBy': received_by,
                        'location': row.get('location'),
                        'purchaseCreated': purchase_created
                    }
                    
                    # Check if record exists
                    if tran_id in existing_records:
                        existing_obj = existing_records[tran_id]
                        
                        # Generate hash for comparison
                        existing_hash = generate_data_hash({
                            'supplier': existing_obj.supplier,
                            'createdFrom': existing_obj.createdFrom,
                            'createdDate': existing_obj.createdDate,
                            'receivedBy': existing_obj.receivedBy,
                            'location': existing_obj.location,
                            'purchaseCreated': existing_obj.purchaseCreated
                        })
                        
                        new_hash = generate_data_hash(current_data)
                        
                        if existing_hash != new_hash:
                            # Data has changed, update the record
                            for field, value in current_data.items():
                                setattr(existing_obj, field, value)
                            existing_obj.save()
                            updated_count += 1
                        else:
                            unchanged_count += 1
                    else:
                        # New record
                        new_objects.append(TotalOrdersReceived(
                            tranId=tran_id,
                            **current_data
                        ))
                
                # Bulk create new records with ignore_conflicts to handle race conditions
                if new_objects:
                    try:
                        TotalOrdersReceived.objects.bulk_create(new_objects, ignore_conflicts=True)
                        stats['new_records'] += len(new_objects)
                    except Exception as e:
                        logging.error(f"Error bulk creating TotalOrdersReceived: {e}")
                        # Fallback: create one by one to identify problematic records
                        for obj in new_objects:
                            try:
                                obj.save()
                                stats['new_records'] += 1
                            except Exception as e2:
                                logging.error(f"Error creating TotalOrdersReceived with tranId={obj.tranId}: {e2}")
                                stats['skipped_records'] += 1
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"TotalOrdersReceived: {len(new_objects)} new, {updated_count} updated, {unchanged_count} unchanged.")

            elif key == 'pendingApprovalInventoryAdjustments':
                # Get existing records for comparison
                # Since there's no unique identifier, we'll use a combination of fields or clear and recreate
                # For now, we'll clear existing records and recreate (you can modify this logic if needed)
                existing_records = {
                    (obj.location, obj.account, obj.createdBy, str(obj.dateCreated)): obj 
                    for obj in PendingApprovalInventoryAdjustments.objects.all()
                }
                
                new_objects = []
                updated_count = 0
                unchanged_count = 0
                
                for _, row in df.iterrows():
                    # Parse date safely
                    date_created = parse_datetime(row.get('dateCreated'))
                    # dateCreated is optional, so we won't skip if it's missing
                    
                    # Create a composite key for comparison
                    composite_key = (
                        str(row.get('location', '')),
                        str(row.get('account', '')),
                        str(row.get('createdBy', '')),
                        str(date_created) if date_created else ''
                    )
                    
                    # Prepare data
                    current_data = {
                        'location': row.get('location'),
                        'account': row.get('account'),
                        'createdBy': row.get('createdBy'),
                        'status': row.get('status'),
                        'dateCreated': date_created
                    }
                    
                    # Check if record exists
                    if composite_key in existing_records:
                        existing_obj = existing_records[composite_key]
                        
                        # Generate hash for comparison
                        existing_hash = generate_data_hash({
                            'location': existing_obj.location,
                            'account': existing_obj.account,
                            'createdBy': existing_obj.createdBy,
                            'status': existing_obj.status,
                            'dateCreated': existing_obj.dateCreated
                        })
                        
                        new_hash = generate_data_hash(current_data)
                        
                        if existing_hash != new_hash:
                            # Data has changed, update the record
                            for field, value in current_data.items():
                                setattr(existing_obj, field, value)
                            existing_obj.save()
                            updated_count += 1
                        else:
                            unchanged_count += 1
                    else:
                        # New record
                        new_objects.append(PendingApprovalInventoryAdjustments(
                            **current_data
                        ))
                
                # Bulk create new records
                if new_objects:
                    PendingApprovalInventoryAdjustments.objects.bulk_create(new_objects)
                    stats['new_records'] += len(new_objects)
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"PendingApprovalInventoryAdjustments: {len(new_objects)} new, {updated_count} updated, {unchanged_count} unchanged.")

            elif key == 'reOrderItems':
                # Get existing records for comparison
                # Use itemName as unique identifier
                existing_records = {
                    obj.itemName: obj for obj in ReOrderItems.objects.all()
                    if obj.itemName
                }
                
                new_objects = []
                updated_count = 0
                unchanged_count = 0
                
                for _, row in df.iterrows():
                    item_name = row.get('itemName')
                    
                    # Skip if itemName is missing (it's our identifier)
                    if not item_name or pd.isna(item_name):
                        stats['skipped_records'] += 1
                        continue
                    
                    # Parse numeric fields safely
                    reorder_point = None
                    quantity_available = None
                    
                    try:
                        if pd.notna(row.get('reorderPoint')):
                            reorder_point = int(float(str(row.get('reorderPoint')).strip()))
                    except (ValueError, TypeError):
                        logging.warning(f"Could not parse reorderPoint for item {item_name}: {row.get('reorderPoint')}")
                    
                    try:
                        if pd.notna(row.get('quantityAvailable')):
                            quantity_available = int(float(str(row.get('quantityAvailable')).strip()))
                    except (ValueError, TypeError):
                        logging.warning(f"Could not parse quantityAvailable for item {item_name}: {row.get('quantityAvailable')}")
                    
                    # Prepare data
                    current_data = {
                        'itemName': str(item_name).strip(),
                        'description': row.get('description') if pd.notna(row.get('description')) else None,
                        'reorderPoint': reorder_point,
                        'quantityAvailable': quantity_available
                    }
                    
                    # Check if record exists
                    if item_name in existing_records:
                        existing_obj = existing_records[item_name]
                        
                        # Generate hash for comparison
                        existing_hash = generate_data_hash({
                            'itemName': existing_obj.itemName,
                            'description': existing_obj.description,
                            'reorderPoint': existing_obj.reorderPoint,
                            'quantityAvailable': existing_obj.quantityAvailable
                        })
                        
                        new_hash = generate_data_hash(current_data)
                        
                        if existing_hash != new_hash:
                            # Data has changed, update the record
                            for field, value in current_data.items():
                                setattr(existing_obj, field, value)
                            existing_obj.save()
                            updated_count += 1
                        else:
                            unchanged_count += 1
                    else:
                        # New record
                        new_objects.append(ReOrderItems(
                            **current_data
                        ))
                
                # Bulk create new records
                if new_objects:
                    ReOrderItems.objects.bulk_create(new_objects)
                    stats['new_records'] += len(new_objects)
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"ReOrderItems: {len(new_objects)} new, {updated_count} updated, {unchanged_count} unchanged.")

            elif key == 'invAdjData':
                # Handle nested JSON structure: {'IA1263': {'dateCreated': '...', 'createdBy': '...', 'documentNumber': '...', 'items': [...]}}
                # Get existing records for comparison
                existing_adjustments = {
                    obj.documentNumber: obj for obj in InventoryAdjustmentData.objects.all()
                }
                
                new_adjustments = []
                updated_count = 0
                unchanged_count = 0
                new_items_count = 0
                
                # Process the nested dictionary structure
                if isinstance(data[key], dict):
                    for document_number, adjustment_data in data[key].items():
                        if not document_number or not isinstance(adjustment_data, dict):
                            continue
                        
                        # Parse dateCreated
                        date_created = None
                        if adjustment_data.get('dateCreated'):
                            date_created = parse_datetime(adjustment_data.get('dateCreated'))
                        
                        # Prepare adjustment data
                        current_adjustment_data = {
                            'documentNumber': document_number,
                            'dateCreated': date_created,
                            'createdBy': adjustment_data.get('createdBy')
                        }
                        
                        # Check if adjustment exists
                        if document_number in existing_adjustments:
                            existing_adj = existing_adjustments[document_number]
                            
                            # Generate hash for comparison
                            existing_hash = generate_data_hash({
                                'documentNumber': existing_adj.documentNumber,
                                'dateCreated': existing_adj.dateCreated,
                                'createdBy': existing_adj.createdBy
                            })
                            
                            new_hash = generate_data_hash(current_adjustment_data)
                            
                            if existing_hash != new_hash:
                                # Update the adjustment
                                for field, value in current_adjustment_data.items():
                                    setattr(existing_adj, field, value)
                                existing_adj.save()
                                updated_count += 1
                                
                                # Delete existing items and recreate them
                                existing_adj.items.all().delete()
                                adjustment_obj = existing_adj
                            else:
                                unchanged_count += 1
                                adjustment_obj = existing_adj
                        else:
                            # Create new adjustment
                            adjustment_obj = InventoryAdjustmentData(**current_adjustment_data)
                            new_adjustments.append(adjustment_obj)
                    
                    # Bulk create new adjustments
                    if new_adjustments:
                        InventoryAdjustmentData.objects.bulk_create(new_adjustments)
                        stats['new_records'] += len(new_adjustments)
                        # Refresh objects to get IDs
                        for adj in new_adjustments:
                            adj.refresh_from_db()
                    
                    # Now process items for all adjustments (both new and existing)
                    for document_number, adjustment_data in data[key].items():
                        if not document_number or not isinstance(adjustment_data, dict):
                            continue
                        
                        # Get the adjustment object
                        try:
                            adjustment_obj = InventoryAdjustmentData.objects.get(documentNumber=document_number)
                        except InventoryAdjustmentData.DoesNotExist:
                            logging.warning(f"Adjustment {document_number} not found, skipping items")
                            continue
                        
                        # Process items array
                        items_data = adjustment_data.get('items', [])
                        if isinstance(items_data, list):
                            # Delete existing items if this is an update
                            if document_number in existing_adjustments:
                                adjustment_obj.items.all().delete()
                            
                            # Create item objects
                            item_objects = []
                            for item_data in items_data:
                                if isinstance(item_data, dict):
                                    item_objects.append(InventoryAdjustmentItems(
                                        inventoryAdjustment=adjustment_obj,
                                        item=item_data.get('item', ''),
                                        quantity=item_data.get('quantity', '')
                                    ))
                            
                            # Bulk create items
                            if item_objects:
                                InventoryAdjustmentItems.objects.bulk_create(item_objects)
                                new_items_count += len(item_objects)
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"InventoryAdjustmentData: {len(new_adjustments)} new, {updated_count} updated, {unchanged_count} unchanged, {new_items_count} items created.")

            elif key == 'invCountData':
                # Handle nested JSON structure: {'2': {'documentNumber': '2', 'status': 'Approved', 'dateCreated': '...', 'createdBy': '...', 'items': [...]}}
                # Get existing records for comparison
                existing_counts = {
                    obj.documentNumber: obj for obj in InventoryCountData.objects.all()
                }
                
                new_counts = []
                updated_count = 0
                unchanged_count = 0
                new_items_count = 0
                
                # Process the nested dictionary structure
                if isinstance(data[key], dict):
                    for document_number, count_data in data[key].items():
                        if not document_number or not isinstance(count_data, dict):
                            continue
                        
                        # Parse dateCreated
                        date_created = None
                        if count_data.get('dateCreated'):
                            date_created = parse_datetime(count_data.get('dateCreated'))
                        
                        # Prepare count data
                        current_count_data = {
                            'documentNumber': document_number,
                            'status': count_data.get('status'),
                            'dateCreated': date_created,
                            'createdBy': count_data.get('createdBy')
                        }
                        
                        # Check if count exists
                        if document_number in existing_counts:
                            existing_count = existing_counts[document_number]
                            
                            # Generate hash for comparison
                            existing_hash = generate_data_hash({
                                'documentNumber': existing_count.documentNumber,
                                'status': existing_count.status,
                                'dateCreated': existing_count.dateCreated,
                                'createdBy': existing_count.createdBy
                            })
                            
                            new_hash = generate_data_hash(current_count_data)
                            
                            if existing_hash != new_hash:
                                # Update the count
                                for field, value in current_count_data.items():
                                    setattr(existing_count, field, value)
                                existing_count.save()
                                updated_count += 1
                                
                                # Delete existing items and recreate them
                                existing_count.items.all().delete()
                                count_obj = existing_count
                            else:
                                unchanged_count += 1
                                count_obj = existing_count
                        else:
                            # Create new count
                            count_obj = InventoryCountData(**current_count_data)
                            new_counts.append(count_obj)
                    
                    # Bulk create new counts
                    if new_counts:
                        InventoryCountData.objects.bulk_create(new_counts)
                        stats['new_records'] += len(new_counts)
                        # Refresh objects to get IDs
                        for count in new_counts:
                            count.refresh_from_db()
                    
                    # Now process items for all counts (both new and existing)
                    for document_number, count_data in data[key].items():
                        if not document_number or not isinstance(count_data, dict):
                            continue
                        
                        # Get the count object
                        try:
                            count_obj = InventoryCountData.objects.get(documentNumber=document_number)
                        except InventoryCountData.DoesNotExist:
                            logging.warning(f"Count {document_number} not found, skipping items")
                            continue
                        
                        # Process items array
                        items_data = count_data.get('items', [])
                        if isinstance(items_data, list):
                            # Delete existing items if this is an update
                            if document_number in existing_counts:
                                count_obj.items.all().delete()
                            
                            # Create item objects
                            item_objects = []
                            for item_data in items_data:
                                if isinstance(item_data, dict):
                                    item_objects.append(InventoryCountItems(
                                        inventoryCount=count_obj,
                                        item=item_data.get('item', ''),
                                        binNumber=item_data.get('binNumber', '')
                                    ))
                            
                            # Bulk create items
                            if item_objects:
                                InventoryCountItems.objects.bulk_create(item_objects)
                                new_items_count += len(item_objects)
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"InventoryCountData: {len(new_counts)} new, {updated_count} updated, {unchanged_count} unchanged, {new_items_count} items created.")

            elif key == 'pendingApprovalInvCounts':
                # Handle nested JSON structure: {'80': {'documentNumber': '80', 'status': 'Completed/Pending Approval', 'dateCreated': '...', 'createdBy': '...', 'items': [...]}}
                # Get existing records for comparison
                existing_counts = {
                    obj.documentNumber: obj for obj in PendingApprovalInventoryCounts.objects.all()
                }
                
                new_counts = []
                updated_count = 0
                unchanged_count = 0
                new_items_count = 0
                
                # Process the nested dictionary structure
                if isinstance(data[key], dict):
                    for document_number, count_data in data[key].items():
                        if not document_number or not isinstance(count_data, dict):
                            continue
                        
                        # Parse dateCreated
                        date_created = None
                        if count_data.get('dateCreated'):
                            date_created = parse_datetime(count_data.get('dateCreated'))
                        
                        # Prepare count data
                        current_count_data = {
                            'documentNumber': document_number,
                            'status': count_data.get('status'),
                            'dateCreated': date_created,
                            'createdBy': count_data.get('createdBy')
                        }
                        
                        # Check if count exists
                        if document_number in existing_counts:
                            existing_count = existing_counts[document_number]
                            
                            # Generate hash for comparison
                            existing_hash = generate_data_hash({
                                'documentNumber': existing_count.documentNumber,
                                'status': existing_count.status,
                                'dateCreated': existing_count.dateCreated,
                                'createdBy': existing_count.createdBy
                            })
                            
                            new_hash = generate_data_hash(current_count_data)
                            
                            if existing_hash != new_hash:
                                # Update the count
                                for field, value in current_count_data.items():
                                    setattr(existing_count, field, value)
                                existing_count.save()
                                updated_count += 1
                                
                                # Delete existing items and recreate them
                                existing_count.items.all().delete()
                                count_obj = existing_count
                            else:
                                unchanged_count += 1
                                count_obj = existing_count
                        else:
                            # Create new count
                            count_obj = PendingApprovalInventoryCounts(**current_count_data)
                            new_counts.append(count_obj)
                    
                    # Bulk create new counts
                    if new_counts:
                        PendingApprovalInventoryCounts.objects.bulk_create(new_counts)
                        stats['new_records'] += len(new_counts)
                        # Refresh objects to get IDs
                        for count in new_counts:
                            count.refresh_from_db()
                    
                    # Now process items for all counts (both new and existing)
                    for document_number, count_data in data[key].items():
                        if not document_number or not isinstance(count_data, dict):
                            continue
                        
                        # Get the count object
                        try:
                            count_obj = PendingApprovalInventoryCounts.objects.get(documentNumber=document_number)
                        except PendingApprovalInventoryCounts.DoesNotExist:
                            logging.warning(f"Pending approval count {document_number} not found, skipping items")
                            continue
                        
                        # Process items array
                        items_data = count_data.get('items', [])
                        if isinstance(items_data, list):
                            # Delete existing items if this is an update
                            if document_number in existing_counts:
                                count_obj.items.all().delete()
                            
                            # Create item objects
                            item_objects = []
                            for item_data in items_data:
                                if isinstance(item_data, dict):
                                    item_objects.append(PendingApprovalInventoryCountItems(
                                        pendingApprovalInventoryCount=count_obj,
                                        item=item_data.get('item', ''),
                                        binNumber=item_data.get('binNumber', '')
                                    ))
                            
                            # Bulk create items
                            if item_objects:
                                PendingApprovalInventoryCountItems.objects.bulk_create(item_objects)
                                new_items_count += len(item_objects)
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"PendingApprovalInventoryCounts: {len(new_counts)} new, {updated_count} updated, {unchanged_count} unchanged, {new_items_count} items created.")

            elif key == 'transactionsCreatedByWMS':
                # Handle nested JSON structure: {'key': {'type': '...', 'documentNumber': '...', 'dateCreated': '...'}}
                # or list format: [{'type': '...', 'documentNumber': '...', 'dateCreated': '...'}, ...]
                # Get existing records for comparison
                existing_transactions = {
                    obj.documentNumber: obj for obj in TransactionsCreatedByWMS.objects.all()
                }
                
                new_transactions = []
                updated_count = 0
                unchanged_count = 0
                
                # Process the data - could be list or dict
                transaction_data_list = []
                if isinstance(data[key], dict):
                    # Convert dict to list of values
                    transaction_data_list = list(data[key].values())
                    logging.info(f"transactionsCreatedByWMS: Processing {len(transaction_data_list)} records from dictionary format")
                elif isinstance(data[key], list):
                    transaction_data_list = data[key]
                    logging.info(f"transactionsCreatedByWMS: Processing {len(transaction_data_list)} records from list format")
                else:
                    logging.warning(f"transactionsCreatedByWMS data is not in expected format: {type(data[key])}")
                    continue
                
                if not transaction_data_list:
                    logging.warning(f"transactionsCreatedByWMS: No data to process")
                    continue
                
                for transaction_data in transaction_data_list:
                    if not transaction_data or not isinstance(transaction_data, dict):
                        continue
                    
                    document_number = transaction_data.get('documentNumber')
                    if not document_number:
                        logging.warning(f"Skipping transaction with missing documentNumber")
                        stats['skipped_records'] += 1
                        continue
                    
                    # Parse dateCreated
                    date_created = None
                    if transaction_data.get('dateCreated'):
                        date_created = parse_datetime(transaction_data.get('dateCreated'))
                    
                    # Prepare transaction data
                    current_transaction_data = {
                        'type': transaction_data.get('type'),
                        'documentNumber': document_number,
                        'dateCreated': date_created
                    }
                    
                    # Check if record exists
                    if document_number in existing_transactions:
                        existing_obj = existing_transactions[document_number]
                        
                        # Generate hash for comparison
                        existing_hash = generate_data_hash({
                            'type': existing_obj.type,
                            'documentNumber': existing_obj.documentNumber,
                            'dateCreated': existing_obj.dateCreated.isoformat() if existing_obj.dateCreated else None
                        })
                        current_hash = generate_data_hash(current_transaction_data)
                        
                        # Update if data has changed
                        if existing_hash != current_hash:
                            existing_obj.type = current_transaction_data['type']
                            existing_obj.dateCreated = current_transaction_data['dateCreated']
                            existing_obj.save()
                            updated_count += 1
                        else:
                            unchanged_count += 1
                    else:
                        # New record
                        new_transactions.append(TransactionsCreatedByWMS(
                            type=current_transaction_data['type'],
                            documentNumber=current_transaction_data['documentNumber'],
                            dateCreated=current_transaction_data['dateCreated']
                        ))
                
                # Bulk create new transactions
                if new_transactions:
                    try:
                        TransactionsCreatedByWMS.objects.bulk_create(new_transactions, ignore_conflicts=True)
                        stats['new_records'] += len(new_transactions)
                    except Exception as e:
                        logging.error(f"Error bulk creating TransactionsCreatedByWMS: {e}")
                        # Fallback: create one by one to identify problematic records
                        for obj in new_transactions:
                            try:
                                obj.save()
                                stats['new_records'] += 1
                            except Exception as e2:
                                logging.error(f"Error creating TransactionsCreatedByWMS with documentNumber={obj.documentNumber}: {e2}")
                                stats['skipped_records'] += 1
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"TransactionsCreatedByWMS: {len(new_transactions)} new, {updated_count} updated, {unchanged_count} unchanged.")

            elif key == 'employeeDetails':
                # Handle employee details with image data
                # Get existing records for comparison (using name as unique identifier)
                existing_employees = {
                    obj.name: obj for obj in EmployeeDetails.objects.all()
                    if obj.name
                }
                
                new_employees = []
                updated_count = 0
                unchanged_count = 0
                
                # Process the data - could be list or dict
                employee_data = data[key]
                
                # Convert to list if it's a dict
                if isinstance(employee_data, dict):
                    employee_list = list(employee_data.values())
                elif isinstance(employee_data, list):
                    employee_list = employee_data
                else:
                    logging.warning(f"employeeDetails data is not in expected format: {type(employee_data)}")
                    continue
                
                for emp_data in employee_list:
                    if not isinstance(emp_data, dict):
                        continue
                    
                    name = emp_data.get('name')
                    if not name:
                        logging.warning("Skipping employee with missing name")
                        stats['skipped_records'] += 1
                        continue
                    
                    # Process image - handle base64 or binary
                    emp_image = None
                    image_data = emp_data.get('empImage')
                    
                    if image_data:
                        try:
                            # If it's a string, try to decode as base64
                            if isinstance(image_data, str):
                                # Check if it's base64 encoded
                                if image_data.startswith('data:image'):
                                    # Extract base64 part from data URI
                                    base64_data = image_data.split(',')[1] if ',' in image_data else image_data
                                    emp_image = base64.b64decode(base64_data)
                                else:
                                    # Try to decode as base64
                                    emp_image = base64.b64decode(image_data)
                            elif isinstance(image_data, bytes):
                                # Already binary
                                emp_image = image_data
                            else:
                                logging.warning(f"Unknown image format for employee {name}: {type(image_data)}")
                        except Exception as e:
                            logging.warning(f"Error processing image for employee {name}: {e}")
                            # Continue without image
                    
                    # Prepare employee data
                    current_employee_data = {
                        'name': str(name).strip(),
                        'empImage': emp_image
                    }
                    
                    # Check if record exists
                    if name in existing_employees:
                        existing_obj = existing_employees[name]
                        
                        # Generate hash for comparison
                        existing_img_str = None
                        if existing_obj.empImage:
                            try:
                                existing_img_str = base64.b64encode(existing_obj.empImage).decode('utf-8')
                            except Exception:
                                existing_img_str = None
                        
                        current_img_str = None
                        if emp_image:
                            try:
                                current_img_str = base64.b64encode(emp_image).decode('utf-8')
                            except Exception:
                                current_img_str = None
                        
                        existing_hash = generate_data_hash({
                            'name': existing_obj.name,
                            'empImage': existing_img_str
                        })
                        current_hash = generate_data_hash({
                            'name': current_employee_data['name'],
                            'empImage': current_img_str
                        })
                        
                        # Update if data has changed
                        if existing_hash != current_hash:
                            existing_obj.name = current_employee_data['name']
                            existing_obj.empImage = current_employee_data['empImage']
                            existing_obj.save()
                            updated_count += 1
                        else:
                            unchanged_count += 1
                    else:
                        # New record
                        new_employees.append(EmployeeDetails(
                            name=current_employee_data['name'],
                            empImage=current_employee_data['empImage']
                        ))
                
                # Bulk create new employees
                if new_employees:
                    try:
                        EmployeeDetails.objects.bulk_create(new_employees, ignore_conflicts=True)
                        stats['new_records'] += len(new_employees)
                    except Exception as e:
                        logging.error(f"Error bulk creating EmployeeDetails: {e}")
                        # Fallback: create one by one to identify problematic records
                        for obj in new_employees:
                            try:
                                obj.save()
                                stats['new_records'] += 1
                            except Exception as e2:
                                logging.error(f"Error creating EmployeeDetails with name={obj.name}: {e2}")
                                stats['skipped_records'] += 1
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"EmployeeDetails: {len(new_employees)} new, {updated_count} updated, {unchanged_count} unchanged.")

            elif key == 'itemsFromFulfillments':
                # Get existing records for comparison
                # Use composite key (documentNumber + item) as unique identifier
                existing_records = {}
                for obj in ItemsFromFulfillments.objects.all():
                    if obj.documentNumber and obj.item:
                        composite_key = f"{obj.documentNumber}|{obj.item}"
                        existing_records[composite_key] = obj
                
                new_objects = []
                updated_count = 0
                unchanged_count = 0
                
                for _, row in df.iterrows():
                    document_number = row.get('documentNumber')
                    item = row.get('item')
                    
                    # Skip if documentNumber or item is missing (both are required for composite key)
                    if not document_number or pd.isna(document_number) or not item or pd.isna(item):
                        stats['skipped_records'] += 1
                        continue
                    
                    # Parse dateCreated
                    date_created = None
                    if pd.notna(row.get('dateCreated')):
                        date_created = parse_datetime(row.get('dateCreated'))
                    
                    # Prepare data
                    current_data = {
                        'dateCreated': date_created,
                        'documentNumber': str(document_number).strip(),
                        'item': str(item).strip(),
                        'quantity': str(row.get('quantity')).strip() if pd.notna(row.get('quantity')) else None
                    }
                    
                    # Create composite key
                    composite_key = f"{current_data['documentNumber']}|{current_data['item']}"
                    
                    # Check if record exists
                    if composite_key in existing_records:
                        existing_obj = existing_records[composite_key]
                        
                        # Generate hash for comparison
                        existing_hash = generate_data_hash({
                            'dateCreated': existing_obj.dateCreated.isoformat() if existing_obj.dateCreated else None,
                            'documentNumber': existing_obj.documentNumber,
                            'item': existing_obj.item,
                            'quantity': existing_obj.quantity
                        })
                        
                        new_hash = generate_data_hash(current_data)
                        
                        if existing_hash != new_hash:
                            # Data has changed, update the record
                            existing_obj.dateCreated = current_data['dateCreated']
                            existing_obj.documentNumber = current_data['documentNumber']
                            existing_obj.item = current_data['item']
                            existing_obj.quantity = current_data['quantity']
                            existing_obj.save()
                            updated_count += 1
                        else:
                            unchanged_count += 1
                    else:
                        # New record
                        new_objects.append(ItemsFromFulfillments(
                            dateCreated=current_data['dateCreated'],
                            documentNumber=current_data['documentNumber'],
                            item=current_data['item'],
                            quantity=current_data['quantity']
                        ))
                
                # Bulk create new objects
                if new_objects:
                    try:
                        ItemsFromFulfillments.objects.bulk_create(new_objects, ignore_conflicts=True)
                        stats['new_records'] += len(new_objects)
                    except Exception as e:
                        logging.error(f"Error bulk creating ItemsFromFulfillments: {e}")
                        # Fallback: create one by one to identify problematic records
                        for obj in new_objects:
                            try:
                                obj.save()
                                stats['new_records'] += 1
                            except Exception as e2:
                                logging.error(f"Error creating ItemsFromFulfillments with documentNumber={obj.documentNumber}, item={obj.item}: {e2}")
                                stats['skipped_records'] += 1
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"ItemsFromFulfillments: {len(new_objects)} new, {updated_count} updated, {unchanged_count} unchanged.")

            elif key == 'itemsFromReceipts':
                # Get existing records for comparison
                # Use composite key (documentNumber + item) as unique identifier
                existing_records = {}
                for obj in ItemsFromReceipts.objects.all():
                    if obj.documentNumber and obj.item:
                        composite_key = f"{obj.documentNumber}|{obj.item}"
                        existing_records[composite_key] = obj
                
                new_objects = []
                updated_count = 0
                unchanged_count = 0
                
                for _, row in df.iterrows():
                    document_number = row.get('documentNumber')
                    item = row.get('item')
                    
                    # Skip if documentNumber or item is missing (both are required for composite key)
                    if not document_number or pd.isna(document_number) or not item or pd.isna(item):
                        stats['skipped_records'] += 1
                        continue
                    
                    # Parse dateCreated
                    date_created = None
                    if pd.notna(row.get('dateCreated')):
                        date_created = parse_datetime(row.get('dateCreated'))
                    
                    # Prepare data
                    current_data = {
                        'dateCreated': date_created,
                        'documentNumber': str(document_number).strip(),
                        'item': str(item).strip(),
                        'quantity': str(row.get('quantity')).strip() if pd.notna(row.get('quantity')) else None
                    }
                    
                    # Create composite key
                    composite_key = f"{current_data['documentNumber']}|{current_data['item']}"
                    
                    # Check if record exists
                    if composite_key in existing_records:
                        existing_obj = existing_records[composite_key]
                        
                        # Generate hash for comparison
                        existing_hash = generate_data_hash({
                            'dateCreated': existing_obj.dateCreated.isoformat() if existing_obj.dateCreated else None,
                            'documentNumber': existing_obj.documentNumber,
                            'item': existing_obj.item,
                            'quantity': existing_obj.quantity
                        })
                        
                        new_hash = generate_data_hash(current_data)
                        
                        if existing_hash != new_hash:
                            # Data has changed, update the record
                            existing_obj.dateCreated = current_data['dateCreated']
                            existing_obj.documentNumber = current_data['documentNumber']
                            existing_obj.item = current_data['item']
                            existing_obj.quantity = current_data['quantity']
                            existing_obj.save()
                            updated_count += 1
                        else:
                            unchanged_count += 1
                    else:
                        # New record
                        new_objects.append(ItemsFromReceipts(
                            dateCreated=current_data['dateCreated'],
                            documentNumber=current_data['documentNumber'],
                            item=current_data['item'],
                            quantity=current_data['quantity']
                        ))
                
                # Bulk create new objects
                if new_objects:
                    try:
                        ItemsFromReceipts.objects.bulk_create(new_objects, ignore_conflicts=True)
                        stats['new_records'] += len(new_objects)
                    except Exception as e:
                        logging.error(f"Error bulk creating ItemsFromReceipts: {e}")
                        # Fallback: create one by one to identify problematic records
                        for obj in new_objects:
                            try:
                                obj.save()
                                stats['new_records'] += 1
                            except Exception as e2:
                                logging.error(f"Error creating ItemsFromReceipts with documentNumber={obj.documentNumber}, item={obj.item}: {e2}")
                                stats['skipped_records'] += 1
                
                stats['updated_records'] += updated_count
                stats['unchanged_records'] += unchanged_count
                
                logging.info(f"ItemsFromReceipts: {len(new_objects)} new, {updated_count} updated, {unchanged_count} unchanged.")

        # Populate Supplier and Customer tables using bulk operations
        try:
            # Create supplier records using bulk_create for efficiency
            supplier_objects = []
            existing_suppliers = set(Supplier.objects.values_list('name', flat=True))
            
            for supplier_name in suppliers:
                if supplier_name and supplier_name.strip() and supplier_name.strip() not in existing_suppliers:
                    supplier_objects.append(Supplier(name=supplier_name.strip()))
            
            if supplier_objects:
                Supplier.objects.bulk_create(supplier_objects, ignore_conflicts=True)
                logging.info(f"Created {len(supplier_objects)} new supplier records")
            
            # Create customer records using bulk_create for efficiency
            customer_objects = []
            existing_customers = set(Customer.objects.values_list('name', flat=True))
            
            for customer_name in customers:
                if customer_name and customer_name.strip() and customer_name.strip() not in existing_customers:
                    customer_objects.append(Customer(name=customer_name.strip()))
            
            if customer_objects:
                Customer.objects.bulk_create(customer_objects, ignore_conflicts=True)
                logging.info(f"Created {len(customer_objects)} new customer records")
            
        except Exception as e:
            logging.error(f"Error populating Supplier/Customer tables: {e}")
            # Don't raise - we want to continue even if this fails

    # Log final statistics
    logging.info(f"Data sync completed! Summary: {stats['new_records']} new, {stats['updated_records']} updated, {stats['unchanged_records']} unchanged, {stats['skipped_records']} skipped")












