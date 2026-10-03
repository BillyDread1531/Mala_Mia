export type FinancePeriod = 'week' | 'month' | 'year' | 'custom';

export interface FinanceBreakdown {
  ventas: string;
  devoluciones: string;
  cancelaciones: string;
  correcciones: string;
  cambios: string;
  compras: string;
  gastos: string;
  ingresoManual: string;
}

export interface FinanceDistribution {
  hasProfit: boolean;
  realProfit: string;
  personalPercentage: string;
  reinvestmentPercentage: string;
  reservePercentage: string;
  personalAmount: string;
  reinvestmentAmount: string;
  reserveAmount: string;
}

export interface FinanceSummary {
  period: { from: string; to: string; label: string };
  ingresos: string;
  salidas: string;
  disponible: string;
  netSales: string;
  cogs: string;
  breakdown: FinanceBreakdown;
  distribution: FinanceDistribution;
}

export type FinanceDirection = 'IN' | 'OUT';

export interface FinanceMovement {
  id: string;
  movementType: string;
  direction: FinanceDirection;
  amount: string;
  paymentMethod: { id: string; name: string } | null;
  referenceType: string | null;
  referenceId: string | null;
  description: string;
  movementDate: string;
  createdByName: string;
}

export interface FinanceMovementListResponse {
  items: FinanceMovement[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DistributionSettings {
  personalPercentage: string;
  reinvestmentPercentage: string;
  reservePercentage: string;
  updatedAt: string;
}

export interface DistributionSettingsInput {
  personalPercentage: number;
  reinvestmentPercentage: number;
  reservePercentage: number;
}

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  SALE: 'Venta',
  SALE_RETURN: 'Devolución',
  SALE_CANCELLATION: 'Cancelación',
  SALE_CORRECTION: 'Corrección',
  EXCHANGE_DIFFERENCE: 'Cambio',
  PURCHASE: 'Compra',
  EXPENSE: 'Gasto',
  EXPENSE_VOID: 'Anulación de gasto',
  MANUAL_INCOME: 'Ingreso manual',
};
