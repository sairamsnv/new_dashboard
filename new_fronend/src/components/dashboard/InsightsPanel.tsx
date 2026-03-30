import { useEffect, useState } from 'react';
import {
  TrendingUp, GitBranch, AlertTriangle,
  RefreshCw, Sparkles, Brain, ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiProcessingLoader } from '@/components/ui/ai-processing-loader';
import { fetchInsights, pollAIJob } from '@/lib/schemaApi';
import type { AIInsightsResponse } from '@/lib/schemaApi';

interface InsightsPanelProps {
  datasetSlug: string;
}

type InsightsResult = NonNullable<AIInsightsResponse['result']>;

export default function InsightsPanel({ datasetSlug }: InsightsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<InsightsResult | null>(null);
  const [error, setError] = useState('');

  const loadInsights = async () => {
    if (!datasetSlug) return;
    setLoading(true);
    setError('');
    setInsights(null);
    const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
    try {
      const res = await fetchInsights(datasetSlug);
      if (res.status === 'done' && res.result) { setInsights(res.result); return; }
      if (res.job_id) {
        for (let attempt = 0; attempt < 60; attempt++) {
          const job = await pollAIJob(res.job_id);
          if (job.status === 'done' && job.result) { setInsights(job.result as InsightsResult); return; }
          if (job.status === 'error') throw new Error(job.error || 'AI insight generation failed');
          await delay(2000);
        }
        throw new Error('Insight generation timed out');
      }
      setError('No job was started for insights. Try Regenerate.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (datasetSlug) loadInsights(); }, [datasetSlug]);

  if (!datasetSlug) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 p-12 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#6C63FF]/10 border border-[#6C63FF]/20 shadow-xl shadow-[#6C63FF]/5">
          <Brain className="h-10 w-10 text-[#6C63FF]/70" />
        </div>
        <div>
          <p className="font-semibold text-foreground">No dataset loaded</p>
          <p className="mt-1 text-sm text-muted-foreground">Upload a file first to generate AI insights.</p>
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
              <Sparkles className="h-4.5 w-4.5 text-[#6C63FF]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">AI Insights</h2>
              <p className="text-[11px] text-muted-foreground">{datasetSlug}</p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs h-8 border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20 transition-all duration-200"
            onClick={loadInsights}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {loading && <AiProcessingLoader variant="insights" className="h-full min-h-[400px]" />}

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] backdrop-blur-sm p-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {insights && (
          <div className="space-y-8">

            {/* Summary hero — glass card with purple glow */}
            {insights.summary && (
              <div className="relative overflow-hidden rounded-2xl border border-[#6C63FF]/20 bg-gradient-to-br from-[#6C63FF]/[0.08] via-card/60 to-transparent backdrop-blur-xl p-6 shadow-lg shadow-[#6C63FF]/5">
                {/* ambient glow blob */}
                <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#6C63FF]/15 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-4 left-8 h-20 w-20 rounded-full bg-indigo-500/10 blur-2xl" />

                <div className="relative flex items-start gap-4">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#6C63FF]/20 border border-[#6C63FF]/25 shadow-sm">
                    <Brain className="h-5.5 w-5.5 text-[#6C63FF]" />
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[#6C63FF]">Summary</p>
                    <p className="text-sm leading-relaxed text-foreground/80">{insights.summary}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 3-column grid */}
            <div className="grid gap-5 lg:grid-cols-3">

              {/* ── Trends ── */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/12 border border-emerald-500/20">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Top Trends
                    <span className="ml-1.5 text-emerald-400">({insights.trends.length})</span>
                  </p>
                </div>
                <div className="space-y-2">
                  {insights.trends.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground italic">No trends detected</p>
                  ) : insights.trends.map((trend, i) => (
                    <div
                      key={i}
                      className="hover-lift group flex items-start gap-3 rounded-xl border border-white/[0.06] bg-card/60 backdrop-blur-sm p-3 cursor-default hover:border-emerald-500/25 hover:bg-emerald-500/[0.04]"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
                        {i + 1}
                      </span>
                      <p className="text-xs leading-relaxed text-foreground/75">{trend}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Correlations ── */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#6C63FF]/12 border border-[#6C63FF]/20">
                    <GitBranch className="h-3.5 w-3.5 text-[#6C63FF]" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Correlations
                    <span className="ml-1.5 text-[#6C63FF]">({insights.correlations.length})</span>
                  </p>
                </div>
                <div className="space-y-2">
                  {insights.correlations.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground italic">No correlations found</p>
                  ) : insights.correlations.map((corr, i) => (
                    <div
                      key={i}
                      className="hover-lift rounded-xl border border-white/[0.06] bg-card/60 backdrop-blur-sm p-3 hover:border-[#6C63FF]/25 hover:bg-[#6C63FF]/[0.04] cursor-default"
                    >
                      <div className="mb-2 flex items-center gap-1.5 flex-wrap">
                        <span className="rounded-lg border border-[#20B2A0]/25 bg-[#20B2A0]/10 px-2 py-0.5 font-mono text-[10px] font-medium text-[#20B2A0]">
                          {corr.col_a}
                        </span>
                        <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                        <span className="rounded-lg border border-[#6C63FF]/25 bg-[#6C63FF]/10 px-2 py-0.5 font-mono text-[10px] font-medium text-[#6C63FF]">
                          {corr.col_b}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-muted-foreground">{corr.description}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* ── Outliers ── */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 px-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/12 border border-amber-500/20">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                    Outliers
                    <span className="ml-1.5 text-amber-400">({insights.outliers.length})</span>
                  </p>
                </div>
                <div className="space-y-2">
                  {insights.outliers.length === 0 ? (
                    <p className="px-1 text-xs text-muted-foreground italic">No outliers detected</p>
                  ) : insights.outliers.map((item, i) => (
                    <div
                      key={i}
                      className="hover-lift flex items-start gap-2.5 rounded-xl border border-amber-500/18 bg-amber-500/[0.05] backdrop-blur-sm p-3 cursor-default hover:border-amber-500/30 hover:bg-amber-500/[0.08]"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                      <p className="text-xs leading-relaxed text-amber-200/70">{item}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
