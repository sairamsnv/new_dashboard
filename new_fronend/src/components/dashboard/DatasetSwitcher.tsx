import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Database,
  FileSpreadsheet,
  ChevronDown,
  Check,
  RefreshCw,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetchSchemaDatasets } from '@/lib/schemaApi';
import type { SchemaDatasetRow } from '@/lib/schemaApi';

interface DatasetSwitcherProps {
  activeSlug: string;
  onSelect: (slug: string) => void;
}

function groupDatasets(datasets: SchemaDatasetRow[]) {
  const db: SchemaDatasetRow[] = [];
  const files: SchemaDatasetRow[] = [];
  const other: SchemaDatasetRow[] = [];
  for (const d of datasets) {
    if (d.slug.startsWith('dbconn-')) db.push(d);
    else if (d.slug.startsWith('upload-')) files.push(d);
    else other.push(d);
  }
  return { db, files, other };
}

/** Trim slug prefix and truncate for display */
function displayLabel(d: SchemaDatasetRow): string {
  return d.name || d.slug.replace(/^(dbconn-|upload-)/, '').replace(/-/g, ' ');
}

export default function DatasetSwitcher({ activeSlug, onSelect }: DatasetSwitcherProps) {
  const [open, setOpen] = useState(false);

  const { data: datasets = [], isFetching, refetch } = useQuery({
    queryKey: ['schema-datasets'],
    queryFn: fetchSchemaDatasets,
    staleTime: 30_000,
  });

  const active = datasets.find(d => d.slug === activeSlug);
  const { db, files, other } = groupDatasets(datasets);

  const isDB = activeSlug.startsWith('dbconn-');
  const Icon = isDB ? Database : FileSpreadsheet;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-full border border-[#6C63FF]/30 bg-[#6C63FF]/10 px-2.5 py-0.5 text-[10px] font-medium text-[#6C63FF] backdrop-blur-sm hover:bg-[#6C63FF]/20 hover:border-[#6C63FF]/50 transition-all duration-150 max-w-[220px]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#6C63FF] shadow-sm shadow-[#6C63FF]/60 shrink-0" />
          <Icon className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">
            {active ? displayLabel(active) : activeSlug}
          </span>
          {datasets.length > 1 && (
            <ChevronDown className="h-2.5 w-2.5 shrink-0 opacity-70" />
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="w-72 glass-strong border-white/[0.08]"
        sideOffset={6}
      >
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Switch dataset
          </DropdownMenuLabel>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); refetch(); }}
            className="rounded p-0.5 hover:bg-white/5 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 text-muted-foreground/60 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* DB connected tables */}
        {db.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-white/[0.05]" />
            <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
              <Database className="h-2.5 w-2.5" />
              Database tables ({db.length})
            </DropdownMenuLabel>
            {db.map(d => (
              <DropdownMenuItem
                key={d.slug}
                onClick={() => { onSelect(d.slug); setOpen(false); }}
                className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer rounded-md hover:bg-white/[0.06] focus:bg-white/[0.06]"
              >
                <Database className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-foreground/80">{displayLabel(d)}</p>
                  {d.profiled_at && (
                    <p className="text-[10px] text-muted-foreground/40 truncate">
                      profiled {new Date(d.profiled_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {d.slug === activeSlug && (
                  <Check className="h-3 w-3 shrink-0 text-[#6C63FF]" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* File uploads */}
        {files.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-white/[0.05]" />
            <DropdownMenuLabel className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
              <FileSpreadsheet className="h-2.5 w-2.5" />
              File uploads ({files.length})
            </DropdownMenuLabel>
            {files.map(d => (
              <DropdownMenuItem
                key={d.slug}
                onClick={() => { onSelect(d.slug); setOpen(false); }}
                className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer rounded-md hover:bg-white/[0.06] focus:bg-white/[0.06]"
              >
                <FileSpreadsheet className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium text-foreground/80">{displayLabel(d)}</p>
                </div>
                {d.slug === activeSlug && (
                  <Check className="h-3 w-3 shrink-0 text-[#6C63FF]" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {/* Other */}
        {other.length > 0 && (
          <>
            <DropdownMenuSeparator className="bg-white/[0.05]" />
            {other.map(d => (
              <DropdownMenuItem
                key={d.slug}
                onClick={() => { onSelect(d.slug); setOpen(false); }}
                className="flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer rounded-md hover:bg-white/[0.06] focus:bg-white/[0.06]"
              >
                <Database className="h-3 w-3 shrink-0 text-muted-foreground/50" />
                <span className="truncate font-medium text-foreground/80">{displayLabel(d)}</span>
                {d.slug === activeSlug && (
                  <Check className="h-3 w-3 shrink-0 text-[#6C63FF]" />
                )}
              </DropdownMenuItem>
            ))}
          </>
        )}

        {datasets.length === 0 && !isFetching && (
          <div className="px-3 py-4 text-center text-xs text-muted-foreground/50">
            No datasets available
          </div>
        )}

        <DropdownMenuSeparator className="bg-white/[0.05]" />
        <div className="px-2 py-1.5 text-[10px] text-muted-foreground/40">
          {datasets.length} dataset{datasets.length !== 1 ? 's' : ''} available · click to switch
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
