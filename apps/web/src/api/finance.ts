import type {
  DistributionSettings,
  DistributionSettingsInput,
  FinanceMovement,
  FinanceMovementListResponse,
  FinancePeriod,
  FinanceSummary,
} from '../types/finance';
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

export interface GetSummaryParams {
  period: FinancePeriod;
  from?: string;
  to?: string;
}

export function getFinanceSummary(params: GetSummaryParams): Promise<FinanceSummary> {
  return apiFetch<FinanceSummary>(`/finance/summary${buildQuery(params)}`);
}

export interface ListMovementsParams {
  search?: string;
  movementType?: string;
  direction?: 'IN' | 'OUT';
  paymentMethodId?: number;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function listFinanceMovements(
  params: ListMovementsParams = {},
): Promise<FinanceMovementListResponse> {
  return apiFetch<FinanceMovementListResponse>(`/finance/movements${buildQuery(params)}`);
}

export function getDistributionSettings(): Promise<DistributionSettings> {
  return apiFetch<DistributionSettings>('/finance/distribution-settings');
}

export function updateDistributionSettings(
  input: DistributionSettingsInput,
): Promise<DistributionSettings> {
  return apiFetch<DistributionSettings>('/finance/distribution-settings', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export interface ManualIncomeInput {
  description: string;
  amount: number;
  paymentMethodId: number;
}

export function createManualIncome(input: ManualIncomeInput): Promise<FinanceMovement> {
  return apiFetch<FinanceMovement>('/finance/manual-income', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
