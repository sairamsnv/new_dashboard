export type WidgetType =
  | 'bar-chart'
  | 'line-chart'
  | 'pie-chart'
  | 'table'
  | 'kpi-card'
  | 'prediction-table'
  | 'insights-table';

export interface WidgetConfig {
  id: string;
  type: WidgetType;
  title: string;
  dataSource?: string;
  config?: Record<string, unknown>;
}

export interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface DashboardState {
  widgets: WidgetConfig[];
  layouts: WidgetLayout[];
  selectedWidgetId: string | null;
  isDirty: boolean;
}

export interface WidgetTypeInfo {
  type: WidgetType;
  label: string;
  icon: string;
  defaultW: number;
  defaultH: number;
  minW: number;
  minH: number;
}

export const WIDGET_TYPES: WidgetTypeInfo[] = [
  { type: 'kpi-card', label: 'KPI Card', icon: 'TrendingUp', defaultW: 3, defaultH: 2, minW: 2, minH: 2 },
  { type: 'bar-chart', label: 'Bar Chart', icon: 'BarChart3', defaultW: 6, defaultH: 4, minW: 3, minH: 3 },
  { type: 'line-chart', label: 'Line Chart', icon: 'LineChart', defaultW: 6, defaultH: 4, minW: 3, minH: 3 },
  { type: 'pie-chart', label: 'Pie Chart', icon: 'PieChart', defaultW: 4, defaultH: 4, minW: 3, minH: 3 },
  { type: 'table', label: 'Data Table', icon: 'Table', defaultW: 6, defaultH: 4, minW: 4, minH: 3 },
  { type: 'prediction-table', label: 'Prediction Table', icon: 'Brain', defaultW: 8, defaultH: 4, minW: 5, minH: 3 },
  { type: 'insights-table', label: 'Insights Table', icon: 'Lightbulb', defaultW: 8, defaultH: 5, minW: 5, minH: 4 },
];

/**
 * Radix Select forbids SelectItem value="". Sample/offline data uses this sentinel;
 * `dataSource` stays `undefined` when the user picks sample data.
 */
export const SAMPLE_DATASET_VALUE = '__sample__';

/** Preset "datasets" mapped to `dataSource` (see SAMPLE_DATASET_VALUE for built-in sample data). */
export const DATASET_PRESETS: {
  value: string;
  label: string;
  hint: string;
  forTypes: WidgetType[];
}[] = [
  {
    value: SAMPLE_DATASET_VALUE,
    label: 'Sample data',
    hint: 'Offline demo data — no API',
    forTypes: ['kpi-card', 'bar-chart', 'line-chart', 'pie-chart', 'table', 'insights-table', 'prediction-table'],
  },
  {
    value: 'wms-kpi',
    label: 'WMS · KPIs',
    hint: 'Live KPI totals from WMS',
    forTypes: ['kpi-card'],
  },
  {
    value: 'schema-kpi',
    label: 'Dynamic · registered table & column',
    hint: 'Use datasets from /api/schema/ — count, sum, avg on your columns',
    forTypes: ['kpi-card'],
  },
  {
    value: 'wms-warehouse-ops-bar',
    label: 'WMS · Warehouse ops (by month)',
    hint: 'Picked / packed / received trend',
    forTypes: ['bar-chart'],
  },
  {
    value: 'wms-so-po-lines',
    label: 'WMS · Sales & purchase orders',
    hint: 'Open SO / PO lines by month',
    forTypes: ['line-chart'],
  },
  {
    value: 'wms-employee-pie',
    label: 'WMS · Labor mix',
    hint: 'Employee performance split',
    forTypes: ['pie-chart'],
  },
  {
    value: 'wms-orders-table',
    label: 'WMS · Orders',
    hint: 'Picked / packed / received orders',
    forTypes: ['table'],
  },
  {
    value: 'wms-insights-table',
    label: 'WMS · Insights & recommendations',
    hint: 'Recommendations for the selected period',
    forTypes: ['insights-table'],
  },
];

export function datasetsForWidgetType(type: WidgetType) {
  return DATASET_PRESETS.filter((p) => p.forTypes.includes(type));
}

export function defaultDataSourceForType(type: WidgetType): string | undefined {
  const list = datasetsForWidgetType(type).filter((p) => p.value !== SAMPLE_DATASET_VALUE);
  return list[0]?.value;
}

/** WMS `/api/kpis/` rows — pick one for dynamic KPI value (live counts). */
export type WmsKpiMetricId = 'total' | 'picked' | 'packed' | 'received';

export const WMS_KPI_METRICS: { id: WmsKpiMetricId; label: string; hint: string }[] = [
  {
    id: 'total',
    label: 'Total',
    hint: 'Combined picked + packed + received counts (same logic as API)',
  },
  { id: 'picked', label: 'Picked', hint: 'Orders with a picker in the timeframe' },
  { id: 'packed', label: 'Packed', hint: 'Orders with a packer in the timeframe' },
  {
    id: 'received',
    label: 'Received',
    hint: 'Count of received orders (TotalOrdersReceived) in the timeframe',
  },
];

export function getWmsKpiMetricId(config: Record<string, unknown> | undefined): WmsKpiMetricId {
  const m = config?.kpiMetric as string | undefined;
  if (m && WMS_KPI_METRICS.some((x) => x.id === m)) {
    return m as WmsKpiMetricId;
  }
  const t = String(config?.kpiTitle ?? '')
    .trim()
    .toLowerCase();
  if (t === 'total') return 'total';
  if (t === 'picked') return 'picked';
  if (t === 'packed') return 'packed';
  if (t === 'received') return 'received';
  return 'total';
}

export function wmsKpiApiTitleForMetric(id: WmsKpiMetricId): string {
  return WMS_KPI_METRICS.find((x) => x.id === id)?.label ?? 'Total';
}

/** Sentinel for COUNT(*) in schema KPI config (`aggregateColumn`). */
export const SCHEMA_KPI_COUNT_ALL = '__all__';

export type SchemaAggregateOp = 'count' | 'count_distinct' | 'sum' | 'avg';

export const SCHEMA_AGGREGATE_OPS: { id: SchemaAggregateOp; label: string }[] = [
  { id: 'count', label: 'Count (rows or non-null in column)' },
  { id: 'count_distinct', label: 'Count distinct' },
  { id: 'sum', label: 'Sum (numeric column)' },
  { id: 'avg', label: 'Average (numeric column)' },
];

export function defaultConfigForWidgetType(type: WidgetType): Record<string, unknown> {
  const y = String(new Date().getFullYear());
  switch (type) {
    case 'kpi-card':
      return { kpiMetric: 'total' as WmsKpiMetricId, kpiTitle: 'Total', timeframe: 'today' };
    case 'bar-chart':
      return { year: y, fitYAxis: false, showLegend: true };
    case 'line-chart':
      return { soPoType: 'all', fitYAxis: false, showLegend: true };
    case 'pie-chart':
      return { timeframe: 'today', showLegend: true };
    case 'table':
      return { orderType: 'picked', timeframe: 'today' };
    case 'insights-table':
      return { insightsPeriod: 'this month' };
    default:
      return {};
  }
}
