import type { WidgetConfig } from '@/types/dashboard';
import { useSchemaChartData } from '@/hooks/useSchemaChartData';

interface TableWidgetProps {
  widget: WidgetConfig;
}

const TableWidget = ({ widget }: TableWidgetProps) => {
  const datasetSlug = widget.config?.datasetSlug as string | undefined;
  const rawCols = widget.config?.columns ?? widget.config?.yCols;
  const columns: string[] = Array.isArray(rawCols)
    ? rawCols
    : rawCols
    ? [String(rawCols)]
    : [];
  const limit = Number(widget.config?.limit ?? 100);

  const { data, isPending, error } = useSchemaChartData(datasetSlug, columns, limit);

  if (!datasetSlug || columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
        Configure dataset and columns in the widget panel.
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

  const rows = data ?? [];

  return (
    <div className="h-full w-full overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col}
                className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={idx}
              className="border-b border-border/50 transition-colors hover:bg-muted/50"
            >
              {columns.map((col) => (
                <td key={col} className="px-3 py-2 text-muted-foreground">
                  {String(row[col] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <p className="p-4 text-center text-muted-foreground">No data found.</p>
      )}
    </div>
  );
};

export default TableWidget;
