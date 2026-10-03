import type { Category, Color, ExpenseCategory, PaymentMethod, Size } from '../types/catalog';
import { apiFetch } from './client';

export function listCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/categories');
}

export function listAllCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/categories/all');
}

export function createCategory(name: string): Promise<Category> {
  return apiFetch<Category>('/categories', { method: 'POST', body: JSON.stringify({ name }) });
}

export function setCategoryActive(id: string, isActive: boolean): Promise<Category> {
  return apiFetch<Category>(`/categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function listSizes(): Promise<Size[]> {
  return apiFetch<Size[]>('/sizes');
}

export function listAllSizes(): Promise<Size[]> {
  return apiFetch<Size[]>('/sizes/all');
}

export function createSize(name: string): Promise<Size> {
  return apiFetch<Size>('/sizes', { method: 'POST', body: JSON.stringify({ name }) });
}

export function setSizeActive(id: string, isActive: boolean): Promise<Size> {
  return apiFetch<Size>(`/sizes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function listColors(): Promise<Color[]> {
  return apiFetch<Color[]>('/colors');
}

export function listAllColors(): Promise<Color[]> {
  return apiFetch<Color[]>('/colors/all');
}

export function createColor(name: string): Promise<Color> {
  return apiFetch<Color>('/colors', { method: 'POST', body: JSON.stringify({ name }) });
}

export function setColorActive(id: string, isActive: boolean): Promise<Color> {
  return apiFetch<Color>(`/colors/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function listPaymentMethods(
  context: 'purchases' | 'sales' | 'expenses' = 'purchases',
): Promise<PaymentMethod[]> {
  return apiFetch<PaymentMethod[]>(`/payment-methods?context=${context}`);
}

export function listAllPaymentMethods(): Promise<PaymentMethod[]> {
  return apiFetch<PaymentMethod[]>('/payment-methods/all');
}

export function setPaymentMethodActive(id: string, isActive: boolean): Promise<PaymentMethod> {
  return apiFetch<PaymentMethod>(`/payment-methods/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export function listExpenseCategories(): Promise<ExpenseCategory[]> {
  return apiFetch<ExpenseCategory[]>('/expense-categories');
}

export function listAllExpenseCategories(): Promise<ExpenseCategory[]> {
  return apiFetch<ExpenseCategory[]>('/expense-categories/all');
}

export function createExpenseCategory(name: string): Promise<ExpenseCategory> {
  return apiFetch<ExpenseCategory>('/expense-categories', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function setExpenseCategoryActive(id: string, isActive: boolean): Promise<ExpenseCategory> {
  return apiFetch<ExpenseCategory>(`/expense-categories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}
