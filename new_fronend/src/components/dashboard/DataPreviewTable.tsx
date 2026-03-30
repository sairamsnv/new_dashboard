import { useEffect, useState } from 'react';
import { AlertCircle, Hash, Type, Calendar, ToggleLeft, HelpCircle, Database } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { AiProcessingLoader } from '@/components/ui/ai-processing-loader';
import { fetchSchemaInspect, previewData } from '@/lib/schemaApi';
import type { DataPreviewResponse, SchemaInspectColumn } from '@/lib/schemaApi';

interface DataPreviewTableProps {
  datasetSlug: string;
}

const DTYPE_CONFIG: Record<string, { label: string; bg: string; text: string; icon: React.ElementType }> = {
  numeric: { label: 'NUM', bg: 'bg-blue-500/15 border-blue-500/25', text: 'text-blue-400', icon: Hash },
  datetime: { label: 'DATE', bg: 'bg-emerald-500/15 border-emerald-500/25', text: 'text-emerald-400', icon: Calendar },
  text: { label: 'TEXT', bg: 'bg-violet-500/15 border-violet-500/25', text: 'text-violet-400', icon: Type },
  boolean: { label: 'BOOL', bg: 'bg-amber-500/15 border-amber-500/25', text: 'text-amber-400', icon: ToggleLeft },
  unknown: { label: '?', bg: 'bg-muted border-border', text: 'text-muted-foreground', icon: HelpCircle },
};

export default function DataPreviewTable({ datasetSlug }: DataPreviewTableProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<DataPreviewResponse | null>(null);
  const [columnMeta, setColumnMeta] = useState<Record<string, SchemaInspectColumn>>({});

  useEffect(() => {
    if (!datasetSlug) return;
    setLoading(true);
    setError('');
    Promise.all([previewData(datasetSlug, 100), fetchSchemaInspect(datasetSlug)])
      .then(([data, schema]) => {
        setPreview(data);
        const meta: Record<string, SchemaInspectColumn> = {};
        for (const col of schema.columns) meta[col.col_name] = col;
        setColumnMeta(meta);
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load preview'))
      .finally(() => setLoading(false));
  }, [datasetSlug]);

  if (!datasetSlug) {
    return (
      <div className="flex flex-col h-full items-center justify-center gap-4 p-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
          <Database className="h-8 w-8 text-muted-foreground/40" />
        </div>
        <div>
          <p className="font-medium text-foreground">No dataset loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload a file in the Upload tab to see a preview here.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <AiProcessingLoader
        variant="generic"
        title="Loading data preview"
        subtitle="Fetching rows and column types from your dataset."
        steps={['Connecting to the API…', 'Loading sample rows…', 'Reading column profiles…']}
        className="h-full min-h-[360px]"
      />
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-destructive p-8">
        <AlertCircle className="h-8 w-8 opacity-60" />
        <p className="text-sm text-center max-w-sm">{error}</p>
      </div>
    );
  }

  if (!preview || preview.columns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        No data available.
      </div>
    );
  }

  // Compute stats per dtype
  const dtypeCounts = preview.columns.reduce<Record<string, number>>((acc, col) => {
    const dtype = columnMeta[col]?.dtype || 'unknown';
    acc[dtype] = (acc[dtype] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="flex h-full flex-col">
      {/* Stats bar — glass */}
      <div className="shrink-0 border-b border-white/[0.06] glass px-6 py-4">
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Dataset</p>
            <p className="text-sm font-semibold font-mono text-[#6C63FF]">{datasetSlug}</p>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Rows (preview)</p>
            <p className="text-sm font-semibold">{preview.row_count.toLocaleString()}</p>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">Columns</p>
            <p className="text-sm font-semibold">{preview.columns.length}</p>
          </div>
          <div className="h-8 w-px bg-white/[0.06]" />
          <div className="flex items-center gap-2">
            {Object.entries(dtypeCounts).map(([dtype, count]) => {
              const cfg = DTYPE_CONFIG[dtype] || DTYPE_CONFIG.unknown;
              const Icon = cfg.icon;
              return (
                <span
                  key={dtype}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm ${cfg.bg} ${cfg.text}`}
                >
                  <Icon className="h-3 w-3" />
                  {count} {cfg.label}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full w-full">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10 bg-card/90 backdrop-blur-xl">
              <tr className="border-b border-border/80">
                <th className="w-10 border-r border-border/40 px-3 py-3 text-left font-medium text-muted-foreground/60">
                  #
                </th>
                {preview.columns.map((col) => {
                  const meta = columnMeta[col];
                  const cfg = DTYPE_CONFIG[meta?.dtype || 'unknown'];
                  const Icon = cfg.icon;
                  const nullPct = meta ? Math.round(meta.null_rate * 100) : 0;
                  return (
                    <th
                      key={col}
                      className="min-w-[120px] border-r border-border/40 px-3 py-2.5 text-left last:border-r-0"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`flex items-center gap-0.5 rounded border px-1 py-0.5 text-[9px] font-bold ${cfg.bg} ${cfg.text}`}>
                            <Icon className="h-2.5 w-2.5" />
                            {cfg.label}
                          </span>
                          <span className="font-semibold text-foreground/90 truncate max-w-[120px]">{col}</span>
                        </div>
                        {nullPct > 0 && (
                          <span className="text-[10px] text-red-400 font-medium">{nullPct}% null</span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map((row, ri) => (
                <tr key={ri} className={`border-b border-white/[0.04] transition-colors hover:bg-[#6C63FF]/[0.04] ${ri % 2 === 0 ? '' : 'bg-white/[0.015]'}`}>
                  <td className="border-r border-border/30 px-3 py-2 font-mono text-[10px] text-muted-foreground/50">
                    {ri + 1}
                  </td>
                  {(row as unknown[]).map((cell, ci) => (
                    <td key={ci} className="border-r border-border/30 px-3 py-2 last:border-r-0 max-w-[200px] truncate">
                      {cell === null || cell === undefined ? (
                        <span className="italic text-muted-foreground/40">null</span>
                      ) : (
                        <span className="text-foreground/80">{String(cell)}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}
