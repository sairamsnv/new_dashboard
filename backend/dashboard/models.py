from django.db import models

class Supplier(models.Model):
    """Flat supplier table without any linked models."""
    name = models.TextField(unique=True)

    def __str__(self):
        return self.name


class Customer(models.Model):
    """Flat customer table without any linked models."""
    name = models.TextField(unique=True)

    def __str__(self):
        return self.name


class OpenPurchaseOrder(models.Model):
    """Open purchase order - flattened, no relations."""
    tranId = models.TextField(unique=True)
    createdFrom = models.TextField(blank=True, null=True)
    location = models.TextField()
    vendor = models.TextField()  # was ForeignKey to Supplier
    tranDate = models.DateField()
    memo = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.tranId


class OpenSalesOrder(models.Model):
    """Open sales order - flattened."""
    tranId = models.TextField(unique=True)
    location = models.TextField()
    customer = models.TextField()  # was ForeignKey to Customer
    related_purchase = models.TextField(blank=True, null=True)  # was ForeignKey to OpenPurchaseOrder
    dateCreated = models.DateField()
    shipDate = models.DateField()
    memo = models.TextField(blank=True, null=True)
    shipMethod = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.tranId


class PackedOrPickedOrder(models.Model):
    """Packed or picked order - flat."""
    createdFrom = models.TextField(blank=True, null=True)  # was FK to OpenSalesOrder
    documentNumber = models.TextField()
    customer = models.TextField()  # was ForeignKey to Customer
    packer = models.TextField(blank=True, null=True)
    picker = models.TextField(blank=True, null=True)
    location = models.TextField()
    shipDate = models.DateField()
    dateCreated = models.DateTimeField()
    packedTime = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.documentNumber


class TotalOrdersReceived(models.Model):
    """Total orders received - flat."""
    supplier = models.TextField()  # was ForeignKey to Supplier
    createdFrom = models.TextField()
    createdDate = models.DateField()
    tranId = models.TextField(unique=True)
    receivedBy = models.TextField()
    location = models.TextField()
    purchaseCreated = models.DateField(blank=True, null=True)  # New field for purchase creation date

    def __str__(self):
        return f"{self.supplier} - {self.createdDate}"


class PendingApprovalInventoryAdjustments(models.Model):
    """Pending approval inventory adjustments - flat."""
    location = models.TextField(blank=True, null=True)
    account = models.TextField(blank=True, null=True)
    createdBy = models.TextField(blank=True, null=True, db_column='created_by')
    status = models.TextField(blank=True, null=True)
    dateCreated = models.DateTimeField(blank=True, null=True, db_column='date_created')

    class Meta:
        db_table = 'pending_approval_inventory_adjustments'

    def __str__(self):
        return f"{self.location} - {self.dateCreated}"


class ReOrderItems(models.Model):
    """Reorder items - stores item reorder information."""
    itemName = models.TextField(blank=True, null=True, db_column='item_name')
    description = models.TextField(blank=True, null=True)
    reorderPoint = models.IntegerField(blank=True, null=True, db_column='reorder_point')
    quantityAvailable = models.IntegerField(blank=True, null=True, db_column='quantity_available')

    class Meta:
        db_table = 're_order_items'

    def __str__(self):
        return f"{self.itemName} - Qty: {self.quantityAvailable}"


class InventoryAdjustmentData(models.Model):
    """Inventory adjustment data - main records."""
    documentNumber = models.TextField(unique=True, db_column='document_number')  # e.g., 'IA1263'
    dateCreated = models.DateTimeField(blank=True, null=True, db_column='date_created')
    createdBy = models.TextField(blank=True, null=True, db_column='created_by')

    class Meta:
        db_table = 'inventory_adjustment_data'

    def __str__(self):
        return f"{self.documentNumber} - {self.createdBy}"


class InventoryAdjustmentItems(models.Model):
    """Inventory adjustment items - items associated with adjustments."""
    inventoryAdjustment = models.ForeignKey(
        InventoryAdjustmentData,
        on_delete=models.CASCADE,
        related_name='items',
        db_column='inventory_adjustment_id'
    )
    item = models.TextField()
    quantity = models.TextField(blank=True, null=True)  # Stored as text to match API format

    class Meta:
        db_table = 'inventory_adjustment_items'

    def __str__(self):
        return f"{self.item} - Qty: {self.quantity}"


class InventoryCountData(models.Model):
    """Inventory count data - main records."""
    documentNumber = models.TextField(unique=True, db_column='document_number')  # e.g., '2'
    status = models.TextField(blank=True, null=True)  # e.g., 'Approved'
    dateCreated = models.DateTimeField(blank=True, null=True, db_column='date_created')
    createdBy = models.TextField(blank=True, null=True, db_column='created_by')

    class Meta:
        db_table = 'inventory_count_data'

    def __str__(self):
        return f"{self.documentNumber} - {self.status}"


class InventoryCountItems(models.Model):
    """Inventory count items - items associated with counts."""
    inventoryCount = models.ForeignKey(
        InventoryCountData,
        on_delete=models.CASCADE,
        related_name='items',
        db_column='inventory_count_id'
    )
    item = models.TextField()
    binNumber = models.TextField(blank=True, null=True, db_column='bin_number')  # e.g., '- None -'

    class Meta:
        db_table = 'inventory_count_items'

    def __str__(self):
        return f"{self.item} - Bin: {self.binNumber}"


class PendingApprovalInventoryCounts(models.Model):
    """Pending approval inventory counts - main records."""
    documentNumber = models.TextField(unique=True, db_column='document_number')  # e.g., '80'
    status = models.TextField(blank=True, null=True)  # e.g., 'Completed/Pending Approval'
    dateCreated = models.DateTimeField(blank=True, null=True, db_column='date_created')
    createdBy = models.TextField(blank=True, null=True, db_column='created_by')

    class Meta:
        db_table = 'pending_approval_inventory_counts'

    def __str__(self):
        return f"{self.documentNumber} - {self.status}"


class PendingApprovalInventoryCountItems(models.Model):
    """Pending approval inventory count items - items associated with pending approval counts."""
    pendingApprovalInventoryCount = models.ForeignKey(
        PendingApprovalInventoryCounts,
        on_delete=models.CASCADE,
        related_name='items',
        db_column='pending_approval_inventory_count_id'
    )
    item = models.TextField()
    binNumber = models.TextField(blank=True, null=True, db_column='bin_number')  # e.g., '- None -'

    class Meta:
        db_table = 'pending_approval_inventory_count_items'

    def __str__(self):
        return f"{self.item} - Bin: {self.binNumber}"


class TransactionsCreatedByWMS(models.Model):
    """Transactions created by WMS - stores transaction records."""
    type = models.TextField(blank=True, null=True)
    documentNumber = models.TextField(unique=True, db_column='document_number')
    dateCreated = models.DateTimeField(blank=True, null=True, db_column='date_created')

    class Meta:
        db_table = 'transactions_created_by_wms'

    def __str__(self):
        return f"{self.documentNumber} - {self.type}"


class EmployeeDetails(models.Model):
    """Employee details - stores employee information with image."""
    name = models.TextField(blank=True, null=True)
    empImage = models.BinaryField(blank=True, null=True, db_column='emp_image')

    class Meta:
        db_table = 'employee_details'

    def __str__(self):
        return f"{self.name}"


class ItemsFromFulfillments(models.Model):
    """Items from fulfillments - stores fulfillment item records."""
    dateCreated = models.DateTimeField(blank=True, null=True, db_column='date_created')
    documentNumber = models.TextField(blank=True, null=True, db_column='document_number')
    item = models.TextField(blank=True, null=True)
    quantity = models.TextField(blank=True, null=True)  # Stored as text to match API format

    class Meta:
        db_table = 'items_from_fulfillments'

    def __str__(self):
        return f"{self.documentNumber} - {self.item}"


class ItemsFromReceipts(models.Model):
    """Items from receipts - stores receipt item records."""
    dateCreated = models.DateTimeField(blank=True, null=True, db_column='date_created')
    documentNumber = models.TextField(blank=True, null=True, db_column='document_number')
    item = models.TextField(blank=True, null=True)
    quantity = models.TextField(blank=True, null=True)  # Stored as text to match API format

    class Meta:
        db_table = 'items_from_receipts'

    def __str__(self):
        return f"{self.documentNumber} - {self.item}"











