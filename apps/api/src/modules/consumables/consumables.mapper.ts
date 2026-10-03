import { consumables } from '@prisma/client';
import { computeStatus, InventoryStatus } from '../inventory/inventory.mapper';

export interface ConsumableView {
  id: bigint;
  name: string;
  quantity: number;
  lowStockThreshold: number;
  unitsPerSale: number;
  isActive: boolean;
  status: InventoryStatus;
  updatedAt: Date;
}

export function toConsumableView(row: consumables): ConsumableView {
  return {
    id: row.id,
    name: row.name,
    quantity: row.quantity,
    lowStockThreshold: row.low_stock_threshold,
    unitsPerSale: row.units_per_sale,
    isActive: row.is_active,
    status: computeStatus(row.quantity, row.low_stock_threshold),
    updatedAt: row.updated_at,
  };
}
