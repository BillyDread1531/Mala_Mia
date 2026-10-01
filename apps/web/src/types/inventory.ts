export type InventoryStatus = 'AGOTADO' | 'STOCK_BAJO' | 'DISPONIBLE';

export interface InventoryItem {
  id: string;
  product: { id: string; name: string; code: string };
  sizeId: string;
  sizeName: string;
  colorId: string;
  colorName: string;
  quantity: number;
  averageCost: string;
  status: InventoryStatus;
  updatedAt: string;
}

export interface InventoryMovement {
  id: string;
  movementType: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: string | null;
  referenceType: string | null;
  referenceId: string | null;
  reason: string | null;
  notes: string | null;
  createdByName: string;
  createdAt: string;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface MovementListResponse {
  items: InventoryMovement[];
  total: number;
  page: number;
  pageSize: number;
}

export const ADJUSTMENT_REASONS = [
  'Prenda dañada',
  'Prenda perdida',
  'Error de conteo',
  'Corrección de inventario',
  'Otro',
] as const;
