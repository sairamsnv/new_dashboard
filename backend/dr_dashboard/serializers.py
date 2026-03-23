from rest_framework import serializers
from .models import (
    TotalReturnOrders,
    PodUpdatedOrders, 
    OrdersPendingDeliveries,
    OrdersAssignedToDrivers,
    TotalLoadPlans,
    TotalSalesOrders
)

class TotalReturnOrdersSerializer(serializers.ModelSerializer):
    class Meta:
        model = TotalReturnOrders
        fields = '__all__'

class PodUpdatedOrdersSerializer(serializers.ModelSerializer):
    class Meta:
        model = PodUpdatedOrders
        fields = '__all__'

class OrdersPendingDeliveriesSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrdersPendingDeliveries
        fields = '__all__'

class OrdersAssignedToDriversSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrdersAssignedToDrivers
        fields = '__all__'

class TotalLoadPlansSerializer(serializers.ModelSerializer):
    class Meta:
        model = TotalLoadPlans
        fields = '__all__'

class TotalSalesOrdersSerializer(serializers.ModelSerializer):
    class Meta:
        model = TotalSalesOrders
        fields = '__all__'
