export interface ReportPeriod {
  from: string;
  to: string;
  label: string;
}

export interface SalesReportDayPoint {
  date: string;
  total: string;
}

export interface SalesReportPaymentMethodPoint {
  paymentMethodId: string;
  name: string;
  total: string;
  count: number;
}

export interface SalesReportProductPoint {
  productId: string;
  productName: string;
  quantity: number;
  revenue: string;
  cost: string;
  profit: string;
}

export interface SalesReport {
  period: ReportPeriod;
  salesCount: number;
  unitsSold: number;
  grossTotal: string;
  discountsTotal: string;
  cancellationsCount: number;
  cancellationsTotal: string;
  returnsTotal: string;
  byDay: SalesReportDayPoint[];
  byPaymentMethod: SalesReportPaymentMethodPoint[];
  topProducts: SalesReportProductPoint[];
  topProductsByProfit: SalesReportProductPoint[];
}

export interface PurchasesReportSupplierPoint {
  supplierId: string;
  name: string;
  total: string;
  count: number;
}

export interface PurchasesReportProductPoint {
  productId: string;
  productName: string;
  quantity: number;
  totalCost: string;
}

export interface PurchasesReport {
  period: ReportPeriod;
  purchasesCount: number;
  unitsPurchased: number;
  totalAmount: string;
  bySupplier: PurchasesReportSupplierPoint[];
  products: PurchasesReportProductPoint[];
}

export interface InventoryReportLowStockItem {
  productId: string;
  productName: string;
  sizeName: string;
  colorName: string;
  quantity: number;
  status: 'STOCK_BAJO' | 'AGOTADO';
}

export interface ConsumableLowStockItem {
  id: string;
  name: string;
  quantity: number;
  status: 'STOCK_BAJO' | 'AGOTADO';
}

export interface InventoryReport {
  totalUnits: number;
  productsCount: number;
  availableCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  approxValue: string;
  lowStockItems: InventoryReportLowStockItem[];
  lowStockConsumables: ConsumableLowStockItem[];
}
