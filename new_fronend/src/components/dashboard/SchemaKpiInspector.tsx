import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SCHEMA_AGGREGATE_OPS, SCHEMA_KPI_COUNT_ALL, type SchemaAggregateOp } from '@/types/dashboard';
import { useSchemaDatasets, useSchemaInspect } from '@/hooks/useSchemaData';

interface SchemaKpiInspectorProps {
  datasetSlug: string;
  aggregateOp: SchemaAggregateOp;
  aggregateColumn: string;
  onPatch: (partial: Record<string, unknown>) => void;
}

const SchemaKpiInspector = ({
  datasetSlug,
  aggregateOp,
  aggregateColumn,
  onPatch,
}: SchemaKpiInspectorProps) => {
  const { data: datasets, isPending: dsLoading, error: dsError } = useSchemaDatasets();
  const { data: inspected, isPending: insLoading } = useSchemaInspect(
    datasetSlug || undefined,
    Boolean(datasetSlug),
  );

  const cols = inspected?.columns ?? [];
  const numericCols = cols.filter((c) => c.dtype === 'numeric');

  const columnSelectValue =
    aggregateOp === 'count' && (!aggregateColumn || aggregateColumn === SCHEMA_KPI_COUNT_ALL)
      ? SCHEMA_KPI_COUNT_ALL
      : aggregateColumn || SCHEMA_KPI_COUNT_ALL;

  return (
    <>
      <div className="space-y-2">
        <Label className="text-xs">Registered dataset</Label>
        <Select
          value={datasetSlug || ''}
          onValueChange={(v) => {
            const row = datasets?.find((d) => d.slug === v);
            onPatch({
              datasetSlug: v,
              datasetTable: row ? `${row.schema_name}.${row.table_name}` : '',
            });
          }}
          disabled={dsLoading}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={dsLoading ? 'Loading…' : 'Choose dataset'} />
          </SelectTrigger>
          <SelectContent>
            {(datasets ?? []).map((d) => (
              <SelectItem key={d.slug} value={d.slug} className="text-sm">
                {d.name}{' '}
                <span className="text-muted-foreground font-mono text-[10px]">
                  ({d.schema_name}.{d.table_name})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dsError ? (
          <p className="text-[10px] text-destructive">Could not load datasets. Is the API up?</p>
        ) : null}
        {!dsLoading && (datasets?.length ?? 0) === 0 ? (
          <p className="text-[10px] text-muted-foreground leading-snug">
            No datasets yet. Register a table with{' '}
            <span className="font-mono">POST /api/schema/inspect/</span>, then refresh this page.
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Aggregate</Label>
        <Select
          value={aggregateOp}
          onValueChange={(v) => {
            const next = v as SchemaAggregateOp;
            onPatch({
              aggregateOp: next,
              aggregateColumn:
                next === 'count_distinct' || next === 'sum' || next === 'avg'
                  ? ''
                  : SCHEMA_KPI_COUNT_ALL,
            });
          }}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCHEMA_AGGREGATE_OPS.map((o) => (
              <SelectItem key={o.id} value={o.id} className="text-sm">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Column</Label>
        <Select
          value={columnSelectValue}
          onValueChange={(v) => onPatch({ aggregateColumn: v })}
          disabled={
            !datasetSlug ||
            insLoading ||
            !cols.length ||
            ((aggregateOp === 'sum' || aggregateOp === 'avg') && numericCols.length === 0)
          }
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={insLoading ? 'Loading columns…' : 'Choose column'} />
          </SelectTrigger>
          <SelectContent>
            {aggregateOp === 'count' && (
              <SelectItem value={SCHEMA_KPI_COUNT_ALL} className="text-sm">
                All rows (COUNT(*))
              </SelectItem>
            )}
            {aggregateOp === 'count' &&
              cols.map((c) => (
                <SelectItem key={c.col_name} value={c.col_name} className="text-sm font-mono">
                  {c.col_name} <span className="text-muted-foreground">({c.dtype})</span>
                </SelectItem>
              ))}
            {aggregateOp === 'count_distinct' &&
              cols.map((c) => (
                <SelectItem key={c.col_name} value={c.col_name} className="text-sm font-mono">
                  {c.col_name} <span className="text-muted-foreground">({c.dtype})</span>
                </SelectItem>
              ))}
            {(aggregateOp === 'sum' || aggregateOp === 'avg') &&
              numericCols.map((c) => (
                <SelectItem key={c.col_name} value={c.col_name} className="text-sm font-mono">
                  {c.col_name}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground leading-snug">
          {aggregateOp === 'count' && 'Optional: count non-null values in one column, or all rows.'}
          {aggregateOp === 'count_distinct' && 'Pick a column for COUNT(DISTINCT …).'}
          {(aggregateOp === 'sum' || aggregateOp === 'avg') && 'Uses numeric columns from the schema profile.'}
        </p>
      </div>
    </>
  );
};

export default SchemaKpiInspector;
