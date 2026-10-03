import type { Purchase, PurchaseFormInput, PurchaseListResponse } from '../types/purchase';
import { apiFetch } from './client';

export interface ListPurchasesParams {
  search?: string;
  supplierId?: number;
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
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export function listPurchases(params: ListPurchasesParams = {}): Promise<PurchaseListResponse> {
  return apiFetch<PurchaseListResponse>(`/purchases${buildQuery(params)}`);
}

export function getPurchase(id: string): Promise<Purchase> {
  return apiFetch<Purchase>(`/purchases/${id}`);
}

export function createPurchase(input: PurchaseFormInput): Promise<Purchase> {
  return apiFetch<Purchase>('/purchases', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
