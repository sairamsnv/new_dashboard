import { BarChart3, LineChart, PieChart, Table, TrendingUp, Plus, Brain, Lightbulb } from 'lucide-react';
import { useDashboardStore } from '@/store/dashboardStore';
import type { WidgetType } from '@/types/dashboard';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const widgetIcons: Record<WidgetType, React.ReactNode> = {
  'kpi-card': <TrendingUp className="h-4 w-4" />,
  'bar-chart': <BarChart3 className="h-4 w-4" />,
  'line-chart': <LineChart className="h-4 w-4" />,
  'pie-chart': <PieChart className="h-4 w-4" />,
  'table': <Table className="h-4 w-4" />,
  'prediction-table': <Brain className="h-4 w-4" />,
  'insights-table': <Lightbulb className="h-4 w-4" />,
};

const widgetLabels: Record<WidgetType, string> = {
  'kpi-card': 'KPI Card',
  'bar-chart': 'Bar Chart',
  'line-chart': 'Line Chart',
  'pie-chart': 'Pie Chart',
  'table': 'Data Table',
  'prediction-table': 'Prediction Table',
  'insights-table': 'Insights Table',
};

const WidgetToolbar = () => {
  const { addWidget } = useDashboardStore();

  const types: WidgetType[] = [
    'kpi-card',
    'bar-chart',
    'line-chart',
    'pie-chart',
    'table',
    'prediction-table',
    'insights-table',
  ];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Add Widget
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {types.map((type) => (
          <DropdownMenuItem
            key={type}
            onClick={() => addWidget(type)}
            className="gap-3 cursor-pointer"
          >
            {widgetIcons[type]}
            <span>{widgetLabels[type]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default WidgetToolbar;
