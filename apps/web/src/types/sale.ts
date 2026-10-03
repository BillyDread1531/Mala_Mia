export type SaleStatus = 'COMPLETED' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'CANCELLED';

export interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  sizeId: string;
  sizeName: string;
  colorId: string;
  colorName: string;
  quantity: number;
  unitSalePrice: string;
  unitCost: string;
  discountAmount: string;
  subtotal: string;
  returnableQuantity: number;
}

export interface Sale {
  id: string;
  saleNumber: string;
  saleDate: string;
  status: SaleStatus;
  paymentMethod: { id: string; name: string };
  notes: string | null;
  itemCount: number;
  subtotal: string;
  discountAmount: string;
  shippingAmount: string;
  total: string;
  totalRefunded: string;
  netTotal: string;
  items: SaleItem[];
  createdAt: string;
}

export interface SaleListResponse {
  items: Sale[];
  total: number;
  page: number;
  pageSize: number;
}

export interface SaleItemInput {
  inventoryItemId: number;
  quantity: number;
  unitSalePrice: number;
}

export interface SaleFormInput {
  paymentMethodId: number;
  notes?: string;
  shippingAmount?: number;
  items: SaleItemInput[];
}

export const RETURN_REASONS = [
  'Cliente no quedó satisfecho',
  'Talla incorrecta',
  'Producto defectuoso',
  'Cambio de opinión',
  'Otro',
] as const;

export const RETURN_CONDITIONS = [
  { value: 'SALEABLE', label: 'En buen estado' },
  { value: 'DAMAGED', label: 'Dañado' },
] as const;

export const CORRECTION_REASONS = [
  'Talla equivocada',
  'Color equivocado',
  'Cantidad equivocada',
  'Precio mal ingresado',
  'Otro',
] as const;

export interface ReturnItemInput {
  saleItemId: number;
  quantity: number;
  conditionStatus: 'SALEABLE' | 'DAMAGED';
}

export interface ReturnFormInput {
  reason: string;
  refundPaymentMethodId?: number;
  notes?: string;
  items: ReturnItemInput[];
}

export interface ExchangeItemInput {
  originalSaleItemId: number;
  quantity: number;
  newInventoryItemId: number;
}

export interface ExchangeFormInput {
  paymentMethodId?: number;
  notes?: string;
  items: ExchangeItemInput[];
}

export interface CorrectionFormInput {
  saleItemId: number;
  newSizeId?: number;
  newColorId?: number;
  newQuantity?: number;
  newUnitPrice?: number;
  reason: string;
  notes?: string;
}

export interface SaleHistoryEntry {
  type: 'CREATED' | 'RETURN' | 'EXCHANGE' | 'CORRECTION' | 'CANCELLATION';
  date: string;
  description: string;
  by: string | null;
}
