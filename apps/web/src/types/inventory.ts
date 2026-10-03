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

/** Incluye TODAS las combinaciones declaradas en el producto (no solo las
 * que ya tienen una fila de inventario): `inventoryItemId` es null cuando
 * nunca se compró, y el stock se muestra en 0. */
export interface InventoryGroupedItem {
  inventoryItemId: string | null;
  productId: string;
  productName: string;
  productCode: string;
  sizeId: string;
  sizeName: string;
  colorId: string;
  colorName: string;
  quantity: number;
  averageCost: string | null;
  status: InventoryStatus;
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
