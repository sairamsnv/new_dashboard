import { useCallback, useRef, useState } from 'react';
import {
  CloudUpload, Database, FileSpreadsheet, Loader2,
  CheckCircle2, AlertCircle, FileText, Zap, Shield, BarChart3,
  RefreshCw, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AiProcessingLoader } from '@/components/ui/ai-processing-loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { connectDatabase, pollIngestionJob, uploadFile } from '@/lib/schemaApi';
import type { DBConnectPayload } from '@/lib/schemaApi';

interface UploadSectionProps {
  onDatasetReady: (datasetSlug: string) => void;
  activeDatasetSlug?: string;  // passed from parent — used to restore lock state on page refresh
}

type UploadState = 'idle' | 'uploading' | 'processing' | 'done' | 'error';
type Mode = 'file' | 'database';

/** Once a source is connected this info describes what is locked in. */
interface ConnectedSource {
  mode: Mode;
  label: string;  // e.g. filename or DB connection name
}

/** Derive lock state from an existing dataset slug without needing stored state. */
function slugToConnectedSource(slug: string | undefined): ConnectedSource | null {
  if (!slug) return null;
  if (slug.startsWith('upload-')) return { mode: 'file',     label: slug };
  if (slug.startsWith('dbconn-')) return { mode: 'database', label: slug };
  // Legacy slugs (old format without prefix) — treat as file upload
  return { mode: 'file', label: slug };
}

const ACCEPTED_TYPES = '.csv,.xlsx,.xls';

const STEPS = [
  { step: '01', label: 'Upload', desc: 'Drop your CSV or Excel file' },
  { step: '02', label: 'Preview', desc: 'Review rows and column types' },
  { step: '03', label: 'Insights', desc: 'AI finds trends, correlations, outliers' },
  { step: '04', label: 'Charts', desc: 'Get smart chart suggestions' },
  { step: '05', label: 'Dashboard', desc: 'Build & save your custom layout' },
];

const FEATURES = [
  { icon: Zap,      label: 'Instant Profiling',    desc: 'Auto-detect column types, nulls, distributions' },
  { icon: BarChart3, label: 'AI Chart Suggestions', desc: 'Get smart visualizations from your data' },
  { icon: Shield,   label: 'Secure Processing',    desc: 'Data stays in your own infrastructure' },
];

export default function UploadSection({ onDatasetReady, activeDatasetSlug }: UploadSectionProps) {
  const [mode, setMode] = useState<Mode>('file');
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dbForm, setDbForm] = useState<DBConnectPayload>({
    name: '', engine: 'postgresql', host: 'localhost',
    port: 5432, db_name: '', schema_name: 'public', username: '', password: '',
  });
  const [dbConnecting, setDbConnecting] = useState(false);

  // Initialise from the active dataset slug so the lock survives page refreshes.
  const [connectedSource, setConnectedSource] = useState<ConnectedSource | null>(
    () => slugToConnectedSource(activeDatasetSlug)
  );

  /** Reset everything so the user can pick a different source. */
  const handleChangeSource = () => {
    setConnectedSource(null);
    setUploadState('idle');
    setProgress(0);
    setErrorMsg('');
    setDbForm({ name: '', engine: 'postgresql', host: 'localhost', port: 5432, db_name: '', schema_name: 'public', username: '', password: '' });
  };

  const handleFile = useCallback(async (file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      toast.error('Unsupported file type. Please upload CSV or Excel files.');
      return;
    }
    setUploadState('uploading');
    setProgress(20);
    setErrorMsg('');
    try {
      const { job_id } = await uploadFile(file);
      setProgress(50);
      setUploadState('processing');
      toast.info('File uploaded. Processing data…');
      const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
      for (let attempt = 0; attempt < 30; attempt++) {
        const job = await pollIngestionJob(job_id);
        if (job.status === 'done') {
          setProgress(100);
          setUploadState('done');
          const slug = (job.result as Record<string, string>)?.dataset_slug || '';
          toast.success(`Dataset ready!`);
          setConnectedSource({ mode: 'file', label: file.name });
          onDatasetReady(slug);
          return;
        }
        if (job.status === 'error') throw new Error(job.error_message || 'Processing failed');
        setProgress(50 + Math.min((attempt + 1) * 3, 45));
        await delay(2000);
      }
      throw new Error('Processing timed out. Please try again.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadState('error');
      setErrorMsg(msg);
      toast.error(msg);
    }
  }, [onDatasetReady]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDBConnect = async () => {
    if (!dbForm.name || !dbForm.host || !dbForm.db_name || !dbForm.username) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setDbConnecting(true);
    try {
      const res = await connectDatabase(dbForm);
      toast.success(res.message);
      if (res.tables_discovered.length > 0) {
        setConnectedSource({ mode: 'database', label: dbForm.name || dbForm.db_name });
        onDatasetReady(res.tables_discovered[0]);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setDbConnecting(false);
    }
  };

  return (
    <div className="flex min-h-full flex-col">

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-br from-[#6C63FF]/[0.08] via-background to-transparent px-8 py-10">
        <div className="pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-[#6C63FF]/8 blur-3xl" />
        <div className="pointer-events-none absolute right-16 top-8 h-48 w-48 rounded-full bg-indigo-500/5 blur-3xl" />

        <div className="relative max-w-2xl">
          {connectedSource ? (
            /* ── Locked / connected state ── */
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-0.5 text-[11px] font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </span>
                  <span className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] text-muted-foreground">
                    <Lock className="h-2.5 w-2.5" />
                    Source locked
                  </span>
                </div>
                <h1 className="mb-1 text-2xl font-bold tracking-tight text-foreground">
                  {connectedSource.mode === 'file' ? 'File connected' : 'Database connected'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground/70">
                    {connectedSource.label.replace(/^(upload-|dbconn-)/, '').slice(0, 40)}
                  </span>
                  {' '}is active. Use Preview, Insights, and Charts to explore your data.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangeSource}
                className="shrink-0 mt-1 gap-2 border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 hover:bg-white/[0.04]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Change source
              </Button>
            </div>
          ) : (
            /* ── Default: pick a source ── */
            <>
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full border border-[#6C63FF]/30 bg-[#6C63FF]/10 px-3 py-0.5 text-[11px] font-semibold text-[#6C63FF]">
                  Step 1
                </span>
              </div>
              <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground">Connect your data</h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-lg">
                Upload a CSV or Excel file, <strong className="text-foreground/60">or</strong> connect directly to your database.
                You can only use one source at a time.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-1 gap-0">
        {/* ── Left: form ── */}
        <div className="flex-1 p-8">

          {/* Mode toggle — hidden once a source is connected */}
          {!connectedSource && (
            <div className="mb-6 flex gap-1 rounded-xl border border-white/[0.06] bg-card/40 backdrop-blur-sm p-1 w-fit">
              {[
                { value: 'file' as Mode, icon: FileSpreadsheet, label: 'File Upload' },
                { value: 'database' as Mode, icon: Database, label: 'Database' },
              ].map(({ value, icon: Icon, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={[
                    'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200',
                    mode === value
                      ? 'bg-[#6C63FF]/20 text-[#6C63FF] shadow-sm border border-[#6C63FF]/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                  ].join(' ')}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* When connected, show a simple locked success card instead of forms */}
          {connectedSource && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] py-16">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/25">
                {connectedSource.mode === 'file'
                  ? <FileSpreadsheet className="h-8 w-8 text-emerald-400" />
                  : <Database className="h-8 w-8 text-emerald-400" />}
              </div>
              <div className="text-center">
                <p className="text-base font-semibold text-emerald-400">
                  {connectedSource.mode === 'file' ? 'File uploaded & ready' : 'Database connected & ready'}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Switch to <span className="font-medium text-foreground/70">Preview</span> to explore your data,
                  or <span className="font-medium text-foreground/70">Insights</span> for AI analysis.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleChangeSource}
                className="mt-2 gap-2 border-white/10 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Change data source
              </Button>
            </div>
          )}

          {!connectedSource && mode === 'file' && (
            <div className="space-y-4">
              {/* Drop zone */}
              <div
                className={[
                  'group relative flex min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed transition-all duration-300',
                  dragOver
                    ? 'drop-zone-active border-[#6C63FF] bg-[#6C63FF]/[0.06] scale-[1.01] shadow-lg shadow-[#6C63FF]/10'
                    : uploadState === 'done'
                      ? 'border-emerald-500/50 bg-emerald-500/[0.05]'
                      : uploadState === 'error'
                        ? 'border-red-500/40 bg-red-500/[0.04]'
                        : 'border-white/[0.1] bg-white/[0.01] hover:border-[#6C63FF]/40 hover:bg-[#6C63FF]/[0.03] hover:shadow-lg hover:shadow-[#6C63FF]/5',
                ].join(' ')}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => uploadState === 'idle' && fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPTED_TYPES}
                  className="sr-only"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />

                {uploadState === 'idle' && (
                  <div className="flex flex-col items-center gap-4 px-6 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#6C63FF]/15 border border-[#6C63FF]/25 group-hover:bg-[#6C63FF]/20 group-hover:border-[#6C63FF]/40 group-hover:scale-110 transition-all duration-300 shadow-lg shadow-[#6C63FF]/5">
                      <CloudUpload className="h-8 w-8 text-[#6C63FF]" />
                    </div>
                    <div>
                      <p className="text-base font-semibold text-foreground">Drop your file here</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">or click to browse files</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {['CSV', 'XLSX', 'XLS'].map((fmt) => (
                        <span key={fmt} className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-mono font-medium text-muted-foreground">
                          {fmt}
                        </span>
                      ))}
                      <span className="text-[11px] text-muted-foreground/60">· up to 500k rows</span>
                    </div>
                  </div>
                )}

                {(uploadState === 'uploading' || uploadState === 'processing') && (
                  <div
                    className="w-full max-w-md px-2"
                    onClick={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    <AiProcessingLoader
                      compact
                      variant="upload"
                      title={uploadState === 'uploading' ? 'Uploading your file' : 'Processing your data'}
                      subtitle={uploadState === 'uploading' ? 'Sending to the server…' : undefined}
                      progress={progress}
                      steps={
                        uploadState === 'uploading'
                          ? ['Preparing upload…', 'Sending to server…', 'Finishing upload…']
                          : ['Parsing file format…', 'Loading into PostgreSQL…', 'Profiling columns…']
                      }
                    />
                  </div>
                )}

                {uploadState === 'done' && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 border border-emerald-500/25">
                      <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                    </div>
                    <p className="text-base font-semibold text-emerald-400">Dataset ready!</p>
                    <p className="text-sm text-muted-foreground">Check the Preview tab to explore your data</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 border-emerald-500/25 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/40"
                      onClick={(e) => { e.stopPropagation(); setUploadState('idle'); setProgress(0); }}
                    >
                      Upload another file
                    </Button>
                  </div>
                )}

                {uploadState === 'error' && (
                  <div className="flex flex-col items-center gap-3 px-8 text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/12 border border-red-500/20">
                      <AlertCircle className="h-7 w-7 text-red-400" />
                    </div>
                    <p className="text-base font-semibold text-red-400">Upload failed</p>
                    <p className="max-w-xs text-sm text-muted-foreground">{errorMsg}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 border-red-500/25 text-red-400 hover:bg-red-500/10"
                      onClick={(e) => { e.stopPropagation(); setUploadState('idle'); setProgress(0); setErrorMsg(''); }}
                    >
                      Try again
                    </Button>
                  </div>
                )}
              </div>

              {/* Tip row */}
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm px-4 py-3">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/60">Tip:</span> Make sure the first row contains column headers.
                  Large files (100k+ rows) may take 30–60 seconds to process.
                </p>
              </div>
            </div>
          )}

          {!connectedSource && mode === 'database' && (
            <div className="rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-xl p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="conn-name" className="text-xs font-medium text-muted-foreground">Connection name *</Label>
                  <Input id="conn-name" placeholder="My Sales DB" value={dbForm.name}
                    onChange={(e) => setDbForm(f => ({ ...f, name: e.target.value }))}
                    className="h-9 border-white/10 bg-white/[0.04] focus:border-[#6C63FF]/40 transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Engine *</Label>
                  <Select value={dbForm.engine}
                    onValueChange={(v) => setDbForm(f => ({
                      ...f, engine: v as DBConnectPayload['engine'],
                      port: v === 'mysql' ? 3306 : v === 'mongodb' ? 27017 : 5432,
                    }))}>
                    <SelectTrigger className="h-9 border-white/10 bg-white/[0.04]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="postgresql">PostgreSQL</SelectItem>
                      <SelectItem value="mysql">MySQL</SelectItem>
                      <SelectItem value="mongodb">MongoDB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="conn-host" className="text-xs font-medium text-muted-foreground">Host *</Label>
                  <Input id="conn-host" placeholder="localhost" value={dbForm.host}
                    onChange={(e) => setDbForm(f => ({ ...f, host: e.target.value }))}
                    className="h-9 border-white/10 bg-white/[0.04] focus:border-[#6C63FF]/40 transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="conn-port" className="text-xs font-medium text-muted-foreground">Port *</Label>
                  <Input id="conn-port" type="number" value={dbForm.port}
                    onChange={(e) => setDbForm(f => ({ ...f, port: Number(e.target.value) }))}
                    className="h-9 border-white/10 bg-white/[0.04] focus:border-[#6C63FF]/40 transition-colors" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="conn-db" className="text-xs font-medium text-muted-foreground">Database name *</Label>
                  <Input id="conn-db" placeholder="my_database" value={dbForm.db_name}
                    onChange={(e) => setDbForm(f => ({ ...f, db_name: e.target.value }))}
                    className="h-9 border-white/10 bg-white/[0.04] focus:border-[#6C63FF]/40 transition-colors" />
                </div>
                {/* Schema name — PostgreSQL only; hidden for MySQL / MongoDB */}
                {dbForm.engine === 'postgresql' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="conn-schema" className="text-xs font-medium text-muted-foreground">
                      Schema
                      <span className="ml-1 text-muted-foreground/50">(PostgreSQL, default: public)</span>
                    </Label>
                    <Input
                      id="conn-schema"
                      placeholder="public"
                      value={dbForm.schema_name ?? 'public'}
                      onChange={(e) => setDbForm(f => ({ ...f, schema_name: e.target.value || 'public' }))}
                      className="h-9 border-white/10 bg-white/[0.04] focus:border-[#6C63FF]/40 transition-colors font-mono"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="conn-user" className="text-xs font-medium text-muted-foreground">Username *</Label>
                  <Input id="conn-user" placeholder="admin" value={dbForm.username}
                    onChange={(e) => setDbForm(f => ({ ...f, username: e.target.value }))}
                    className="h-9 border-white/10 bg-white/[0.04] focus:border-[#6C63FF]/40 transition-colors" />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="conn-pass" className="text-xs font-medium text-muted-foreground">Password</Label>
                  <Input id="conn-pass" type="password" placeholder="••••••••" value={dbForm.password}
                    onChange={(e) => setDbForm(f => ({ ...f, password: e.target.value }))}
                    className="h-9 border-white/10 bg-white/[0.04] focus:border-[#6C63FF]/40 transition-colors" />
                </div>
              </div>
              <Button
                className="w-full gap-2 h-10 font-semibold bg-[#6C63FF] hover:bg-[#5b52e8] border-0 shadow-md shadow-[#6C63FF]/25 hover:shadow-[#6C63FF]/40 transition-all duration-200"
                onClick={handleDBConnect}
                disabled={dbConnecting}
              >
                {dbConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {dbConnecting ? 'Connecting…' : 'Test & Connect'}
              </Button>
            </div>
          )}
        </div>

        {/* ── Right: workflow steps ── */}
        <div className="hidden xl:flex w-80 shrink-0 flex-col gap-5 border-l border-white/[0.06] bg-card/20 backdrop-blur-sm p-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/60">What happens next</p>
          <div className="space-y-1">
            {STEPS.map(({ step, label, desc }) => (
              <div key={step} className="hover-lift group flex items-start gap-3.5 rounded-xl p-2.5 cursor-default hover:bg-white/[0.03] transition-colors">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#6C63FF]/12 border border-[#6C63FF]/20 text-[10px] font-bold text-[#6C63FF]">
                  {step}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground/80">{label}</p>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-auto space-y-3 pt-4 border-t border-white/[0.06]">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03]">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
                </div>
                <div>
                  <p className="text-xs font-medium text-foreground/70">{label}</p>
                  <p className="text-[11px] text-muted-foreground/60">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
