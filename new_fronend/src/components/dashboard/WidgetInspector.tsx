import { useState, useEffect } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardStore } from '@/store/dashboardStore';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  WIDGET_TYPES,
  SAMPLE_DATASET_VALUE,
  SCHEMA_KPI_COUNT_ALL,
  WMS_KPI_METRICS,
  datasetsForWidgetType,
  getWmsKpiMetricId,
  type SchemaAggregateOp,
  type WidgetType,
} from '@/types/dashboard';
import SchemaKpiInspector from '@/components/dashboard/SchemaKpiInspector';
import { fetchSchemaInspect } from '@/lib/schemaApi';
import type { SchemaInspectColumn } from '@/lib/schemaApi';

const TIMEFRAME_OPTIONS = ['today', 'yesterday', 'this week', 'this month'] as const;

const INSIGHTS_PERIOD_OPTIONS = ['this week', 'this month', 'last month', 'this quarter'] as const;

const datasetSelectValue = (dataSource: string | undefined) =>
  dataSource && dataSource !== '' ? dataSource : SAMPLE_DATASET_VALUE;

// Multi-select toggle for Y columns (used below)
const YColumnSelector = ({
  columns,
  selected,
  onChange,
}: {
  columns: SchemaInspectColumn[];
  selected: string[];
  onChange: (cols: string[]) => void;
}) => (
  <div className="flex flex-wrap gap-1.5">
    {columns.map((col) => {
      const active = selected.includes(col.col_name);
      return (
        <button
          key={col.col_name}
          type="button"
          onClick={() =>
            onChange(
              active
                ? selected.filter((c) => c !== col.col_name)
                : [...selected, col.col_name],
            )
          }
          className={`rounded px-2 py-0.5 text-[10px] font-mono border transition-colors ${
            active
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted text-muted-foreground border-border hover:border-primary/50'
          }`}
        >
          {col.col_name}
        </button>
      );
    })}
  </div>
);

const WidgetInspector = () => {
  const { widgets, selectedWidgetId, activeDatasetSlug, selectWidget, updateWidget, removeWidget, setWidgetType } =
    useDashboardStore();
  const widget = widgets.find((w) => w.id === selectedWidgetId);
  const [descOpen, setDescOpen] = useState(false);

  // Derive the datasetSlug in use for this widget (fall back to the active dataset)
  const widgetDatasetSlug = (widget?.config?.datasetSlug as string | undefined) || activeDatasetSlug || '';

  // Fetch schema columns when we have a dataset slug
  const { data: schemaData, isFetching: schemaLoading, refetch: refetchSchema } = useQuery({
    queryKey: ['schema-inspect', widgetDatasetSlug],
    queryFn: () => fetchSchemaInspect(widgetDatasetSlug),
    enabled: Boolean(widgetDatasetSlug),
    staleTime: 5 * 60 * 1000,
  });
  const schemaCols: SchemaInspectColumn[] = schemaData?.columns ?? [];

  // Auto-suggest best columns once schema loads, if widget has no columns configured
  useEffect(() => {
    if (!widget || !schemaCols.length) return;
    const cfg = widget.config ?? {};
    const hasX = Boolean(cfg.xCol as string);
    const hasY = ((cfg.yCols as string[]) || []).length > 0;
    const hasCols = ((cfg.columns as string[]) || []).length > 0;
    if (hasX && (hasY || hasCols)) return; // already configured — don't overwrite

    const textCols = schemaCols.filter(c => c.dtype === 'text' || c.dtype === 'categorical' || c.is_dimension);
    const numCols  = schemaCols.filter(c => c.dtype === 'numeric' || c.dtype === 'integer' || c.dtype === 'float');

    if (widget.type === 'pie-chart') {
      const labelCol = textCols[0]?.col_name ?? schemaCols[0]?.col_name;
      const valCol   = numCols[0]?.col_name  ?? schemaCols[1]?.col_name;
      updateWidget(widget.id, { config: { ...cfg, xCol: labelCol ?? '', yCols: valCol ? [valCol] : [] } });
    } else if (widget.type === 'bar-chart' || widget.type === 'line-chart') {
      const xCol = textCols[0]?.col_name ?? schemaCols[0]?.col_name;
      const yCol = numCols[0]?.col_name  ?? schemaCols[1]?.col_name;
      updateWidget(widget.id, { config: { ...cfg, xCol: xCol ?? '', yCols: yCol ? [yCol] : [] } });
    } else if (widget.type === 'table') {
      const cols = schemaCols.slice(0, 6).map(c => c.col_name);
      updateWidget(widget.id, { config: { ...cfg, columns: cols } });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemaCols.length, widget?.id, widget?.type]);

  if (!widget) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <span className="text-xl">📊</span>
        </div>
        <p className="text-sm font-medium text-foreground">No widget selected</p>
        <p className="text-xs text-muted-foreground mt-1">Click a widget to configure it</p>
      </div>
    );
  }

  const typeLabel = WIDGET_TYPES.find((t) => t.type === widget.type)?.label ?? widget.type;
  const datasetOptions = datasetsForWidgetType(widget.type);
  const dsValue = datasetSelectValue(widget.dataSource);
  const description = typeof widget.config?.description === 'string' ? widget.config.description : '';

  const patchConfig = (partial: Record<string, unknown>) => {
    updateWidget(widget.id, { config: { ...widget.config, ...partial } });
  };

  const chartTypes: WidgetType[] = ['bar-chart', 'line-chart', 'pie-chart'];
  const isChart = chartTypes.includes(widget.type);
  const showYAxisFit = widget.type === 'bar-chart' || widget.type === 'line-chart';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold">Widget builder</h3>
          <Badge variant="secondary" className="mt-1 text-[10px]">
            {typeLabel}
          </Badge>
        </div>
        <button
          type="button"
          onClick={() => selectWidget(null)}
          className="p-1 rounded hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="widget-title" className="text-xs">
            Display name
          </Label>
          <Input
            id="widget-title"
            value={widget.title}
            onChange={(e) => updateWidget(widget.id, { title: e.target.value })}
            className="h-8 text-sm"
          />
        </div>

        <Collapsible
          open={descOpen || Boolean(description)}
          onOpenChange={setDescOpen}
          className="space-y-2"
        >
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="text-[11px] text-primary hover:underline"
            >
              {description ? 'Edit description' : '+ Add description'}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2">
            <Textarea
              placeholder="Optional subtitle shown under the title"
              value={description}
              onChange={(e) => patchConfig({ description: e.target.value })}
              className="min-h-[72px] text-xs resize-y"
            />
          </CollapsibleContent>
        </Collapsible>

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs">Widget type</Label>
          <Select
            value={widget.type}
            onValueChange={(v) => setWidgetType(widget.id, v as WidgetType)}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WIDGET_TYPES.map((t) => (
                <SelectItem key={t.type} value={t.type} className="text-sm">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Changing type resets dataset defaults for that visualization. Your title is kept.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">Dataset</Label>
          <Select
            value={dsValue}
            onValueChange={(v) => {
              if (v === SAMPLE_DATASET_VALUE) {
                updateWidget(widget.id, { dataSource: undefined });
                return;
              }
              if (v === 'schema-kpi' && widget.type === 'kpi-card') {
                updateWidget(widget.id, {
                  dataSource: 'schema-kpi',
                  config: {
                    ...widget.config,
                    datasetSlug: (widget.config?.datasetSlug as string) || '',
                    aggregateOp: (widget.config?.aggregateOp as SchemaAggregateOp) || 'count',
                    aggregateColumn: SCHEMA_KPI_COUNT_ALL,
                  },
                });
                return;
              }
              updateWidget(widget.id, { dataSource: v });
            }}
          >
            <SelectTrigger className="h-8 text-sm">
              <SelectValue placeholder="Choose data" />
            </SelectTrigger>
            <SelectContent>
              {datasetOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-sm">
                  <span className="font-medium">{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground leading-snug">
            {datasetOptions.find((o) => o.value === dsValue)?.hint ??
              'Pick sample data or a connected API feed.'}
          </p>
        </div>

        {isChart && (
          <>
            <Separator />
            <div className="space-y-3">
              <p className="text-[11px] font-medium text-foreground uppercase tracking-wide">Chart display</p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-legend"
                  checked={(widget.config?.showLegend as boolean | undefined) ?? true}
                  onCheckedChange={(c) => patchConfig({ showLegend: c === true })}
                />
                <Label htmlFor="show-legend" className="text-xs font-normal cursor-pointer">
                  Show legend
                </Label>
              </div>
              {showYAxisFit && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fit-y"
                    checked={Boolean(widget.config?.fitYAxis)}
                    onCheckedChange={(c) => patchConfig({ fitYAxis: c === true })}
                  />
                  <Label htmlFor="fit-y" className="text-xs font-normal cursor-pointer">
                    Fit Y-axis to data range
                  </Label>
                </div>
              )}
            </div>
          </>
        )}

        {(widget.type === 'bar-chart' || widget.type === 'line-chart' || widget.type === 'pie-chart' || widget.type === 'table') && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium text-foreground uppercase tracking-wide">Dataset columns</p>
                {widgetDatasetSlug && (
                  <button
                    type="button"
                    onClick={() => refetchSchema()}
                    className="p-1 rounded hover:bg-muted transition-colors"
                    title="Refresh columns"
                  >
                    <RefreshCw className={`h-3 w-3 text-muted-foreground ${schemaLoading ? 'animate-spin' : ''}`} />
                  </button>
                )}
              </div>

              {/* Dataset slug — editable but auto-filled from active dataset */}
              <div className="space-y-1">
                <Label className="text-xs">Dataset</Label>
                <Input
                  placeholder="e.g. upload-ds-abc123"
                  value={(widget.config?.datasetSlug as string) || activeDatasetSlug || ''}
                  onChange={(e) => patchConfig({ datasetSlug: e.target.value })}
                  className="h-8 text-[11px] font-mono"
                />
                {schemaCols.length > 0 && (
                  <p className="text-[10px] text-emerald-500">{schemaCols.length} columns loaded</p>
                )}
              </div>

              {/* X column */}
              {widget.type !== 'table' && (
                <div className="space-y-1">
                  <Label className="text-xs">X column (axis / label)</Label>
                  {schemaCols.length > 0 ? (
                    <Select
                      value={(widget.config?.xCol as string) || ''}
                      onValueChange={(v) => patchConfig({ xCol: v })}
                    >
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue placeholder="Pick column…" />
                      </SelectTrigger>
                      <SelectContent>
                        {schemaCols.map((col) => (
                          <SelectItem key={col.col_name} value={col.col_name} className="text-sm font-mono">
                            <span>{col.col_name}</span>
                            <span className="ml-2 text-[10px] text-muted-foreground">{col.dtype}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      placeholder="e.g. date, category"
                      value={(widget.config?.xCol as string) || ''}
                      onChange={(e) => patchConfig({ xCol: e.target.value })}
                      className="h-8 text-sm font-mono"
                    />
                  )}
                </div>
              )}

              {/* Y columns / value columns */}
              <div className="space-y-1">
                <Label className="text-xs">
                  {widget.type === 'pie-chart'
                    ? 'Value column'
                    : widget.type === 'table'
                    ? 'Columns to show'
                    : 'Y columns (select one or more)'}
                </Label>
                {schemaCols.length > 0 ? (
                  <YColumnSelector
                    columns={schemaCols}
                    selected={
                      widget.type === 'table'
                        ? ((widget.config?.columns as string[]) || [])
                        : ((widget.config?.yCols as string[]) || [])
                    }
                    onChange={(vals) =>
                      patchConfig(widget.type === 'table' ? { columns: vals } : { yCols: vals })
                    }
                  />
                ) : (
                  <Input
                    placeholder={widget.type === 'table' ? 'col1, col2, col3' : 'e.g. revenue, profit'}
                    value={
                      widget.type === 'table'
                        ? ((widget.config?.columns as string[]) || []).join(', ')
                        : ((widget.config?.yCols as string[]) || []).join(', ')
                    }
                    onChange={(e) => {
                      const vals = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                      patchConfig(widget.type === 'table' ? { columns: vals } : { yCols: vals });
                    }}
                    className="h-8 text-sm font-mono"
                  />
                )}
              </div>

              {widget.type === 'table' && (
                <div className="space-y-1">
                  <Label className="text-xs">Row limit</Label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={(widget.config?.limit as number) || 100}
                    onChange={(e) => patchConfig({ limit: parseInt(e.target.value, 10) || 100 })}
                    className="h-8 text-sm font-mono"
                  />
                </div>
              )}
            </div>
          </>
        )}

        {widget.type === 'kpi-card' && (
          <>
            <Separator />
            {widget.dataSource === 'wms-kpi' ? (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Metric (from WMS API)</Label>
                  <Select
                    value={getWmsKpiMetricId(widget.config)}
                    onValueChange={(v) => {
                      const meta = WMS_KPI_METRICS.find((m) => m.id === v);
                      patchConfig({
                        kpiMetric: v,
                        kpiTitle: meta?.label ?? v,
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WMS_KPI_METRICS.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-sm">
                          <span className="font-medium">{m.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    {WMS_KPI_METRICS.find((m) => m.id === getWmsKpiMetricId(widget.config))?.hint ??
                      'Live count from /api/kpis/'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Timeframe</Label>
                  <Select
                    value={(widget.config?.timeframe as string) ?? 'today'}
                    onValueChange={(v) => patchConfig({ timeframe: v })}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEFRAME_OPTIONS.map((tf) => (
                        <SelectItem key={tf} value={tf} className="text-sm capitalize">
                          {tf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : widget.dataSource === 'schema-kpi' ? (
              <div className="space-y-3">
                <SchemaKpiInspector
                  datasetSlug={(widget.config?.datasetSlug as string) || ''}
                  aggregateOp={(widget.config?.aggregateOp as SchemaAggregateOp) || 'count'}
                  aggregateColumn={(widget.config?.aggregateColumn as string) || SCHEMA_KPI_COUNT_ALL}
                  onPatch={patchConfig}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label className="text-xs">Value</Label>
                  <Input
                    value={(widget.config?.value as string) || ''}
                    onChange={(e) => patchConfig({ value: e.target.value })}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Change (%)</Label>
                  <Input
                    type="number"
                    value={(widget.config?.change as number) || 0}
                    onChange={(e) => patchConfig({ change: parseFloat(e.target.value) || 0 })}
                    className="h-8 text-sm font-mono"
                  />
                </div>
              </div>
            )}
          </>
        )}

        {widget.type === 'insights-table' && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs">Insights period</Label>
              <Select
                value={(widget.config?.insightsPeriod as string) ?? 'this month'}
                onValueChange={(v) => patchConfig({ insightsPeriod: v })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INSIGHTS_PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p} value={p} className="text-sm capitalize">
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Widget ID</Label>
          <p className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-1.5 rounded break-all">
            {widget.id}
          </p>
        </div>
      </div>

      <div className="p-4 border-t border-border">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => {
            removeWidget(widget.id);
            selectWidget(null);
          }}
        >
          Remove Widget
        </Button>
      </div>
    </div>
  );
};

export default WidgetInspector;
