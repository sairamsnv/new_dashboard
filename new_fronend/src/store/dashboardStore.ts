import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WidgetConfig, WidgetLayout, WidgetType } from '@/types/dashboard';
import { WIDGET_TYPES, defaultConfigForWidgetType, defaultDataSourceForType } from '@/types/dashboard';

interface DashboardStore {
  widgets: WidgetConfig[];
  layouts: WidgetLayout[];
  selectedWidgetId: string | null;
  isDirty: boolean;

  addWidget: (type: WidgetType) => void;
  setWidgetType: (id: string, type: WidgetType) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
  updateLayouts: (layouts: WidgetLayout[]) => void;
  /** Adjust grid w/h (and optionally x/y); clamps to minW/minH and 12 columns. */
  updateWidgetLayout: (
    id: string,
    patch: Partial<Pick<WidgetLayout, 'w' | 'h' | 'x' | 'y'>>
  ) => void;
  selectWidget: (id: string | null) => void;
  saveDashboard: () => Promise<void>;
  loadDashboard: () => Promise<void>;
  resetDashboard: () => void;
}

const generateId = () => `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const GRID_COLS = 12;

/** Fixes NaN/invalid persisted layout so inspector + resize behave (empty width field = NaN). */
function clampLayoutItem(l: WidgetLayout): WidgetLayout {
  const minW = l.minW ?? 1;
  const minH = l.minH ?? 1;
  let w = Number(l.w);
  let h = Number(l.h);
  if (!Number.isFinite(w)) w = minW;
  if (!Number.isFinite(h)) h = minH;
  w = Math.min(GRID_COLS, Math.max(minW, Math.round(w)));
  h = Math.max(minH, Math.round(h));
  let x = Number(l.x);
  let y = Number(l.y);
  if (!Number.isFinite(x)) x = 0;
  if (!Number.isFinite(y)) y = 0;
  x = Math.max(0, Math.round(x));
  y = Math.max(0, Math.round(y));
  if (x + w > GRID_COLS) x = Math.max(0, GRID_COLS - w);
  return {
    i: l.i,
    x,
    y,
    w,
    h,
    minW: l.minW,
    minH: l.minH,
  };
}

function normalizeLayouts(layouts: WidgetLayout[]): WidgetLayout[] {
  return layouts.map(clampLayoutItem);
}

const getNextPosition = (layouts: WidgetLayout[], w: number): { x: number; y: number } => {
  if (layouts.length === 0) return { x: 0, y: 0 };
  const maxY = Math.max(...layouts.map(l => l.y + l.h));
  return { x: 0, y: maxY };
};

const WMS_YEAR = String(new Date().getFullYear());

const DEFAULT_WIDGETS: WidgetConfig[] = [
  {
    id: 'default-kpi-1',
    type: 'kpi-card',
    title: 'Total',
    dataSource: 'wms-kpi',
    config: { kpiMetric: 'total', kpiTitle: 'Total', timeframe: 'today' },
  },
  {
    id: 'default-kpi-2',
    type: 'kpi-card',
    title: 'Picked',
    dataSource: 'wms-kpi',
    config: { kpiMetric: 'picked', kpiTitle: 'Picked', timeframe: 'today' },
  },
  {
    id: 'default-kpi-3',
    type: 'kpi-card',
    title: 'Packed',
    dataSource: 'wms-kpi',
    config: { kpiMetric: 'packed', kpiTitle: 'Packed', timeframe: 'today' },
  },
  {
    id: 'default-kpi-4',
    type: 'kpi-card',
    title: 'Received',
    dataSource: 'wms-kpi',
    config: { kpiMetric: 'received', kpiTitle: 'Received', timeframe: 'today' },
  },
  {
    id: 'default-bar-1',
    type: 'bar-chart',
    title: 'Warehouse ops by month',
    dataSource: 'wms-warehouse-ops-bar',
    config: { year: WMS_YEAR },
  },
  {
    id: 'default-line-1',
    type: 'line-chart',
    title: 'Open SO / PO by month',
    dataSource: 'wms-so-po-lines',
    config: { soPoType: 'all' },
  },
  {
    id: 'default-pie-1',
    type: 'pie-chart',
    title: 'Labor mix (today)',
    dataSource: 'wms-employee-pie',
    config: { timeframe: 'today' },
  },
  {
    id: 'default-table-1',
    type: 'table',
    title: 'Picked orders',
    dataSource: 'wms-orders-table',
    config: { orderType: 'picked', timeframe: 'today' },
  },
  { id: 'default-prediction-1', type: 'prediction-table', title: 'Predictions' },
  {
    id: 'default-insights-1',
    type: 'insights-table',
    title: 'WMS recommendations',
    dataSource: 'wms-insights-table',
    config: { insightsPeriod: 'this month' },
  },
];

const DEFAULT_LAYOUTS: WidgetLayout[] = [
  { i: 'default-kpi-1', x: 0, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'default-kpi-2', x: 3, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'default-kpi-3', x: 6, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'default-kpi-4', x: 9, y: 0, w: 3, h: 2, minW: 2, minH: 2 },
  { i: 'default-bar-1', x: 0, y: 2, w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'default-line-1', x: 6, y: 2, w: 6, h: 4, minW: 3, minH: 3 },
  { i: 'default-pie-1', x: 0, y: 6, w: 4, h: 4, minW: 3, minH: 3 },
  { i: 'default-table-1', x: 4, y: 6, w: 8, h: 4, minW: 4, minH: 3 },
  { i: 'default-prediction-1', x: 0, y: 10, w: 7, h: 4, minW: 5, minH: 3 },
  { i: 'default-insights-1', x: 7, y: 10, w: 5, h: 4, minW: 5, minH: 4 },
];

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      widgets: DEFAULT_WIDGETS,
      layouts: DEFAULT_LAYOUTS,
      selectedWidgetId: null,
      isDirty: false,

      addWidget: (type) => {
        const typeInfo = WIDGET_TYPES.find(t => t.type === type)!;
        const id = generateId();
        const pos = getNextPosition(get().layouts, typeInfo.defaultW);

        const widget: WidgetConfig = {
          id,
          type,
          title: `New ${typeInfo.label}`,
          dataSource: defaultDataSourceForType(type),
          config: defaultConfigForWidgetType(type),
        };

        const layout: WidgetLayout = {
          i: id,
          x: pos.x,
          y: pos.y,
          w: typeInfo.defaultW,
          h: typeInfo.defaultH,
          minW: typeInfo.minW,
          minH: typeInfo.minH,
        };

        set(state => ({
          widgets: [...state.widgets, widget],
          layouts: [...state.layouts, layout],
          isDirty: true,
          selectedWidgetId: id,
        }));
      },

      setWidgetType: (id, type) => {
        const typeInfo = WIDGET_TYPES.find(t => t.type === type)!;
        set(state => ({
          widgets: state.widgets.map(w => {
            if (w.id !== id) return w;
            const prevDesc =
              typeof w.config?.description === 'string' ? w.config.description : undefined;
            return {
              ...w,
              type,
              dataSource: defaultDataSourceForType(type),
              config: {
                ...defaultConfigForWidgetType(type),
                ...(prevDesc !== undefined && prevDesc !== '' ? { description: prevDesc } : {}),
              },
            };
          }),
          layouts: state.layouts.map(l => {
            if (l.i !== id) return l;
            return clampLayoutItem({
              ...l,
              minW: typeInfo.minW,
              minH: typeInfo.minH,
              w: Math.max(l.w, typeInfo.minW),
              h: Math.max(l.h, typeInfo.minH),
            });
          }),
          isDirty: true,
        }));
      },

      removeWidget: (id) => {
        set(state => ({
          widgets: state.widgets.filter(w => w.id !== id),
          layouts: state.layouts.filter(l => l.i !== id),
          selectedWidgetId: state.selectedWidgetId === id ? null : state.selectedWidgetId,
          isDirty: true,
        }));
      },

      updateWidget: (id, updates) => {
        set(state => ({
          widgets: state.widgets.map(w => w.id === id ? { ...w, ...updates } : w),
          isDirty: true,
        }));
      },

      updateLayouts: (layouts) => {
        set({ layouts: normalizeLayouts(layouts), isDirty: true });
      },

      updateWidgetLayout: (id, patch) => {
        set((state) => ({
          layouts: state.layouts.map((l) => {
            if (l.i !== id) return l;
            const next = { ...l, ...patch };
            const minW = l.minW ?? 1;
            const minH = l.minH ?? 1;
            if (patch.w !== undefined) {
              const nw = Number(patch.w);
              next.w = Number.isFinite(nw)
                ? Math.min(GRID_COLS, Math.max(minW, Math.round(nw)))
                : l.w;
            }
            if (patch.h !== undefined) {
              const nh = Number(patch.h);
              next.h = Number.isFinite(nh) ? Math.max(minH, Math.round(nh)) : l.h;
            }
            if (patch.x !== undefined) {
              next.x = Math.max(0, Math.min(GRID_COLS - next.w, patch.x));
            }
            if (patch.y !== undefined) {
              next.y = Math.max(0, patch.y);
            }
            next.x = Math.min(next.x, Math.max(0, GRID_COLS - next.w));
            return clampLayoutItem(next);
          }),
          isDirty: true,
        }));
      },

      selectWidget: (id) => {
        set({ selectedWidgetId: id });
      },

      saveDashboard: async () => {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        set({ isDirty: false });
      },

      loadDashboard: async () => {
        // Simulate API call - in production, fetch from backend
        await new Promise(resolve => setTimeout(resolve, 300));
      },

      resetDashboard: () => {
        set({
          widgets: DEFAULT_WIDGETS,
          layouts: DEFAULT_LAYOUTS,
          selectedWidgetId: null,
          isDirty: false,
        });
      },
    }),
    {
      name: 'dashboard-storage',
      partialize: (state) => ({
        widgets: state.widgets,
        layouts: state.layouts,
      }),
      merge: (persisted, current) => {
        if (!persisted || typeof persisted !== 'object') return current;
        const p = persisted as { widgets?: unknown; layouts?: WidgetLayout[] };
        return {
          ...current,
          ...p,
          layouts: normalizeLayouts(
            Array.isArray(p.layouts) ? p.layouts : current.layouts
          ),
        };
      },
    }
  )
);
