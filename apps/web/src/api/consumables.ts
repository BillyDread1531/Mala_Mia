import type {
  Consumable,
  CreateConsumableInput,
  UpdateConsumableInput,
} from '../types/consumable';
import { apiFetch } from './client';

export function listConsumables(): Promise<Consumable[]> {
  return apiFetch<Consumable[]>('/consumables');
}

export function createConsumable(input: CreateConsumableInput): Promise<Consumable> {
  return apiFetch<Consumable>('/consumables', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateConsumable(
  id: string,
  input: UpdateConsumableInput,
): Promise<Consumable> {
  return apiFetch<Consumable>(`/consumables/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function setConsumableActive(id: string, isActive: boolean): Promise<Consumable> {
  return apiFetch<Consumable>(`/consumables/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}

export interface AdjustConsumableInput {
  quantityChange: number;
  notes?: string;
  /** Costo total de este reabastecimiento (opcional, solo si quantityChange
   * es positivo): si se manda, se registra como gasto real — requiere
   * `paymentMethodId`. */
  cost?: number;
  paymentMethodId?: number;
}

export function adjustConsumable(id: string, input: AdjustConsumableInput): Promise<Consumable> {
  return apiFetch<Consumable>(`/consumables/${id}/adjust`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
