import type {
  InventoryGroupedItem,
  InventoryItem,
  InventoryListResponse,
  MovementListResponse,
} from '../types/inventory';
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

export interface ListGroupedInventoryParams {
  search?: string;
  categoryId?: number;
  productId?: number;
}

/** Igual que `listInventory`, pero agrupable por producto: incluye
 * combinaciones nunca compradas (en 0) junto a las que ya tienen stock. */
export function listGroupedInventory(
  params: ListGroupedInventoryParams = {},
): Promise<InventoryGroupedItem[]> {
  return apiFetch<InventoryGroupedItem[]>(`/inventory/grouped${buildQuery(params)}`);
}

export interface AdjustVariantInput {
  productId: number;
  sizeId: number;
  colorId: number;
  quantityChange: number;
  reason: string;
  notes?: string;
}

/** Ajusta (o da stock inicial a) una combinación por producto+talla+color,
 * sin exigir que ya exista una fila de inventario — para declarar stock de
 * una combinación nunca comprada, sin registrar una compra falsa. */
export function adjustInventoryVariant(dto: AdjustVariantInput): Promise<InventoryItem> {
  return apiFetch<InventoryItem>('/inventory/adjust-variant', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}
