import type {
  AvailabilityProductDetail,
  AvailabilityResponse,
  AvailabilityStatus,
} from '../types/availability';
import { apiFetch } from './client';

export interface ListAvailabilityParams {
  search?: string;
  categoryId?: number;
  sizeId?: number;
  colorId?: number;
  status?: AvailabilityStatus;
}

function buildQuery(params: object): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, string | number | undefined][]) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export function listAvailability(
  params: ListAvailabilityParams = {},
): Promise<AvailabilityResponse> {
  return apiFetch<AvailabilityResponse>(`/availability${buildQuery(params)}`);
}

export function getAvailabilityDetail(productId: string): Promise<AvailabilityProductDetail> {
  return apiFetch<AvailabilityProductDetail>(`/availability/${productId}`);
}
