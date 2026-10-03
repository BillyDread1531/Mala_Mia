import type { FinancePeriod } from '../types/finance';
import type { InventoryReport, PurchasesReport, SalesReport } from '../types/reports';
import { apiFetch } from './client';

function buildQuery(params: object): string {
  const searchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params) as [string, string | number | undefined][]) {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  }
  const qs = searchParams.toString();
  return qs ? `?${qs}` : '';
}

export interface GetSalesReportParams {
  period: FinancePeriod;
  from?: string;
  to?: string;
  paymentMethodId?: number;
}

export function getSalesReport(params: GetSalesReportParams): Promise<SalesReport> {
  return apiFetch<SalesReport>(`/reports/sales${buildQuery(params)}`);
}

export interface GetPurchasesReportParams {
  period: FinancePeriod;
  from?: string;
  to?: string;
  supplierId?: number;
}

export function getPurchasesReport(params: GetPurchasesReportParams): Promise<PurchasesReport> {
  return apiFetch<PurchasesReport>(`/reports/purchases${buildQuery(params)}`);
}

export interface GetInventoryReportParams {
  categoryId?: number;
}

export function getInventoryReport(
  params: GetInventoryReportParams = {},
): Promise<InventoryReport> {
  return apiFetch<InventoryReport>(`/reports/inventory${buildQuery(params)}`);
}
