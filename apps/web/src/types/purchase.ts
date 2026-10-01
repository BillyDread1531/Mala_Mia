export interface PurchaseItem {
  id: string;
  productId: string;
  productName: string;
  productCode: string;
  sizeId: string;
  sizeName: string;
  colorId: string;
  colorName: string;
  quantity: number;
  unitCost: string;
  subtotal: string;
}

export interface Purchase {
  id: string;
  purchaseNumber: string;
  purchaseDate: string;
  status: string;
  supplier: { id: string; name: string };
  paymentMethod: { id: string; name: string };
  notes: string | null;
  itemCount: number;
  goodsTotal: string;
  totalCost: string;
  items: PurchaseItem[];
  createdAt: string;
}

export interface PurchaseListResponse {
  items: Purchase[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PurchaseItemInput {
  productId: number;
  sizeId: number;
  colorId: number;
  quantity: number;
  unitCost: number;
}

export interface PurchaseFormInput {
  supplierId: number;
  paymentMethodId: number;
  notes?: string;
  items: PurchaseItemInput[];
}
