from django.db import models

class TotalReturnOrders(models.Model):
    """Total return orders from NetSuite API."""
    transaction = models.TextField()
    documentno = models.TextField(unique=True)
    documentText = models.TextField(blank=True, null=True)  # New field
    vendor = models.TextField(blank=True, null=True)
    customer = models.TextField()
    date = models.DateTimeField()
    createdFrom = models.TextField()
    location = models.TextField()
    returnNotes = models.TextField(blank=True, null=True)

    class Meta:
        app_label = 'dr_dashboard'
        db_table = 'dr_total_return_orders'

    def __str__(self):
        return f"Return Order: {self.documentno}"

class PodUpdatedOrders(models.Model):
    """Proof of delivery updated orders from NetSuite API."""
    loadplan = models.TextField()
    deliveredBy = models.TextField()
    driver = models.TextField(blank=True, null=True)  # Driver name
    driverId = models.TextField(blank=True, null=True)  # Driver ID
    transactionDate = models.DateTimeField()
    deliveryStatus = models.TextField()
    documentno = models.TextField(unique=True)
    deliveryTime = models.DateTimeField()
    signature = models.TextField(blank=True, null=True)
    pod1 = models.TextField()
    pod2 = models.TextField(blank=True, null=True)

    class Meta:
        app_label = 'dr_dashboard'
        db_table = 'dr_pod_updated_orders'

    def __str__(self):
        return f"POD Order: {self.documentno}"

class OrdersPendingDeliveries(models.Model):
    """Orders pending deliveries from NetSuite API."""
    # This table appears to be empty in your API response
    # We'll create a basic structure for future use
    documentno = models.TextField(unique=True)
    status = models.TextField(default="Pending")
    created_date = models.DateTimeField(auto_now_add=True)

    class Meta:
        app_label = 'dr_dashboard'
        db_table = 'dr_orders_pending_deliveries'

    def __str__(self):
        return f"Pending Order: {self.documentno}"

class OrdersAssignedToDrivers(models.Model):
    """Orders assigned to drivers from NetSuite API."""
    driver = models.TextField()
    documentno = models.TextField(unique=True)
    deliverystatus = models.TextField(blank=True, null=True)  # Delivery status
    customer_or_supplier = models.TextField()
    createdFrom = models.TextField()
    loadplan = models.TextField()
    shippingcity = models.TextField(blank=True, null=True)  # Shipping city
    billingcity = models.TextField(blank=True, null=True)  # Billing city
    shippingaddress = models.TextField(blank=True, null=True)  # Ship to address
    created_date = models.DateTimeField(blank=True, null=True)  # Will be set from API, not auto

    class Meta:
        app_label = 'dr_dashboard'
        db_table = 'dr_orders_assigned_to_drivers'

    def __str__(self):
        return f"Driver: {self.driver} - Order: {self.documentno}"

class TotalLoadPlans(models.Model):
    """Total load plans from NetSuite API."""
    loadplan = models.TextField(unique=True)
    deliverydate = models.DateTimeField()
    location = models.TextField()
    driver = models.TextField()
    driverid = models.TextField(blank=True, null=True)  # Driver ID
    noOfOrders = models.TextField()
    warehouse = models.TextField()
    totalStops = models.TextField(blank=True, null=True)
    lpStatus = models.TextField()
    truckType = models.TextField(blank=True, null=True)
    truckWeight = models.TextField()
    totalLpWeight = models.TextField()

    class Meta:
        app_label = 'dr_dashboard'
        db_table = 'dr_total_load_plans'

    def __str__(self):
        return f"Load Plan: {self.loadplan}"

class TotalSalesOrders(models.Model):
    """Total sales orders from NetSuite API - detailed sales order records."""
    documentno = models.TextField(unique=True)
    customer = models.TextField()
    location = models.TextField()
    status = models.TextField(blank=True, null=True)
    shippingAddress = models.TextField(blank=True, null=True)
    created_date = models.DateTimeField(blank=True, null=True)  # Will be set from API, not auto

    class Meta:
        app_label = 'dr_dashboard'
        db_table = 'dr_total_sales_orders'

    def __str__(self):
        return f"Sales Order: {self.documentno}"