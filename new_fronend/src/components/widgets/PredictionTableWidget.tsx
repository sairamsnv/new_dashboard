import { predictionTableData } from '@/data/mockData';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WidgetConfig } from '@/types/dashboard';

interface PredictionTableWidgetProps {
  widget: WidgetConfig;
}

const impactVariant = (impact: string) => {
  switch (impact) {
    case 'High':
      return 'destructive';
    case 'Medium':
      return 'secondary';
    default:
      return 'outline';
  }
};

const PredictionTableWidget = ({ widget }: PredictionTableWidgetProps) => {
  return (
    <div className="h-full w-full overflow-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
              Metric
            </TableHead>
            <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
              Forecast
            </TableHead>
            <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
              Confidence
            </TableHead>
            <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
              Horizon
            </TableHead>
            <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
              Impact
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {predictionTableData.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="px-3 py-2.5 font-medium">{row.metric}</TableCell>
              <TableCell className="px-3 py-2.5 font-mono text-foreground">{row.forecast}</TableCell>
              <TableCell className="px-3 py-2.5 font-mono text-muted-foreground">{row.confidence}</TableCell>
              <TableCell className="px-3 py-2.5 text-muted-foreground">{row.horizon}</TableCell>
              <TableCell className="px-3 py-2.5">
                <Badge variant={impactVariant(row.impact) as any} className="text-[10px]">
                  {row.impact}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default PredictionTableWidget;
