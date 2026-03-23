import { insightsTableData } from '@/data/mockData';
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
import { useWmsInsights } from '@/hooks/useWmsData';
import { getWmsApiBase } from '@/lib/wmsApi';
import WmsConfigHint from './WmsConfigHint';

interface InsightsTableWidgetProps {
  widget: WidgetConfig;
}

const priorityVariant = (priority: string) => {
  const p = priority?.toLowerCase?.() ?? '';
  if (p === 'high') return 'destructive';
  if (p === 'medium') return 'secondary';
  return 'outline';
};

const mockPriorityVariant = (priority: string) => {
  switch (priority) {
    case 'High':
      return 'destructive';
    case 'Medium':
      return 'secondary';
    default:
      return 'outline';
  }
};

const InsightsTableWidget = ({ widget }: InsightsTableWidgetProps) => {
  const isWms = widget.dataSource === 'wms-insights-table';
  const period = (widget.config?.insightsPeriod as string) ?? 'this month';
  const { data, isPending, error } = useWmsInsights(period, { enabled: isWms });

  if (isWms) {
    if (!getWmsApiBase()) return <WmsConfigHint />;
    if (isPending) {
      return <div className="h-full animate-pulse rounded-md bg-muted" />;
    }
    if (error) {
      return <div className="p-2 text-xs text-destructive">{error instanceof Error ? error.message : 'Error'}</div>;
    }
    const recs = data?.recommendations ?? [];
    const label = data?.period ?? period;
    return (
      <div className="h-full w-full overflow-auto">
        <p className="mb-2 px-1 text-[10px] uppercase tracking-wider text-muted-foreground">WMS insights · {label}</p>
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
                Insight
              </TableHead>
              <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
                Type
              </TableHead>
              <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
                Priority
              </TableHead>
              <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
                Message
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recs.map((row, i) => (
              <TableRow key={`${row.title}-${i}`}>
                <TableCell className="px-3 py-2.5 font-medium">{row.title}</TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">{row.type}</TableCell>
                <TableCell className="px-3 py-2.5">
                  <Badge variant={priorityVariant(row.priority) as any} className="text-[10px] capitalize">
                    {row.priority}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[280px] px-3 py-2.5 text-muted-foreground">{row.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {recs.length === 0 && (
          <p className="p-4 text-center text-muted-foreground">No recommendations for this period.</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <Table className="text-xs">
        <TableHeader>
          <TableRow>
            <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
              Insight
            </TableHead>
            <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
              Category
            </TableHead>
            <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
              Owner
            </TableHead>
            <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
              Priority
            </TableHead>
            <TableHead className="h-9 px-3 text-[10px] font-semibold uppercase tracking-[0.18em]">
              Recommendation
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {insightsTableData.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="px-3 py-2.5 font-medium">{row.title}</TableCell>
              <TableCell className="px-3 py-2.5 text-muted-foreground">{row.category}</TableCell>
              <TableCell className="px-3 py-2.5 text-muted-foreground">{row.owner}</TableCell>
              <TableCell className="px-3 py-2.5">
                <Badge variant={mockPriorityVariant(row.priority) as any} className="text-[10px]">
                  {row.priority}
                </Badge>
              </TableCell>
              <TableCell className="px-3 py-2.5 text-muted-foreground">{row.recommendation}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default InsightsTableWidget;
