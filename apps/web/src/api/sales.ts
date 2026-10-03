import type {
  CorrectionFormInput,
  ExchangeFormInput,
  Sale,
  SaleFormInput,
  SaleHistoryEntry,
  SaleListResponse,
  ReturnFormInput,
} from '../types/sale';
import { apiFetch } from './client';

export interface ListSalesParams {
  search?: string;
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
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

export function listSales(params: ListSalesParams = {}): Promise<SaleListResponse> {
  return apiFetch<SaleListResponse>(`/sales${buildQuery(params)}`);
}

export function getSale(id: string): Promise<Sale> {
  return apiFetch<Sale>(`/sales/${id}`);
}

export function createSale(input: SaleFormInput): Promise<Sale> {
  return apiFetch<Sale>('/sales', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function cancelSale(id: string, notes?: string): Promise<Sale> {
  return apiFetch<Sale>(`/sales/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export function createReturn(id: string, input: ReturnFormInput): Promise<Sale> {
  return apiFetch<Sale>(`/sales/${id}/returns`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createExchange(id: string, input: ExchangeFormInput): Promise<Sale> {
  return apiFetch<Sale>(`/sales/${id}/exchanges`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createCorrection(id: string, input: CorrectionFormInput): Promise<Sale> {
  return apiFetch<Sale>(`/sales/${id}/corrections`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getSaleHistory(id: string): Promise<SaleHistoryEntry[]> {
  return apiFetch<SaleHistoryEntry[]>(`/sales/${id}/history`);
}
