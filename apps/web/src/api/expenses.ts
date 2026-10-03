import type { Expense, ExpenseFormInput, ExpenseListResponse } from '../types/expense';
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

export interface ListExpensesParams {
  search?: string;
  categoryId?: number;
  paymentMethodId?: number;
  status?: 'COMPLETED' | 'VOIDED';
  page?: number;
  pageSize?: number;
}

export function listExpenses(params: ListExpensesParams = {}): Promise<ExpenseListResponse> {
  return apiFetch<ExpenseListResponse>(`/expenses${buildQuery(params)}`);
}

export function getExpense(id: string): Promise<Expense> {
  return apiFetch<Expense>(`/expenses/${id}`);
}

export function createExpense(input: ExpenseFormInput): Promise<Expense> {
  return apiFetch<Expense>('/expenses', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function voidExpense(id: string, reason?: string): Promise<Expense> {
  return apiFetch<Expense>(`/expenses/${id}/void`, {
    method: 'PATCH',
    body: JSON.stringify({ reason }),
  });
}
