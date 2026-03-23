from rest_framework import serializers
from .models import (
    Supplier, Customer, OpenPurchaseOrder, OpenSalesOrder, 
    PackedOrPickedOrder, TotalOrdersReceived,
    PendingApprovalInventoryAdjustments, ReOrderItems
)

class SupplierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ['id', 'name']

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name']

class OpenPurchaseOrderSerializer(serializers.ModelSerializer):
    supplier = serializers.CharField(source='supplier.name', read_only=True)

    class Meta:
        model = OpenPurchaseOrder
        fields = ['id', 'tranId', 'createdFrom', 'location', 'supplier', 'tranDate', 'memo']

class OpenSalesOrderSerializer(serializers.ModelSerializer):
    customer = serializers.CharField(source='customer.name', read_only=True)
    related_purchase = serializers.CharField(source='related_purchase.tranId', read_only=True)

    class Meta:
        model = OpenSalesOrder
        fields = ['id', 'tranId', 'location', 'customer', 'related_purchase', 'dateCreated', 'shipDate', 'memo']

class PackedOrPickedOrderSerializer(serializers.ModelSerializer):
    customer = serializers.CharField(source='customer.name', read_only=True)
    createdFrom = serializers.CharField(source='createdFrom.tranId', read_only=True)

    class Meta:
        model = PackedOrPickedOrder
        fields = ['createdFrom', 'documentNumber', 'customer', 'packer', 'picker', 'location', 'dateCreated', 'packedTime', 'shipDate']

class TotalOrdersReceivedSerializer(serializers.ModelSerializer):
    supplier = serializers.CharField(source='supplier.name', read_only=True)
    createdFrom = serializers.CharField(source='createdFrom.tranId', read_only=True)

    class Meta:
        model = TotalOrdersReceived
        fields = ['id', 'supplier', 'createdFrom', 'createdDate', 'tranId', 'receivedBy', 'location', 'purchaseCreated']

class WarehouseTrendSerializer(serializers.Serializer):
    """Non-Model Serializer for API Trend View."""
    month = serializers.CharField()
    sales = serializers.IntegerField()
    purchases = serializers.IntegerField()


class PendingApprovalInventoryAdjustmentsSerializer(serializers.ModelSerializer):
    class Meta:
        model = PendingApprovalInventoryAdjustments
        fields = ['id', 'location', 'account', 'createdBy', 'status', 'dateCreated']


class ReOrderItemsSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReOrderItems
        fields = ['id', 'itemName', 'description', 'reorderPoint', 'quantityAvailable']


