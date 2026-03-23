import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { trafficSourceData } from '@/data/mockData';
import type { WidgetConfig } from '@/types/dashboard';
import { useEmployeePerformance } from '@/hooks/useWmsData';
import { getWmsApiBase } from '@/lib/wmsApi';
import WmsConfigHint from './WmsConfigHint';

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

const PieChartWidget = ({ widget }: PieChartWidgetProps) => {
  const isWms = widget.dataSource === 'wms-employee-pie';
  const timeframe = (widget.config?.timeframe as string) ?? 'today';
  const showLegend = (widget.config?.showLegend as boolean | undefined) ?? true;
  const { data, isPending, error } = useEmployeePerformance(timeframe, { enabled: isWms });

  if (isWms) {
    if (!getWmsApiBase()) return <WmsConfigHint />;
    if (isPending) {
      return <div className="h-full animate-pulse rounded-md bg-muted" />;
    }
    if (error) {
      return <div className="p-2 text-xs text-destructive">{error instanceof Error ? error.message : 'Error'}</div>;
    }
    const pieData = data?.pie_data ?? [];
    return (
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="45%"
              innerRadius="40%"
              outerRadius="70%"
              paddingAngle={3}
              dataKey="value"
              nameKey="name"
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${entry.name}-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
                fontSize: 12,
                color: 'hsl(var(--foreground))',
              }}
              formatter={(value: number) => [`${value}%`, 'Share']}
            />
            {showLegend ? (
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
              />
            ) : null}
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={trafficSourceData}
            cx="50%"
            cy="45%"
            innerRadius="40%"
            outerRadius="70%"
            paddingAngle={3}
            dataKey="value"
          >
            {trafficSourceData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 'var(--radius)',
              fontSize: 12,
              color: 'hsl(var(--foreground))',
            }}
          />
          {showLegend ? (
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
            />
          ) : null}
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PieChartWidget;
