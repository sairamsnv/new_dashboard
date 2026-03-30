import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WidgetConfig, WidgetLayout, WidgetType } from '@/types/dashboard';
import { WIDGET_TYPES, defaultConfigForWidgetType, defaultDataSourceForType } from '@/types/dashboard';
import { getWmsApiBase } from '@/lib/wmsApi';

interface DashboardStore {
  widgets: WidgetConfig[];
  layouts: WidgetLayout[];
  selectedWidgetId: string | null;
  isDirty: boolean;
  activeDatasetSlug: string | null;
  savedWidgetId: number | null;

  addWidget: (type: WidgetType) => void;
  setWidgetType: (id: string, type: WidgetType) => void;
  removeWidget: (id: string) => void;
  updateWidget: (id: string, updates: Partial<WidgetConfig>) => void;
  updateLayouts: (layouts: WidgetLayout[]) => void;
  selectWidget: (id: string | null) => void;
  setActiveDataset: (slug: string) => void;
  saveDashboard: () => Promise<void>;
  loadDashboard: () => Promise<void>;
  resetDashboard: () => void;
}

const generateId = () => `widget-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const getNextPosition = (layouts: WidgetLayout[], w: number): { x: number; y: number } => {
  if (layouts.length === 0) return { x: 0, y: 0 };
  const maxY = Math.max(...layouts.map(l => l.y + l.h));
  return { x: 0, y: maxY };
};

// Dashboard starts empty — widgets are added from uploaded dataset via AI suggestions
const DEFAULT_WIDGETS: WidgetConfig[] = [];
const DEFAULT_LAYOUTS: WidgetLayout[] = [];

function apiUrl(base: string, path: string): string {
  // base = '' in dev (Vite proxy) → use relative path
  return base ? `${base}${path}` : path;
}

async function apiSaveDashboard(
  widgets: WidgetConfig[],
  layouts: WidgetLayout[],
  existingId: number | null,
): Promise<number | null> {
  const base = getWmsApiBase();

  const payload = {
    name: 'My Dashboard',
    widget_type: 'dashboard_layout',
    config: { widgets, layouts },
  };

  const url = existingId
    ? apiUrl(base, `/api/widgets/${existingId}/`)
    : apiUrl(base, '/api/widgets/');
  const method = existingId ? 'PATCH' : 'POST';

  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Save failed: ${res.status}`);
  }

  const data = await res.json();
  return data.id ?? null;
}

async function apiLoadDashboard(): Promise<{ widgets: WidgetConfig[]; layouts: WidgetLayout[]; id: number } | null> {
  const base = getWmsApiBase();

  const res = await fetch(apiUrl(base, '/api/widgets/?page_size=1&widget_type=dashboard_layout'));
  if (!res.ok) return null;

  const data = await res.json();
  const results = Array.isArray(data) ? data : data.results ?? [];
  const first = results.find((w: { widget_type: string }) => w.widget_type === 'dashboard_layout');
  if (!first) return null;

  const config = first.config || {};
  return {
    widgets: config.widgets ?? [],
    layouts: config.layouts ?? [],
    id: first.id,
  };
}

export const useDashboardStore = create<DashboardStore>()(
  persist(
    (set, get) => ({
      widgets: DEFAULT_WIDGETS,
      layouts: DEFAULT_LAYOUTS,
      selectedWidgetId: null,
      isDirty: false,
      activeDatasetSlug: null,
      savedWidgetId: null,

      addWidget: (type) => {
        const typeInfo = WIDGET_TYPES.find(t => t.type === type)!;
        const id = generateId();
        const pos = getNextPosition(get().layouts, typeInfo.defaultW);

        // Auto-populate datasetSlug for chart/table widgets from the active dataset
        const activeSlug = get().activeDatasetSlug;
        const needsDataset = ['bar-chart', 'line-chart', 'pie-chart', 'table'].includes(type);
        const baseConfig = defaultConfigForWidgetType(type);
        const config = needsDataset && activeSlug
          ? { ...baseConfig, datasetSlug: activeSlug }
          : baseConfig;

        const widget: WidgetConfig = {
          id,
          type,
          title: `New ${typeInfo.label}`,
          dataSource: defaultDataSourceForType(type),
          config,
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
            return {
              ...l,
              minW: typeInfo.minW,
              minH: typeInfo.minH,
              w: Math.max(l.w, typeInfo.minW),
              h: Math.max(l.h, typeInfo.minH),
            };
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
        set({ layouts, isDirty: true });
      },

      selectWidget: (id) => {
        set({ selectedWidgetId: id });
      },

      setActiveDataset: (slug) => {
        set({ activeDatasetSlug: slug });
      },

      saveDashboard: async () => {
        const { widgets, layouts, savedWidgetId } = get();
        try {
          const newId = await apiSaveDashboard(widgets, layouts, savedWidgetId);
          set({ isDirty: false, savedWidgetId: newId ?? savedWidgetId });
        } catch {
          // Silently fall back to local persistence (already done via zustand persist)
          set({ isDirty: false });
        }
      },

      loadDashboard: async () => {
        try {
          const saved = await apiLoadDashboard();
          if (saved && saved.widgets.length > 0) {
            set({
              widgets: saved.widgets,
              layouts: saved.layouts,
              savedWidgetId: saved.id,
              isDirty: false,
            });
          }
        } catch {
          // Use persisted local state on failure
        }
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
        savedWidgetId: state.savedWidgetId,
        activeDatasetSlug: state.activeDatasetSlug,
      }),
    }
  )
);
