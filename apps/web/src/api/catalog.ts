import type { Category, Color, PaymentMethod, Size } from '../types/catalog';
import { apiFetch } from './client';

export function listCategories(): Promise<Category[]> {
  return apiFetch<Category[]>('/categories');
}

export function listSizes(): Promise<Size[]> {
  return apiFetch<Size[]>('/sizes');
}

export function listColors(): Promise<Color[]> {
  return apiFetch<Color[]>('/colors');
}

export function listPaymentMethods(): Promise<PaymentMethod[]> {
  return apiFetch<PaymentMethod[]>('/payment-methods');
}
