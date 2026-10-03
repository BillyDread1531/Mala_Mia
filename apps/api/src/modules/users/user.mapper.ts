import type { AuthenticatedUser } from '../../common/types/authenticated-user';
import type { UserWithRole } from './users.service';

/**
 * Whitelist explícito: nunca incluir password_hash ni otros campos
 * internos, aunque en el futuro se agreguen columnas nuevas a `users`.
 */
export function toAuthenticatedUser(user: UserWithRole): AuthenticatedUser {
  return {
    id: user.id.toString(),
    username: user.username,
    fullName: user.full_name,
    role: user.roles.name,
  };
}

export interface UserView {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
}

export function toUserView(user: UserWithRole): UserView {
  return {
    id: user.id.toString(),
    username: user.username,
    fullName: user.full_name,
    role: user.roles.name,
    isActive: user.is_active,
    createdAt: user.created_at,
  };
}
