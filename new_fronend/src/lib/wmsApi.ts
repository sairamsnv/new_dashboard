import type {
  WmsEmployeePerformanceResponse,
  WmsInsightsResponse,
  WmsKpiEntry,
  WmsPaginated,
  WmsPackedOrPickedRow,
  WmsReceivedRow,
  WmsSoPoMonth,
  WmsWarehouseOpsMonth,
} from '@/types/wms';

/**
 * Base URL for the Django WMS API (no trailing slash).
 * - If `VITE_WMS_API_BASE_URL` is set (build or .env), use it.
 * - Vite dev: defaults to http://127.0.0.1:8000 when unset.
 * - Production bundle served by Django: uses `window.location.origin` so /api/* hits the same host
 *   (no .env needed when you open the app at http://127.0.0.1:8000/).
 */
export function getWmsApiBase(): string {
  const raw = import.meta.env.VITE_WMS_API_BASE_URL;
  if (raw != null && String(raw).trim() !== '') {
    return String(raw).replace(/\/$/, '');
  }
  if (import.meta.env.DEV) {
    return 'http://127.0.0.1:8000';
  }
  if (typeof window !== 'undefined' && window.location?.origin && window.location.protocol !== 'file:') {
    return window.location.origin.replace(/\/$/, '');
  }
  return '';
}

function buildUrl(path: string, params?: Record<string, string | undefined>): string {
  const base = getWmsApiBase();
  if (!base) {
    throw new Error('VITE_WMS_API_BASE_URL is not set');
  }
  const url = new URL(path.startsWith('/') ? path.slice(1) : path, `${base}/`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

export async function fetchWmsJson<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const res = await fetch(buildUrl(path, params));
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const wmsApi = {
  kpis: (timeframe: string) => fetchWmsJson<WmsKpiEntry[]>('/api/kpis/', { timeframe }),

  warehouseOpsTrend: (year: string) =>
    fetchWmsJson<WmsWarehouseOpsMonth[]>('/api/warehouse-trend/', { year }),

  warehouseSalesPurchaseTrends: (type: string) =>
    fetchWmsJson<WmsSoPoMonth[]>('/api/warehouse_trends/', { type }),

  employeePerformance: (timeframe: string) =>
    fetchWmsJson<WmsEmployeePerformanceResponse>('/api/employee-performance/', { timeframe }),

  ordersPackedOrPicked: (type: 'picked' | 'packed', timeframe: string, pageSize = '50') =>
    fetchWmsJson<WmsPaginated<WmsPackedOrPickedRow>>('/api/orders/', {
      type,
      timeframe,
      page_size: pageSize,
    }),

  ordersReceived: (timeframe: string, pageSize = '50') =>
    fetchWmsJson<WmsPaginated<WmsReceivedRow>>('/api/orders/', {
      type: 'received',
      timeframe,
      page_size: pageSize,
    }),

  insights: (period: string) => fetchWmsJson<WmsInsightsResponse>('/api/insights/', { period }),
};
