import { useQuery } from '@tanstack/react-query';
import { getWmsApiBase, wmsApi } from '@/lib/wmsApi';
import type { WmsOrdersFilterType, WmsSoPoFilterType, WmsTimeframe } from '@/types/wms';

export const wmsQueryKeys = {
  kpis: (timeframe: WmsTimeframe) => ['wms', 'kpis', timeframe] as const,
  warehouseOps: (year: string) => ['wms', 'warehouse-ops', year] as const,
  soPoTrends: (type: WmsSoPoFilterType) => ['wms', 'warehouse_trends', type] as const,
  employeePerformance: (timeframe: WmsTimeframe) => ['wms', 'employee-performance', timeframe] as const,
  orders: (filter: 'received' | 'picked' | 'packed', timeframe: WmsTimeframe) =>
    ['wms', 'orders', filter, timeframe] as const,
  insights: (period: string) => ['wms', 'insights', period] as const,
};

const enabled = () => Boolean(getWmsApiBase());

export function useWmsKpis(timeframe: WmsTimeframe, opts?: { enabled?: boolean }) {
  const on = opts?.enabled !== false;
  return useQuery({
    queryKey: wmsQueryKeys.kpis(timeframe),
    queryFn: () => wmsApi.kpis(timeframe),
    enabled: enabled() && on,
  });
}

export function useWarehouseOpsTrend(year: string, opts?: { enabled?: boolean }) {
  const on = opts?.enabled !== false;
  return useQuery({
    queryKey: wmsQueryKeys.warehouseOps(year),
    queryFn: () => wmsApi.warehouseOpsTrend(year),
    enabled: enabled() && Boolean(year) && on,
  });
}

export function useWarehouseSoPoTrends(type: WmsSoPoFilterType, opts?: { enabled?: boolean }) {
  const on = opts?.enabled !== false;
  return useQuery({
    queryKey: wmsQueryKeys.soPoTrends(type),
    queryFn: () => wmsApi.warehouseSalesPurchaseTrends(type),
    enabled: enabled() && on,
  });
}

export function useEmployeePerformance(timeframe: WmsTimeframe, opts?: { enabled?: boolean }) {
  const on = opts?.enabled !== false;
  return useQuery({
    queryKey: wmsQueryKeys.employeePerformance(timeframe),
    queryFn: () => wmsApi.employeePerformance(timeframe),
    enabled: enabled() && on,
  });
}

export function useWmsOrders(
  orderFilter: WmsOrdersFilterType,
  timeframe: WmsTimeframe,
  opts?: { enabled?: boolean },
) {
  const on = opts?.enabled !== false;
  return useQuery({
    queryKey: wmsQueryKeys.orders(orderFilter, timeframe),
    queryFn: () => {
      if (orderFilter === 'received') return wmsApi.ordersReceived(timeframe);
      return wmsApi.ordersPackedOrPicked(orderFilter, timeframe);
    },
    enabled: enabled() && on,
  });
}

export function useWmsInsights(period: string, opts?: { enabled?: boolean }) {
  const on = opts?.enabled !== false;
  return useQuery({
    queryKey: wmsQueryKeys.insights(period),
    queryFn: () => wmsApi.insights(period),
    enabled: enabled() && Boolean(period) && on,
  });
}
