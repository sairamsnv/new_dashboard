import { TrendingUp, TrendingDown } from 'lucide-react';
import type { WidgetConfig } from '@/types/dashboard';
import {
  SCHEMA_KPI_COUNT_ALL,
  wmsKpiApiTitleForMetric,
  getWmsKpiMetricId,
  type SchemaAggregateOp,
} from '@/types/dashboard';
import { useWmsKpis } from '@/hooks/useWmsData';
import { useSchemaAggregateValue } from '@/hooks/useSchemaData';
import { getWmsApiBase } from '@/lib/wmsApi';
import WmsConfigHint from './WmsConfigHint';

interface KpiCardProps {
  widget: WidgetConfig;
}

const KpiCard = ({ widget }: KpiCardProps) => {
  const isSchemaKpi = widget.dataSource === 'schema-kpi';
  const isWms = widget.dataSource === 'wms-kpi';
  const timeframe = (widget.config?.timeframe as string) ?? 'today';
  const apiTitle = wmsKpiApiTitleForMetric(getWmsKpiMetricId(widget.config));
  const { data, isPending, error } = useWmsKpis(timeframe, { enabled: isWms });

  const schemaSlug = widget.config?.datasetSlug as string | undefined;
  const schemaOp = (widget.config?.aggregateOp as SchemaAggregateOp) || 'count';
  const rawSchemaCol = widget.config?.aggregateColumn as string | undefined;
  const columnForAggregate =
    schemaOp === 'count' && (!rawSchemaCol || rawSchemaCol === SCHEMA_KPI_COUNT_ALL)
      ? undefined
      : rawSchemaCol && rawSchemaCol !== SCHEMA_KPI_COUNT_ALL
        ? rawSchemaCol
        : undefined;

  const schemaQueryEnabled = Boolean(
    schemaSlug && (schemaOp === 'count' || Boolean(columnForAggregate)),
  );

  const {
    data: schemaValue,
    isPending: schemaPending,
    error: schemaError,
  } = useSchemaAggregateValue(schemaSlug, schemaOp, columnForAggregate, schemaQueryEnabled && isSchemaKpi);

  if (isSchemaKpi) {
    if (!getWmsApiBase()) return <WmsConfigHint />;
    if (!schemaSlug) {
      return (
        <div className="flex h-full flex-col justify-center p-2 text-center text-[11px] text-muted-foreground">
          Select a registered dataset in the widget panel.
        </div>
      );
    }
    if (schemaPending) {
      return (
        <div className="flex h-full flex-col justify-between p-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{widget.title}</p>
          <div className="h-8 animate-pulse rounded bg-muted" />
        </div>
      );
    }
    if (schemaError) {
      return (
        <div className="flex h-full flex-col justify-between p-1 text-xs text-destructive">
          <p className="font-medium uppercase tracking-wider">{widget.title}</p>
          <p className="leading-tight">{schemaError instanceof Error ? schemaError.message : 'Failed'}</p>
        </div>
      );
    }
    const tableHint = (widget.config?.datasetTable as string) || schemaSlug;
    return (
      <div className="flex h-full flex-col justify-between p-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{widget.title}</p>
        <div className="space-y-1">
          <p className="font-mono text-2xl font-bold tracking-tight text-foreground">
            {schemaValue != null ? String(schemaValue) : '—'}
          </p>
          <p className="text-[10px] text-muted-foreground leading-tight">
            {tableHint} · {schemaOp}
            {columnForAggregate ? ` · ${columnForAggregate}` : ''}
          </p>
        </div>
      </div>
    );
  }

  if (isWms) {
    if (!getWmsApiBase()) return <WmsConfigHint />;
    if (isPending) {
      return (
        <div className="flex h-full flex-col justify-between p-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{widget.title}</p>
          <div className="h-8 animate-pulse rounded bg-muted" />
        </div>
      );
    }
    if (error) {
      return (
        <div className="flex h-full flex-col justify-between p-1 text-xs text-destructive">
          <p className="font-medium uppercase tracking-wider">{widget.title}</p>
          <p className="leading-tight">{error instanceof Error ? error.message : 'Failed to load'}</p>
        </div>
      );
    }
    const row = data?.find(
      (k) => k.title.trim().toLowerCase() === apiTitle.trim().toLowerCase(),
    );
    const value = row != null ? String(row.value) : '—';
    return (
      <div className="flex h-full flex-col justify-between p-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{widget.title}</p>
        <div className="space-y-1">
          <p className="font-mono text-2xl font-bold tracking-tight text-foreground">{value}</p>
          <p className="text-[10px] text-muted-foreground">WMS · {timeframe}</p>
        </div>
      </div>
    );
  }

  const value = (widget.config?.value as string) || '—';
  const change = (widget.config?.change as number) || 0;
  const isPositive = change >= 0;

  return (
    <div className="flex flex-col justify-between h-full p-1">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {widget.title}
      </p>
      <div className="space-y-1">
        <p className="text-2xl font-bold tracking-tight text-foreground font-mono">
          {value}
        </p>
        <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-success' : 'text-destructive'}`}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          <span>{isPositive ? '+' : ''}{change}%</span>
          <span className="text-muted-foreground font-normal">vs last period</span>
        </div>
      </div>
    </div>
  );
};

export default KpiCard;
