import { Prisma } from '@prisma/client';

export type PurchaseWithRelations = Prisma.purchasesGetPayload<{
  include: {
    suppliers: true;
    payment_methods: true;
    purchase_items: { include: { products: true; sizes: true; colors: true } };
  };
}>;

export interface PurchaseItemView {
  id: bigint;
  productId: bigint;
  productName: string;
  productCode: string;
  sizeId: bigint;
  sizeName: string;
  colorId: bigint;
  colorName: string;
  quantity: number;
  unitCost: Prisma.Decimal;
  subtotal: Prisma.Decimal;
}

export interface PurchaseView {
  id: bigint;
  purchaseNumber: string;
  purchaseDate: Date;
  status: string;
  supplier: { id: bigint; name: string };
  paymentMethod: { id: bigint; name: string };
  notes: string | null;
  itemCount: number;
  goodsTotal: Prisma.Decimal;
  totalCost: Prisma.Decimal;
  items: PurchaseItemView[];
  createdAt: Date;
}

export function toPurchaseView(purchase: PurchaseWithRelations): PurchaseView {
  return {
    id: purchase.id,
    purchaseNumber: purchase.purchase_number,
    purchaseDate: purchase.purchase_date,
    status: purchase.status,
    supplier: { id: purchase.suppliers.id, name: purchase.suppliers.name },
    paymentMethod: {
      id: purchase.payment_methods.id,
      name: purchase.payment_methods.name,
    },
    notes: purchase.notes,
    itemCount: purchase.purchase_items.length,
    goodsTotal: purchase.goods_total,
    totalCost: purchase.total_cost,
    items: purchase.purchase_items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      productName: item.products.name,
      productCode: item.products.code,
      sizeId: item.size_id,
      sizeName: item.sizes.name,
      colorId: item.color_id,
      colorName: item.colors.name,
      quantity: item.quantity,
      unitCost: item.unit_cost,
      subtotal: item.total_cost,
    })),
    createdAt: purchase.created_at,
  };
}
