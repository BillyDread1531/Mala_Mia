import { Prisma } from '@prisma/client';

export type InventoryItemWithRelations = Prisma.inventory_itemsGetPayload<{
  include: { products: true; sizes: true; colors: true };
}>;

export type InventoryMovementWithRelations =
  Prisma.inventory_movementsGetPayload<{
    include: { users: true };
  }>;

export type InventoryStatus = 'AGOTADO' | 'STOCK_BAJO' | 'DISPONIBLE';

export function computeStatus(
  quantity: number,
  lowStockThreshold: number,
): InventoryStatus {
  if (quantity <= 0) return 'AGOTADO';
  if (quantity <= lowStockThreshold) return 'STOCK_BAJO';
  return 'DISPONIBLE';
}

export interface InventoryItemView {
  id: bigint;
  product: { id: bigint; name: string; code: string };
  sizeId: bigint;
  sizeName: string;
  colorId: bigint;
  colorName: string;
  quantity: number;
  averageCost: Prisma.Decimal;
  status: InventoryStatus;
  updatedAt: Date;
}

export function toInventoryItemView(
  item: InventoryItemWithRelations,
  lowStockThreshold: number,
): InventoryItemView {
  return {
    id: item.id,
    product: {
      id: item.products.id,
      name: item.products.name,
      code: item.products.code,
    },
    sizeId: item.size_id,
    sizeName: item.sizes.name,
    colorId: item.color_id,
    colorName: item.colors.name,
    quantity: item.quantity,
    averageCost: item.average_cost,
    status: computeStatus(item.quantity, lowStockThreshold),
    updatedAt: item.updated_at,
  };
}

export interface InventoryMovementView {
  id: bigint;
  movementType: string;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  unitCost: Prisma.Decimal | null;
  referenceType: string | null;
  referenceId: bigint | null;
  reason: string | null;
  notes: string | null;
  createdByName: string;
  createdAt: Date;
}

export function toMovementView(
  movement: InventoryMovementWithRelations,
): InventoryMovementView {
  return {
    id: movement.id,
    movementType: movement.movement_type,
    quantity: movement.quantity,
    quantityBefore: movement.quantity_before,
    quantityAfter: movement.quantity_after,
    unitCost: movement.unit_cost,
    referenceType: movement.reference_type,
    referenceId: movement.reference_id,
    reason: movement.reason,
    notes: movement.notes,
    createdByName: movement.users.full_name,
    createdAt: movement.created_at,
  };
}
