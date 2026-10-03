import type { ActivityListResponse } from '../types/audit';
import { apiFetch } from './client';

export interface ListActivityParams {
  search?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

function buildQuery(params: object): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, string | number | undefined][]) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export function listActivity(params: ListActivityParams = {}): Promise<ActivityListResponse> {
  return apiFetch<ActivityListResponse>(`/audit${buildQuery(params)}`);
}
