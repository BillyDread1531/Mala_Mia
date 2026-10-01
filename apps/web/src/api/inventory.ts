import type { InventoryItem, InventoryListResponse, MovementListResponse } from '../types/inventory';
import { apiFetch } from './client';

function buildQuery(params: object): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, string | number | undefined][]) {
    if (value !== undefined && value !== '') searchParams.set(key, String(value));
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export interface ListInventoryParams {
  search?: string;
  productId?: number;
  available?: 'true' | 'false';
  page?: number;
  pageSize?: number;
}

export function listInventory(params: ListInventoryParams = {}): Promise<InventoryListResponse> {
  return apiFetch<InventoryListResponse>(`/inventory${buildQuery(params)}`);
}

export function getInventoryItem(
  id: string,
): Promise<{ item: InventoryItem; movements: import('../types/inventory').InventoryMovement[] }> {
  return apiFetch(`/inventory/${id}`);
}

export function listMovements(
  params: { productId?: number } = {},
): Promise<MovementListResponse> {
  return apiFetch<MovementListResponse>(`/inventory/movements${buildQuery(params)}`);
}

export function adjustInventory(
  id: string,
  dto: { quantityChange: number; reason: string; notes?: string },
): Promise<InventoryItem> {
  return apiFetch<InventoryItem>(`/inventory/${id}/adjust`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}
