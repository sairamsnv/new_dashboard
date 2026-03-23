/** KPI entry from GET /api/kpis/ */
export interface WmsKpiEntry {
  title: string;
  value: number;
}

/** Row from GET /api/warehouse-trend/ */
export interface WmsWarehouseOpsMonth {
  month: string;
  picked: number;
  packed: number;
  received: number;
}

/** Row from GET /api/warehouse_trends/ */
export interface WmsSoPoMonth {
  month: string;
  sales: number;
  purchases: number;
}

export interface WmsEmployeePerformanceResponse {
  bar_data: { name: string; picked: number; packed: number; received: number }[];
  pie_data: { name: string; value: number; color: string }[];
}

export interface WmsPaginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface WmsPackedOrPickedRow {
  createdFrom: string;
  documentNumber: string;
  customer: string;
  packer: string;
  picker: string;
  location: string;
  dateCreated: string;
  packedTime: string | null;
  shipDate: string | null;
}

export interface WmsReceivedRow {
  id: number;
  supplier: string;
  createdFrom: string;
  createdDate: string;
  tranId: string;
  receivedBy: string;
  location: string;
  purchaseCreated: string | null;
}

export interface WmsInsightRecommendation {
  type: string;
  priority: string;
  title: string;
  message: string;
  impact?: string;
  confidence?: number;
  trend?: string;
}

export interface WmsInsightsResponse {
  period: string;
  recommendations: WmsInsightRecommendation[];
  error?: string;
}

export type WmsTimeframe = string;

export type WmsOrdersFilterType = 'received' | 'picked' | 'packed';

export type WmsSoPoFilterType = 'all' | 'so' | 'po';
