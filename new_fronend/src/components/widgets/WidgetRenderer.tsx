import { memo } from 'react';
import type { WidgetConfig } from '@/types/dashboard';
import KpiCard from './KpiCard';
import BarChartWidget from './BarChartWidget';
import LineChartWidget from './LineChartWidget';
import PieChartWidget from './PieChartWidget';
import TableWidget from './TableWidget';
import PredictionTableWidget from './PredictionTableWidget';
import InsightsTableWidget from './InsightsTableWidget';

interface WidgetRendererProps {
  widget: WidgetConfig;
}

const WidgetRenderer = memo(({ widget }: WidgetRendererProps) => {
  switch (widget.type) {
    case 'kpi-card':
      return <KpiCard widget={widget} />;
    case 'bar-chart':
      return <BarChartWidget widget={widget} />;
    case 'line-chart':
      return <LineChartWidget widget={widget} />;
    case 'pie-chart':
      return <PieChartWidget widget={widget} />;
    case 'table':
      return <TableWidget widget={widget} />;
    case 'prediction-table':
      return <PredictionTableWidget widget={widget} />;
    case 'insights-table':
      return <InsightsTableWidget widget={widget} />;
    default:
      return <div className="flex items-center justify-center h-full text-muted-foreground">Unknown widget</div>;
  }
});

WidgetRenderer.displayName = 'WidgetRenderer';

export default WidgetRenderer;
