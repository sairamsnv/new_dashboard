import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { userGrowthData } from '@/data/mockData';
import type { WidgetConfig } from '@/types/dashboard';
import type { WmsSoPoFilterType } from '@/types/wms';
import { useWarehouseSoPoTrends } from '@/hooks/useWmsData';
import { getWmsApiBase } from '@/lib/wmsApi';
import WmsConfigHint from './WmsConfigHint';

interface LineChartWidgetProps {
  widget: WidgetConfig;
}

const LineChartWidget = ({ widget }: LineChartWidgetProps) => {
  const isWms = widget.dataSource === 'wms-so-po-lines';
  const orderType = ((widget.config?.soPoType as WmsSoPoFilterType) ?? 'all') as WmsSoPoFilterType;
  const fitYAxis = Boolean(widget.config?.fitYAxis);
  const showLegend = (widget.config?.showLegend as boolean | undefined) ?? true;
  const yDomain = fitYAxis ? (['dataMin', 'dataMax'] as [string, string]) : ([0, 'auto'] as [number, string]);
  const { data, isPending, error } = useWarehouseSoPoTrends(orderType, { enabled: isWms });

  if (isWms) {
    if (!getWmsApiBase()) return <WmsConfigHint />;
    if (isPending) {
      return <div className="h-full animate-pulse rounded-md bg-muted" />;
    }
    if (error) {
      return <div className="p-2 text-xs text-destructive">{error instanceof Error ? error.message : 'Error'}</div>;
    }
    return (
      <div className="h-full w-full pt-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="month"
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
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
            {orderType !== 'po' && (
              <Line
                type="monotone"
                dataKey="sales"
                name="Sales orders"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(var(--chart-1))' }}
                activeDot={{ r: 5 }}
              />
            )}
            {orderType !== 'so' && (
              <Line
                type="monotone"
                dataKey="purchases"
                name="Purchase orders"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(var(--chart-3))' }}
                activeDot={{ r: 5 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-full w-full pt-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={userGrowthData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
          <Line
            type="monotone"
            dataKey="users"
            name="Total Users"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={{ r: 3, fill: 'hsl(var(--chart-1))' }}
            activeDot={{ r: 5 }}
          />
          <Line
            type="monotone"
            dataKey="newUsers"
            name="New Users"
            stroke="hsl(var(--chart-3))"
            strokeWidth={2}
            dot={{ r: 3, fill: 'hsl(var(--chart-3))' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChartWidget;
