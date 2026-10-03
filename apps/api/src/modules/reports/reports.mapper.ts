import { Prisma } from '@prisma/client';

export interface ReportPeriod {
  from: Date;
  to: Date;
  label: string;
}

export interface SalesReportDayPoint {
  date: string;
  total: Prisma.Decimal;
}

export interface SalesReportPaymentMethodPoint {
  paymentMethodId: bigint;
  name: string;
  total: Prisma.Decimal;
  count: number;
}

export interface SalesReportProductPoint {
  productId: bigint;
  productName: string;
  quantity: number;
  revenue: Prisma.Decimal;
  cost: Prisma.Decimal;
  profit: Prisma.Decimal;
}

export interface SalesReport {
  period: ReportPeriod;
  salesCount: number;
  unitsSold: number;
  grossTotal: Prisma.Decimal;
  discountsTotal: Prisma.Decimal;
  cancellationsCount: number;
  cancellationsTotal: Prisma.Decimal;
  returnsTotal: Prisma.Decimal;
  byDay: SalesReportDayPoint[];
  byPaymentMethod: SalesReportPaymentMethodPoint[];
  topProducts: SalesReportProductPoint[];
  topProductsByProfit: SalesReportProductPoint[];
}

export interface PurchasesReportSupplierPoint {
  supplierId: bigint;
  name: string;
  total: Prisma.Decimal;
  count: number;
}

export interface PurchasesReportProductPoint {
  productId: bigint;
  productName: string;
  quantity: number;
  totalCost: Prisma.Decimal;
}

export interface PurchasesReport {
  period: ReportPeriod;
  purchasesCount: number;
  unitsPurchased: number;
  totalAmount: Prisma.Decimal;
  bySupplier: PurchasesReportSupplierPoint[];
  products: PurchasesReportProductPoint[];
}

export interface InventoryReportLowStockItem {
  productId: bigint;
  productName: string;
  sizeName: string;
  colorName: string;
  quantity: number;
  status: 'STOCK_BAJO' | 'AGOTADO';
}

export interface ConsumableLowStockItem {
  id: bigint;
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
  approxValue: Prisma.Decimal;
  lowStockItems: InventoryReportLowStockItem[];
  lowStockConsumables: ConsumableLowStockItem[];
}
