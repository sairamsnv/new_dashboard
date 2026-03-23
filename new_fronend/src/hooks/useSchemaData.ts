import { useQuery } from '@tanstack/react-query';
import {
  fetchSchemaAggregate,
  fetchSchemaDatasets,
  fetchSchemaInspect,
  type AggregateOp,
} from '@/lib/schemaApi';
import { getWmsApiBase } from '@/lib/wmsApi';

const apiOn = () => Boolean(getWmsApiBase());

export function useSchemaDatasets(enabled = true) {
  return useQuery({
    queryKey: ['schema', 'datasets'],
    queryFn: fetchSchemaDatasets,
    enabled: apiOn() && enabled,
  });
}

export function useSchemaInspect(datasetSlug: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ['schema', 'inspect', datasetSlug],
    queryFn: () => fetchSchemaInspect(datasetSlug!),
    enabled: apiOn() && enabled && Boolean(datasetSlug),
  });
}

export function useSchemaAggregateValue(
  datasetSlug: string | undefined,
  op: AggregateOp,
  column: string | undefined,
  queryEnabled: boolean,
) {
  const requiresColumn = op === 'count_distinct' || op === 'sum' || op === 'avg';
  const colOk = !requiresColumn || Boolean(column?.trim());
  const enabled =
    apiOn() && queryEnabled && Boolean(datasetSlug) && colOk;

  return useQuery({
    queryKey: ['schema', 'aggregate', datasetSlug, op, column ?? ''],
    queryFn: () =>
      fetchSchemaAggregate({
        dataset: datasetSlug!,
        op,
        column: column?.trim() || undefined,
      }),
    enabled,
  });
}
