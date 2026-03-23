import { transactionsData } from '@/data/mockData';
import type { WidgetConfig } from '@/types/dashboard';
import type { WmsOrdersFilterType } from '@/types/wms';
import { Badge } from '@/components/ui/badge';
import { useWmsOrders } from '@/hooks/useWmsData';
import { getWmsApiBase } from '@/lib/wmsApi';
import WmsConfigHint from './WmsConfigHint';

interface TableWidgetProps {
  widget: WidgetConfig;
}

const statusVariant = (status: string) => {
  switch (status) {
    case 'Completed': return 'default';
    case 'Pending': return 'secondary';
    case 'Failed': return 'destructive';
    default: return 'outline';
  }
};

const TableWidget = ({ widget }: TableWidgetProps) => {
  const isWms = widget.dataSource === 'wms-orders-table';
  const timeframe = (widget.config?.timeframe as string) ?? 'today';
  const orderFilter = ((widget.config?.orderType as WmsOrdersFilterType) ?? 'picked') as WmsOrdersFilterType;
  const ordersQuery = useWmsOrders(orderFilter, timeframe, { enabled: isWms });

  if (isWms) {
    if (!getWmsApiBase()) return <WmsConfigHint />;
    const { data, isPending, error } = ordersQuery;

    if (isPending) {
      return <div className="h-full animate-pulse rounded-md bg-muted" />;
    }
    if (error) {
      return <div className="p-2 text-xs text-destructive">{error instanceof Error ? error.message : 'Error'}</div>;
    }

    if (orderFilter === 'received') {
      const rows = data?.results ?? [];
      return (
        <div className="h-full w-full overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Tran</th>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Supplier</th>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Received by</th>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Date</th>
                <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Location</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 transition-colors hover:bg-muted/50">
                  <td className="px-3 py-2 font-mono text-muted-foreground">{row.tranId}</td>
                  <td className="px-3 py-2 font-medium">{row.supplier}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.receivedBy}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.createdDate}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.location}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <p className="p-4 text-center text-muted-foreground">No received orders for this period.</p>
          )}
        </div>
      );
    }

    const rows = data?.results ?? [];
    return (
      <div className="h-full w-full overflow-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Document</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Customer</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Picker</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Packer</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.documentNumber}-${row.dateCreated}`}
                className="border-b border-border/50 transition-colors hover:bg-muted/50"
              >
                <td className="px-3 py-2 font-mono text-muted-foreground">{row.documentNumber}</td>
                <td className="px-3 py-2 font-medium">{row.customer}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.picker}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.packer}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.dateCreated}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && (
          <p className="p-4 text-center text-muted-foreground">No orders for this period.</p>
        )}
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wider">ID</th>
            <th className="text-left py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
            <th className="text-left py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
            <th className="text-left py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
            <th className="text-left py-2 px-3 font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
          </tr>
        </thead>
        <tbody>
          {transactionsData.map((row) => (
            <tr key={row.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
              <td className="py-2 px-3 font-mono text-muted-foreground">{row.id}</td>
              <td className="py-2 px-3 font-medium">{row.customer}</td>
              <td className="py-2 px-3 font-mono">{row.amount}</td>
              <td className="py-2 px-3">
                <Badge variant={statusVariant(row.status) as any} className="text-[10px]">
                  {row.status}
                </Badge>
              </td>
              <td className="py-2 px-3 text-muted-foreground">{row.date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableWidget;
