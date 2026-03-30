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

export interface UploadFileResponse {
  job_id: number;
  uploaded_file_id: number;
  status: string;
  message: string;
}

export interface IngestionJobStatus {
  id: number;
  job_type: string;
  status: 'queued' | 'running' | 'done' | 'error';
  result: Record<string, unknown> | null;
  error_message: string;
  created_at: string;
  updated_at: string;
}

export interface DBConnectPayload {
  name: string;
  engine: 'mysql' | 'postgresql' | 'mongodb';
  host: string;
  port: number;
  db_name: string;
  schema_name?: string;  // PostgreSQL schema (default: 'public'). E.g. 'wms_test'
  username: string;
  password: string;
}

export interface DBConnectResponse {
  job_id: number;
  connection_id: number;
  tables_discovered: string[];
  status: string;
  message: string;
}

export interface DataPreviewResponse {
  dataset: string;
  columns: string[];
  rows: unknown[][];
  row_count: number;
}

export interface AIInsightsResponse {
  job_id: number;
  status: string;
  result: {
    trends: string[];
    correlations: { col_a: string; col_b: string; description: string }[];
    outliers: string[];
    summary: string;
  } | null;
}

export interface GraphSuggestion {
  chart_type: string;
  x_col: string;
  y_cols: string[];
  title: string;
  reason: string;
  insight?: string;
  priority: number;
}

export interface GraphSuggestionsResponse {
  job_id: number;
  status: string;
  result: { suggestions: GraphSuggestion[]; dataset_slug: string } | null;
}

export interface NLQueryResponse {
  question: string;
  sql: string;
  explanation: string;
  columns: string[];
  rows: unknown[][];
  row_count: number;
  chart_type: string;
  chart_config: { x_col: string | null; y_cols: string[] };
  error?: string;
}

export interface AIWidgetResponse {
  title: string;
  chart_type: string;
  dataset: string;
  query: Record<string, unknown>;
  config: Record<string, unknown>;
  layout: { w: number; h: number };
  error?: string;
}

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const base = getWmsApiBase(); // '' in dev → relative path; origin in prod
  const url = base ? `${base}${path}` : path;
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ─── Schema / Dataset ────────────────────────────────────────────────────────

export async function fetchSchemaDatasets(): Promise<SchemaDatasetRow[]> {
  return apiRequest<SchemaDatasetRow[]>('/api/schema/datasets/');
}

export async function fetchSchemaInspect(datasetSlug: string): Promise<SchemaInspectResponse> {
  return apiRequest<SchemaInspectResponse>(
    `/api/schema/inspect/?dataset=${encodeURIComponent(datasetSlug)}`,
  );
}

export async function fetchSchemaAggregate(params: {
  dataset: string;
  op: AggregateOp;
  column?: string;
}): Promise<number> {
  const qs = new URLSearchParams({ dataset: params.dataset, op: params.op });
  if (params.column?.trim()) qs.set('column', params.column.trim());
  const body = await apiRequest<{ value: number }>(`/api/data/aggregate/?${qs}`);
  return body.value;
}

// ─── File Upload ─────────────────────────────────────────────────────────────

export async function uploadFile(file: File): Promise<UploadFileResponse> {
  const form = new FormData();
  form.append('file', file);
  return apiRequest<UploadFileResponse>('/api/ingest/upload/', {
    method: 'POST',
    body: form,
  });
}

export async function pollIngestionJob(jobId: number): Promise<IngestionJobStatus> {
  return apiRequest<IngestionJobStatus>(`/api/ingest/status/${jobId}/`);
}

export async function fetchUploadedFiles() {
  return apiRequest<unknown[]>('/api/ingest/files/');
}

// ─── Database Connect ─────────────────────────────────────────────────────────

export async function connectDatabase(payload: DBConnectPayload): Promise<DBConnectResponse> {
  return apiRequest<DBConnectResponse>('/api/ingest/db-connect/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

// ─── Data Preview ─────────────────────────────────────────────────────────────

export async function previewData(datasetSlug: string, limit = 100): Promise<DataPreviewResponse> {
  return apiRequest<DataPreviewResponse>('/api/data/query/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset: datasetSlug, limit }),
  });
}

// ─── AI Endpoints ─────────────────────────────────────────────────────────────

export async function fetchInsights(datasetSlug: string): Promise<AIInsightsResponse> {
  return apiRequest<AIInsightsResponse>('/api/ai/insights/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_slug: datasetSlug }),
  });
}

export async function fetchGraphSuggestions(datasetSlug: string): Promise<GraphSuggestionsResponse> {
  return apiRequest<GraphSuggestionsResponse>('/api/ai/graph-suggestions/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataset_slug: datasetSlug }),
  });
}

export async function sendNlQuery(question: string, datasetSlug: string): Promise<NLQueryResponse> {
  return apiRequest<NLQueryResponse>('/api/ai/nl-query/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, dataset_slug: datasetSlug }),
  });
}

export async function buildWidget(prompt: string, datasetSlug?: string): Promise<AIWidgetResponse> {
  return apiRequest<AIWidgetResponse>('/api/ai/widget-build/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, dataset_slug: datasetSlug }),
  });
}

export async function pollAIJob(jobId: number) {
  return apiRequest<{
    job_id: number;
    status: string;
    result: Record<string, unknown> | null;
    error: string | null;
  }>(`/api/ai/jobs/${jobId}/`);
}
