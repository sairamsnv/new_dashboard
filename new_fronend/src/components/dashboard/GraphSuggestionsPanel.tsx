import { useEffect, useState } from 'react';
import {
  BarChart3, LineChart, PieChart, ScatterChart,
  Plus, RefreshCw, Sparkles, LayoutDashboard, CheckCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiProcessingLoader } from '@/components/ui/ai-processing-loader';
import { toast } from 'sonner';
import { fetchGraphSuggestions, pollAIJob } from '@/lib/schemaApi';
import type { GraphSuggestion } from '@/lib/schemaApi';
import { useDashboardStore } from '@/store/dashboardStore';

interface GraphSuggestionsPanelProps {
  datasetSlug: string;
}

const CHART_META: Record<string, {
  icon: React.ElementType;
  label: string;
  widgetType: 'bar-chart' | 'line-chart' | 'pie-chart';
  cardBg: string;
  iconBg: string;
  iconColor: string;
  border: string;
  hoverBorder: string;
  badge: string;
}> = {
  line_chart: {
    icon: LineChart, label: 'Line Chart', widgetType: 'line-chart',
    cardBg: 'bg-blue-500/[0.04]',
    iconBg: 'bg-blue-500/15 border-blue-500/25',
    iconColor: 'text-blue-400',
    border: 'border-blue-500/15',
    hoverBorder: 'hover:border-blue-500/35',
    badge: 'bg-blue-500/10 border-blue-500/25 text-blue-400',
  },
  bar_chart: {
    icon: BarChart3, label: 'Bar Chart', widgetType: 'bar-chart',
    cardBg: 'bg-[#6C63FF]/[0.04]',
    iconBg: 'bg-[#6C63FF]/15 border-[#6C63FF]/25',
    iconColor: 'text-[#6C63FF]',
    border: 'border-[#6C63FF]/15',
    hoverBorder: 'hover:border-[#6C63FF]/35',
    badge: 'bg-[#6C63FF]/10 border-[#6C63FF]/25 text-[#6C63FF]',
  },
  pie_chart: {
    icon: PieChart, label: 'Pie Chart', widgetType: 'pie-chart',
    cardBg: 'bg-[#20B2A0]/[0.04]',
    iconBg: 'bg-[#20B2A0]/15 border-[#20B2A0]/25',
    iconColor: 'text-[#20B2A0]',
    border: 'border-[#20B2A0]/15',
    hoverBorder: 'hover:border-[#20B2A0]/35',
    badge: 'bg-[#20B2A0]/10 border-[#20B2A0]/25 text-[#20B2A0]',
  },
  scatter_plot: {
    icon: ScatterChart, label: 'Scatter Plot', widgetType: 'bar-chart',
    cardBg: 'bg-amber-500/[0.04]',
    iconBg: 'bg-amber-500/15 border-amber-500/25',
    iconColor: 'text-amber-400',
    border: 'border-amber-500/15',
    hoverBorder: 'hover:border-amber-500/35',
    badge: 'bg-amber-500/10 border-amber-500/25 text-amber-400',
  },
  histogram: {
    icon: BarChart3, label: 'Histogram', widgetType: 'bar-chart',
    cardBg: 'bg-rose-500/[0.04]',
    iconBg: 'bg-rose-500/15 border-rose-500/25',
    iconColor: 'text-rose-400',
    border: 'border-rose-500/15',
    hoverBorder: 'hover:border-rose-500/35',
    badge: 'bg-rose-500/10 border-rose-500/25 text-rose-400',
  },
};

const DEFAULT_META = {
  icon: BarChart3, label: 'Chart', widgetType: 'bar-chart' as const,
  cardBg: 'bg-muted/5',
  iconBg: 'bg-muted/40 border-border/60',
  iconColor: 'text-muted-foreground',
  border: 'border-border/40',
  hoverBorder: 'hover:border-border/80',
  badge: 'bg-muted/30 border-border/60 text-muted-foreground',
};

export default function GraphSuggestionsPanel({ datasetSlug }: GraphSuggestionsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<GraphSuggestion[]>([]);
  const [error, setError] = useState('');
  const [added, setAdded] = useState<Set<number>>(new Set());
  const addWidget = useDashboardStore(s => s.addWidget);
  const updateWidget = useDashboardStore(s => s.updateWidget);

  const loadSuggestions = async () => {
    if (!datasetSlug) return;
    setLoading(true);
    setError('');
    setSuggestions([]);
    setAdded(new Set());
    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    try {
      const res = await fetchGraphSuggestions(datasetSlug);
      if (res.status === 'done' && res.result) { setSuggestions(res.result.suggestions); return; }
      if (res.job_id) {
        for (let attempt = 0; attempt < 60; attempt++) {
          const job = await pollAIJob(res.job_id);
          if (job.status === 'done' && job.result) {
            setSuggestions((job.result as { suggestions: GraphSuggestion[] }).suggestions || []);
            return;
          }
          if (job.status === 'error') throw new Error(job.error || 'Failed');
          await delay(2000);
        }
        throw new Error('Timed out');
      }
      setError('No chart job was started. Try Refresh.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (datasetSlug) loadSuggestions(); }, [datasetSlug]);

  const addToGrid = (suggestion: GraphSuggestion, idx: number) => {
    const meta = CHART_META[suggestion.chart_type] || DEFAULT_META;
    addWidget(meta.widgetType);
    setTimeout(() => {
      const { widgets } = useDashboardStore.getState();
      const last = widgets[widgets.length - 1];
      if (last) {
        updateWidget(last.id, {
          title: suggestion.title,
          dataSource: 'schema-data',
          config: { datasetSlug, xCol: suggestion.x_col, yCols: suggestion.y_cols },
        });
      }
    }, 50);
    setAdded(prev => new Set([...prev, idx]));
    toast.success(`"${suggestion.title}" added to dashboard`);
  };

  if (!datasetSlug) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#6C63FF]/10 border border-[#6C63FF]/20 shadow-xl shadow-[#6C63FF]/5">
          <BarChart3 className="h-10 w-10 text-[#6C63FF]/70" />
        </div>
        <div>
          <p className="font-semibold text-foreground">No dataset loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload a file first to get AI chart suggestions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-white/[0.06] glass px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#6C63FF]/15 border border-[#6C63FF]/20 shadow-sm shadow-[#6C63FF]/10">
              <Sparkles className="h-4 w-4 text-[#6C63FF]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Suggested Charts</h2>
              <p className="text-[11px] text-muted-foreground">
                {loading
                  ? 'AI is analyzing your data…'
                  : suggestions.length > 0
                    ? `${suggestions.length} suggestions for "${datasetSlug}"`
                    : datasetSlug}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {suggestions.length > 0 && (
              <span className="rounded-full border border-[#6C63FF]/25 bg-[#6C63FF]/10 px-2.5 py-0.5 text-[11px] font-medium text-[#6C63FF]">
                {suggestions.length} charts
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8 border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20 transition-all duration-200"
              onClick={loadSuggestions}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-6">
        {loading && <AiProcessingLoader variant="charts" className="h-full min-h-[400px]" />}

        {error && !loading && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] backdrop-blur-sm p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {!loading && suggestions.length === 0 && !error && (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-muted-foreground">No suggestions yet. Click Refresh to generate.</p>
          </div>
        )}

        {!loading && suggestions.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((s, i) => {
              const meta = CHART_META[s.chart_type] || DEFAULT_META;
              const Icon = meta.icon;
              const isAdded = added.has(i);

              return (
                <div
                  key={i}
                  className={[
                    'hover-lift glow-ring group relative flex flex-col overflow-hidden rounded-2xl border backdrop-blur-sm transition-all duration-200',
                    isAdded
                      ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                      : `${meta.border} ${meta.cardBg} ${meta.hoverBorder}`,
                  ].join(' ')}
                >
                  {/* Card top */}
                  <div className="flex items-start justify-between p-5 pb-3">
                    <div className="flex items-start gap-3">
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${meta.iconBg}`}>
                        <Icon className={`h-5 w-5 ${meta.iconColor}`} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold leading-tight text-foreground">{s.title}</p>
                        <p className={`mt-0.5 text-[11px] font-medium ${meta.iconColor}`}>{meta.label}</p>
                      </div>
                    </div>

                    {isAdded ? (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
                        <CheckCheck className="h-3 w-3" />
                        Added
                      </span>
                    ) : (
                      <Button
                        size="sm"
                        className={`h-7 gap-1 text-xs border rounded-lg transition-all duration-150 ${meta.badge} bg-opacity-100 hover:scale-[1.04] active:scale-95`}
                        variant="outline"
                        onClick={() => addToGrid(s, i)}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </Button>
                    )}
                  </div>

                  {/* Column badges */}
                  {(s.x_col || s.y_cols.length > 0) && (
                    <div className="flex flex-wrap items-center gap-1.5 px-5 pb-3">
                      {s.x_col && (
                        <span className="flex items-center gap-1 rounded-lg border border-white/8 bg-white/[0.04] px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                          <span className="text-[9px] font-bold text-[#6C63FF]/70">x</span>
                          {s.x_col}
                        </span>
                      )}
                      {s.y_cols.slice(0, 3).map(y => (
                        <span
                          key={y}
                          className={`flex items-center gap-1 rounded-lg border px-2 py-0.5 font-mono text-[10px] ${meta.border} ${meta.iconColor}/80 bg-white/[0.02]`}
                        >
                          <span className="text-[9px] font-bold">y</span>
                          {y}
                        </span>
                      ))}
                      {s.y_cols.length > 3 && (
                        <span className="text-[10px] text-muted-foreground">+{s.y_cols.length - 3} more</span>
                      )}
                    </div>
                  )}

                  {/* Insight text */}
                  {s.insight && (
                    <div className="mt-auto border-t border-white/[0.06] px-5 py-3">
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{s.insight}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer CTA */}
      {!loading && suggestions.length > 0 && (
        <div className="shrink-0 border-t border-white/[0.06] glass px-6 py-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {added.size > 0
                ? `${added.size} chart${added.size > 1 ? 's' : ''} added to dashboard`
                : 'Click Add on any chart to pin it to your dashboard'}
            </p>
            {added.size > 0 && (
              <Button
                size="sm"
                className="h-7 gap-1.5 text-xs bg-[#6C63FF] hover:bg-[#5b52e8] border-0 shadow-sm shadow-[#6C63FF]/25 transition-all duration-200"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                View Dashboard
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
