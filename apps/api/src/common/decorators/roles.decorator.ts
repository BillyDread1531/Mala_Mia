import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Marca un endpoint como restringido a los roles indicados (ej. "ADMIN").
 * Requiere que la ruta también use SessionAuthGuard y RolesGuard.
 * Ningún endpoint la usa todavía: es infraestructura para los módulos
 * de negocio que vienen en fases posteriores.
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
