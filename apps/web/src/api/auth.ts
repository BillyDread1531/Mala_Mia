import type { AuthenticatedUser } from '../types/user';
import { apiFetch } from './client';

interface UserResponse {
  user: AuthenticatedUser;
}

export function login(username: string, password: string): Promise<UserResponse> {
  return apiFetch<UserResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function fetchCurrentUser(): Promise<UserResponse> {
  return apiFetch<UserResponse>('/auth/me');
}

export function logout(): Promise<{ success: true }> {
  return apiFetch<{ success: true }>('/auth/logout', { method: 'POST' });
}
