import { getWmsApiBase } from '@/lib/wmsApi';
import type { SchemaAggregateOp } from '@/types/dashboard';

export type AggregateOp = SchemaAggregateOp;

export interface SchemaDatasetRow {
  slug: string;
  name: string;
  schema_name: string;
  table_name: string;
  profiled_at: string | null;
}

export interface SchemaInspectColumn {
  col_name: string;
  pg_type: string;
  dtype: string;
  null_rate: number;
  cardinality: number | null;
  is_dimension: boolean;
  suggested_widget: string;
}

export interface SchemaInspectResponse {
  slug: string;
  name: string;
  schema_name: string;
  table_name: string;
  suggested_widget_type: string;
  columns: SchemaInspectColumn[];
}

export async function fetchSchemaDatasets(): Promise<SchemaDatasetRow[]> {
  const base = getWmsApiBase();
  if (!base) return [];
  const res = await fetch(`${base}/api/schema/datasets/`);
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSchemaInspect(datasetSlug: string): Promise<SchemaInspectResponse> {
  const base = getWmsApiBase();
  if (!base) throw new Error('API base URL is not configured');
  const res = await fetch(
    `${base}/api/schema/inspect/?dataset=${encodeURIComponent(datasetSlug)}`,
  );
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function fetchSchemaAggregate(params: {
  dataset: string;
  op: AggregateOp;
  column?: string;
}): Promise<number> {
  const base = getWmsApiBase();
  if (!base) throw new Error('API base URL is not configured');
  const url = new URL(`${base}/api/data/aggregate/`);
  url.searchParams.set('dataset', params.dataset);
  url.searchParams.set('op', params.op);
  if (params.column && params.column.trim() !== '') {
    url.searchParams.set('column', params.column.trim());
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(t || `${res.status} ${res.statusText}`);
  }
  const body = (await res.json()) as { value: number };
  return body.value;
}
