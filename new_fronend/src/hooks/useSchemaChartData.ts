import { useQuery } from '@tanstack/react-query';
import { getWmsApiBase } from '@/lib/wmsApi';

export interface SchemaChartRow {
  [key: string]: string | number | null;
}

/**
 * Fetches rows from an uploaded dataset via POST /api/data/query/
 * and returns them shaped as { [col]: value } objects ready for Recharts.
 *
 * columns: pass [xCol, ...yCols] to only fetch the needed columns.
 */
export function useSchemaChartData(
  datasetSlug: string | undefined,
  columns: string[],
  limit = 500,
) {
  return useQuery({
    queryKey: ['schema', 'chart-data', datasetSlug, columns.join(','), limit],
    // NOTE: getWmsApiBase() returns '' in dev (Vite proxy handles /api/*).
    // Boolean('') === false, so do NOT include it in the enabled guard.
    enabled: Boolean(datasetSlug) && columns.length > 0,
    queryFn: async (): Promise<SchemaChartRow[]> => {
      const base = getWmsApiBase();
      // base = '' in dev → '/api/data/query/' (relative, proxied by Vite)
      // base = 'https://...' in prod → absolute URL
      const url = base ? `${base}/api/data/query/` : '/api/data/query/';
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: datasetSlug, columns, limit }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => '');
        throw new Error(t || `${res.status} ${res.statusText}`);
      }
      const body = await res.json() as {
        columns: string[];
        rows: (string | number | null)[][];
      };
      // Shape rows into objects keyed by column name
      return body.rows.map((row) => {
        const obj: SchemaChartRow = {};
        body.columns.forEach((col, i) => { obj[col] = row[i]; });
        return obj;
      });
    },
  });
}
