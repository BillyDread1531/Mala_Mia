import type { AppUser } from '../types/user';
import { apiFetch } from './client';

export function listUsers(): Promise<AppUser[]> {
  return apiFetch<AppUser[]>('/users');
}

export function setUserActive(id: string, isActive: boolean): Promise<AppUser> {
  return apiFetch<AppUser>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
}
