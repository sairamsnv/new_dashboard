import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { WidgetConfig } from '@/types/dashboard';
import { useSchemaChartData } from '@/hooks/useSchemaChartData';

interface PieChartWidgetProps {
  widget: WidgetConfig;
}

const COLORS = [
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

const PieChartWidget = ({ widget }: PieChartWidgetProps) => {
  const datasetSlug = widget.config?.datasetSlug as string | undefined;
  const xCol = widget.config?.xCol as string | undefined;   // name/category column
  const rawYCols = widget.config?.yCols;
  const yCols: string[] = Array.isArray(rawYCols) ? rawYCols : rawYCols ? [String(rawYCols)] : [];
  const valueCol = yCols[0];
  const showLegend = (widget.config?.showLegend as boolean | undefined) ?? true;

  const allCols = [xCol, valueCol].filter(Boolean) as string[];
  const { data, isPending, error } = useSchemaChartData(datasetSlug, allCols, 50);

  if (!datasetSlug || !xCol || !valueCol) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Configure dataset, label and value columns in the widget panel.
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

  const pieData = (data ?? []).map(row => ({
    name: String(row[xCol] ?? ''),
    value: Number(row[valueCol] ?? 0),
  }));

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="45%"
            innerRadius="35%"
            outerRadius="65%"
            paddingAngle={3}
            dataKey="value"
            nameKey="name"
          >
            {pieData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value: number, name: string) => [value, name]}
          />
          {showLegend && (
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PieChartWidget;
