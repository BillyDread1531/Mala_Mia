import type { Supplier, SupplierFormInput } from '../types/supplier';
import { apiFetch } from './client';

export function listSuppliers(search?: string): Promise<Supplier[]> {
  const query = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return apiFetch<Supplier[]>(`/suppliers${query}`);
}

export function createSupplier(input: SupplierFormInput): Promise<Supplier> {
  return apiFetch<Supplier>('/suppliers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
