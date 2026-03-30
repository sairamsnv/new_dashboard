import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { WidgetConfig } from '@/types/dashboard';
import { useSchemaChartData } from '@/hooks/useSchemaChartData';

interface LineChartWidgetProps {
  widget: WidgetConfig;
}

const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const tooltipStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 'var(--radius)',
  fontSize: 12,
  color: 'hsl(var(--foreground))',
};

const LineChartWidget = ({ widget }: LineChartWidgetProps) => {
  const datasetSlug = widget.config?.datasetSlug as string | undefined;
  const xCol = widget.config?.xCol as string | undefined;
  const rawYCols = widget.config?.yCols;
  const yCols: string[] = Array.isArray(rawYCols) ? rawYCols : rawYCols ? [String(rawYCols)] : [];
  const fitYAxis = Boolean(widget.config?.fitYAxis);
  const showLegend = (widget.config?.showLegend as boolean | undefined) ?? true;
  const yDomain = fitYAxis ? (['dataMin', 'dataMax'] as [string, string]) : ([0, 'auto'] as [number, string]);

  const allCols = xCol ? [xCol, ...yCols.filter(c => c !== xCol)] : yCols;
  const { data, isPending, error } = useSchemaChartData(datasetSlug, allCols);

  if (!datasetSlug || !xCol || yCols.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Configure dataset, X and Y columns in the widget panel.
      </div>
    );
  }

  if (isPending) return <div className="h-full animate-pulse rounded-md bg-muted" />;

  if (error) {
    return (
      <div className="p-2 text-xs text-destructive">
        {error instanceof Error ? error.message : 'Error loading data'}
      </div>
    );
  }

  return (
    <div className="h-full w-full pt-1">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data ?? []} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey={xCol}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            tickLine={false}
          />
          <YAxis
            domain={yDomain}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 11 }} />}
          {yCols.map((col, i) => (
            <Line
              key={col}
              type="monotone"
              dataKey={col}
              name={col}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 2, fill: CHART_COLORS[i % CHART_COLORS.length] }}
              activeDot={{ r: 5 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default LineChartWidget;
