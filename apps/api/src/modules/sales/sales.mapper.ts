import { Prisma } from '@prisma/client';

export type SaleStatus =
  'COMPLETED' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'CANCELLED';

export interface SaleHistoryEntry {
  type: 'CREATED' | 'RETURN' | 'EXCHANGE' | 'CORRECTION' | 'CANCELLATION';
  date: Date;
  description: string;
  by: string | null;
}

export type SaleWithRelations = Prisma.salesGetPayload<{
  include: {
    payment_methods: true;
    sale_items: { include: { products: true; sizes: true; colors: true } };
  };
}>;

export interface SaleItemView {
  id: bigint;
  productId: bigint;
  productName: string;
  productCode: string;
  sizeId: bigint;
  sizeName: string;
  colorId: bigint;
  colorName: string;
  quantity: number;
  unitSalePrice: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  subtotal: Prisma.Decimal;
  /** quantity - (ya devuelto + ya cambiado). Por defecto (listados) igual a
   * `quantity`; `findOne` lo recalcula con el dato real. */
  returnableQuantity: number;
}

export interface SaleView {
  id: bigint;
  saleNumber: string;
  saleDate: Date;
  status: string;
  paymentMethod: { id: bigint; name: string };
  notes: string | null;
  itemCount: number;
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  /** Envío cobrado al cliente, ya incluido en `total` (pass-through: no es
   * ganancia ni gasto, solo el monto que se le pasó al cliente). */
  shippingAmount: Prisma.Decimal;
  total: Prisma.Decimal;
  /** Suma de `returns.refund_amount` de esta venta. Por defecto 0 (listados);
   * `findOne` lo recalcula con el dato real, igual que `returnableQuantity`. */
  totalRefunded: Prisma.Decimal;
  /** `total - totalRefunded`: lo que realmente queda de la venta después de
   * devoluciones, para que el detalle no muestre solo el monto original. */
  netTotal: Prisma.Decimal;
  items: SaleItemView[];
  createdAt: Date;
}

export function toSaleView(sale: SaleWithRelations): SaleView {
  return {
    id: sale.id,
    saleNumber: sale.sale_number,
    saleDate: sale.sale_date,
    status: sale.status,
    paymentMethod: {
      id: sale.payment_methods.id,
      name: sale.payment_methods.name,
    },
    notes: sale.notes,
    itemCount: sale.sale_items.length,
    subtotal: sale.subtotal,
    discountAmount: sale.discount_amount,
    shippingAmount: sale.shipping_customer_amount,
    total: sale.total,
    totalRefunded: new Prisma.Decimal(0),
    netTotal: sale.total,
    items: sale.sale_items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.products.name,
      productCode: item.products.code,
      sizeId: item.size_id,
      sizeName: item.sizes.name,
      colorId: item.color_id,
      colorName: item.colors.name,
      quantity: item.quantity,
      unitSalePrice: item.unit_sale_price,
      unitCost: item.unit_cost,
      discountAmount: item.discount_amount,
      subtotal: item.subtotal,
      returnableQuantity: item.quantity,
    })),
    createdAt: sale.created_at,
  };
}
