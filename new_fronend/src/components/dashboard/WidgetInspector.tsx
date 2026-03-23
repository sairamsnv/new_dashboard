import { useState } from 'react';
import { X } from 'lucide-react';
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
import type { WmsOrdersFilterType, WmsSoPoFilterType } from '@/types/wms';

const TIMEFRAME_OPTIONS = ['today', 'yesterday', 'this week', 'this month'] as const;

const INSIGHTS_PERIOD_OPTIONS = ['this week', 'this month', 'last month', 'this quarter'] as const;

const datasetSelectValue = (dataSource: string | undefined) =>
  dataSource && dataSource !== '' ? dataSource : SAMPLE_DATASET_VALUE;

const WidgetInspector = () => {
  const {
    widgets,
    layouts,
    selectedWidgetId,
    selectWidget,
    updateWidget,
    updateWidgetLayout,
    removeWidget,
    setWidgetType,
  } = useDashboardStore();
  const widget = widgets.find((w) => w.id === selectedWidgetId);
  const [descOpen, setDescOpen] = useState(false);

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
  const typeInfo = WIDGET_TYPES.find((t) => t.type === widget.type);
  const layoutEntry = layouts.find((l) => l.i === widget.id);
  const minW = layoutEntry?.minW ?? typeInfo?.minW ?? 1;
  const minH = layoutEntry?.minH ?? typeInfo?.minH ?? 1;
  const safeDim = (n: unknown, fallback: number) => {
    const v = Number(n);
    return Number.isFinite(v) ? Math.round(v) : fallback;
  };
  const gridW = safeDim(layoutEntry?.w, typeInfo?.defaultW ?? 6);
  const gridH = safeDim(layoutEntry?.h, typeInfo?.defaultH ?? 4);
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

        <div className="space-y-2">
          <Label className="text-xs">Size on dashboard</Label>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Wider = more columns; taller = more rows. Drag the right or left edge to change width, the
            bottom edge for height, or the bottom-right corner for both.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label htmlFor="widget-grid-w" className="text-[10px] text-muted-foreground">
                Width (columns)
              </Label>
              <Input
                id="widget-grid-w"
                type="number"
                min={minW}
                max={12}
                value={gridW}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isNaN(v)) return;
                  updateWidgetLayout(widget.id, { w: v });
                }}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="widget-grid-h" className="text-[10px] text-muted-foreground">
                Height (rows)
              </Label>
              <Input
                id="widget-grid-h"
                type="number"
                min={minH}
                max={48}
                value={gridH}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  if (Number.isNaN(v)) return;
                  updateWidgetLayout(widget.id, { h: v });
                }}
                className="h-8 text-sm"
              />
            </div>
          </div>
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

        {widget.type === 'bar-chart' && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs">Year (WMS warehouse trend)</Label>
              <Input
                value={String((widget.config?.year as string) ?? new Date().getFullYear())}
                onChange={(e) => patchConfig({ year: e.target.value })}
                className="h-8 text-sm font-mono"
              />
            </div>
          </>
        )}

        {widget.type === 'line-chart' && (
          <>
            <Separator />
            <div className="space-y-2">
              <Label className="text-xs">Series · sales vs purchase</Label>
              <Select
                value={((widget.config?.soPoType as WmsSoPoFilterType) ?? 'all') as string}
                onValueChange={(v) => patchConfig({ soPoType: v as WmsSoPoFilterType })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Both (SO + PO)</SelectItem>
                  <SelectItem value="so">Sales orders only</SelectItem>
                  <SelectItem value="po">Purchase orders only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {widget.type === 'pie-chart' && (
          <>
            <Separator />
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
          </>
        )}

        {widget.type === 'table' && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Order list</Label>
                <Select
                  value={((widget.config?.orderType as WmsOrdersFilterType) ?? 'picked') as string}
                  onValueChange={(v) => patchConfig({ orderType: v as WmsOrdersFilterType })}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="picked">Picked</SelectItem>
                    <SelectItem value="packed">Packed</SelectItem>
                    <SelectItem value="received">Received</SelectItem>
                  </SelectContent>
                </Select>
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
