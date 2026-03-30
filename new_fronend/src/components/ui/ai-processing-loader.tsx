import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

const DEFAULT_STEPS_INSIGHTS = [
  'Reading column profiles…',
  'Detecting patterns in your data…',
  'Asking the AI model…',
  'Structuring trends & correlations…',
];

const DEFAULT_STEPS_CHARTS = [
  'Scanning numeric & categorical columns…',
  'Matching chart types to your data…',
  'Ranking the best visualizations…',
];

const DEFAULT_STEPS_UPLOAD = [
  'Uploading your file…',
  'Parsing rows & headers…',
  'Loading into the database…',
  'Profiling columns for the dashboard…',
];

const DEFAULT_STEPS_GENERIC = ['Working…', 'Almost there…', 'Finishing up…'];

export type AiLoaderVariant = 'insights' | 'charts' | 'upload' | 'generic';

interface AiProcessingLoaderProps {
  variant?: AiLoaderVariant;
  title?: string;
  subtitle?: string;
  steps?: string[];
  /** Smaller footprint for embedded areas (e.g. upload drop zone). */
  compact?: boolean;
  /** When set (0–100), shows a determinate progress bar instead of the shimmer. */
  progress?: number;
  className?: string;
}

export function AiProcessingLoader({
  variant = 'generic',
  title,
  subtitle,
  steps: stepsProp,
  compact = false,
  className,
}: AiProcessingLoaderProps) {
  const presetSteps =
    variant === 'insights'
      ? DEFAULT_STEPS_INSIGHTS
      : variant === 'charts'
        ? DEFAULT_STEPS_CHARTS
        : variant === 'upload'
          ? DEFAULT_STEPS_UPLOAD
          : DEFAULT_STEPS_GENERIC;

  const steps = stepsProp?.length ? stepsProp : presetSteps;

  const defaultTitle =
    variant === 'insights'
      ? 'Generating AI insights'
      : variant === 'charts'
        ? 'Building chart suggestions'
        : variant === 'upload'
          ? 'Processing your upload'
          : 'Please wait';

  const defaultSubtitle =
    variant === 'upload'
      ? 'This usually takes a few seconds — large files can take longer.'
      : 'The model runs on your Ollama server — first run may take a bit longer.';

  const [stepIndex, setStepIndex] = useState(0);

  const stepsKey = stepsProp ? stepsProp.join('|') : '';

  useEffect(() => {
    setStepIndex(0);
  }, [variant, stepsKey]);

  useEffect(() => {
    if (steps.length <= 1) return;
    const id = window.setInterval(() => {
      setStepIndex((i) => (i + 1) % steps.length);
    }, 2800);
    return () => window.clearInterval(id);
  }, [steps.length]);

  const subtitleLine = subtitle ?? (!compact ? defaultSubtitle : undefined);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        'flex w-full flex-col items-center justify-center px-4 py-8',
        compact ? 'min-h-[220px] py-6' : 'min-h-[min(72vh,560px)] px-6 py-12',
        className,
      )}
    >
      <div className={cn('relative w-full', compact ? 'max-w-sm' : 'max-w-md')}>
        {/* Glow */}
        <div
          className={cn(
            'pointer-events-none absolute inset-0 rounded-[2rem] bg-violet-500/15 blur-3xl',
            compact ? '-m-4' : '-m-8',
          )}
          aria-hidden
        />

        <div
          className={cn(
            'relative overflow-hidden rounded-3xl border border-border/60 bg-card/80 shadow-2xl shadow-black/20 backdrop-blur-md',
            compact ? 'p-5' : 'p-8',
          )}
        >
          {/* Spinner stack */}
          <div className={cn('flex justify-center', compact ? 'mb-5' : 'mb-8')}>
            <div className={cn('relative', compact ? 'h-16 w-16' : 'h-24 w-24')}>
              <div
                className="absolute inset-0 rounded-full border-2 border-violet-500/20"
                aria-hidden
              />
              <div
                className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-violet-500 border-r-indigo-500/80"
                style={{ animationDuration: '1.2s' }}
                aria-hidden
              />
              <div
                className="absolute inset-2 animate-spin rounded-full border-2 border-transparent border-b-indigo-400/60 border-l-violet-400/40"
                style={{ animationDuration: '1.8s', animationDirection: 'reverse' }}
                aria-hidden
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={cn(
                    'flex items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/25 to-indigo-600/20 shadow-inner',
                    compact ? 'h-9 w-9' : 'h-12 w-12',
                  )}
                >
                  <Sparkles
                    className={cn('text-violet-400', compact ? 'h-4 w-4' : 'h-6 w-6')}
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 text-center">
            <h3
              className={cn(
                'font-semibold tracking-tight text-foreground',
                compact ? 'text-sm' : 'text-lg',
              )}
            >
              {title ?? defaultTitle}
            </h3>
            {subtitleLine ? (
              <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>{subtitleLine}</p>
            ) : null}
          </div>

          {/* Progress: determinate (upload) or indeterminate shimmer */}
          <div className={cn(compact ? 'mt-4' : 'mt-8')}>
            {typeof progress === 'number' ? (
              <Progress value={Math.min(100, Math.max(0, progress))} className="h-2" />
            ) : (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/80">
                <div className="ai-loader-shimmer-bar h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-violet-500 to-transparent opacity-90" />
              </div>
            )}
          </div>

          {/* Cycling step */}
          <p
            className={cn(
              'text-center font-medium text-violet-400/95 transition-opacity duration-300',
              compact ? 'mt-3 min-h-[1.25rem] text-xs' : 'mt-6 min-h-[2.5rem] text-sm',
            )}
            key={stepIndex}
          >
            {steps[stepIndex]}
          </p>

          {!compact && (
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              You can leave this tab open — we&apos;ll update when it&apos;s ready.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
