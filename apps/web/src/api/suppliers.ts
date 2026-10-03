import type {
  Supplier,
  SupplierFormInput,
  SupplierListItem,
  UpdateSupplierInput,
} from '../types/supplier';
import { apiFetch } from './client';

export function listSuppliers(search?: string): Promise<Supplier[]> {
  const query = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
  return apiFetch<Supplier[]>(`/suppliers${query}`);
}

export function listAllSuppliers(): Promise<SupplierListItem[]> {
  return apiFetch<SupplierListItem[]>('/suppliers/all');
}

export function getSupplier(id: string): Promise<SupplierListItem> {
  return apiFetch<SupplierListItem>(`/suppliers/${id}`);
}

export function createSupplier(input: SupplierFormInput): Promise<Supplier> {
  return apiFetch<Supplier>('/suppliers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateSupplier(id: string, input: UpdateSupplierInput): Promise<Supplier> {
  return apiFetch<Supplier>(`/suppliers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setSupplierActive(id: string, isActive: boolean): Promise<Supplier> {
  return apiFetch<Supplier>(`/suppliers/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}
