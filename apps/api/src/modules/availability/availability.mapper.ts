import { Prisma } from '@prisma/client';
import { InventoryStatus } from '../inventory/inventory.mapper';

export interface AvailabilityItemView {
  productId: bigint;
  productName: string;
  productCode: string;
  categoryId: bigint;
  categoryName: string;
  sizeId: bigint;
  sizeName: string;
  colorId: bigint;
  colorName: string;
  quantity: number;
  salePrice: Prisma.Decimal | null;
  waistMeasurement: Prisma.Decimal | null;
  lengthMeasurement: Prisma.Decimal | null;
  status: InventoryStatus;
}

export interface AvailabilitySummary {
  products: number;
  available: number;
  lowStock: number;
  outOfStock: number;
}

export interface AvailabilityResponse {
  items: AvailabilityItemView[];
  total: number;
  page: number;
  pageSize: number;
  summary: AvailabilitySummary;
}

export interface AvailabilityVariantDetail {
  sizeId: bigint;
  sizeName: string;
  colorId: bigint;
  colorName: string;
  quantity: number;
  status: InventoryStatus;
}

export interface AvailabilityProductDetail {
  id: bigint;
  name: string;
  code: string;
  category: { id: bigint; name: string };
  description: string | null;
  salePrice: Prisma.Decimal | null;
  waistMeasurement: Prisma.Decimal | null;
  lengthMeasurement: Prisma.Decimal | null;
  variants: AvailabilityVariantDetail[];
}
