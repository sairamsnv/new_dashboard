import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { revenueData } from '@/data/mockData';
import type { WidgetConfig } from '@/types/dashboard';
import { useWarehouseOpsTrend } from '@/hooks/useWmsData';
import { getWmsApiBase } from '@/lib/wmsApi';
import WmsConfigHint from './WmsConfigHint';

interface BarChartWidgetProps {
  widget: WidgetConfig;
}

const BarChartWidget = ({ widget }: BarChartWidgetProps) => {
  const isWms = widget.dataSource === 'wms-warehouse-ops-bar';
  const year = String((widget.config?.year as string) ?? new Date().getFullYear());
  const fitYAxis = Boolean(widget.config?.fitYAxis);
  const showLegend = (widget.config?.showLegend as boolean | undefined) ?? true;
  const yDomain = fitYAxis ? (['dataMin', 'dataMax'] as [string, string]) : ([0, 'auto'] as [number, string]);
  const { data, isPending, error } = useWarehouseOpsTrend(year, { enabled: isWms });

  if (isWms) {
    if (!getWmsApiBase()) return <WmsConfigHint />;
    if (isPending) {
      return <div className="h-full animate-pulse rounded-md bg-muted" />;
    }
    if (error) {
      return <div className="p-2 text-xs text-destructive">{error instanceof Error ? error.message : 'Error'}</div>;
    }
    const chartData = data ?? [];
    return (
      <div className="h-full w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickLine={false}
            />
            <YAxis
              domain={yDomain}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
                fontSize: 12,
                color: 'hsl(var(--foreground))',
              }}
            />
            {showLegend ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
            <Bar dataKey="picked" name="Picked" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="packed" name="Packed" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
            <Bar dataKey="received" name="Received" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-full w-full pt-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={revenueData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="month"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickLine={false}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              fontSize: 12,
              color: 'hsl(var(--foreground))',
            }}
          />
          {showLegend ? <Legend wrapperStyle={{ fontSize: 11 }} /> : null}
          <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
          <Bar dataKey="profit" name="Profit" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChartWidget;
