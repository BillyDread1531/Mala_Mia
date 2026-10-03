import { Prisma } from '@prisma/client';

/**
 * "Actividad" combina dos fuentes para no duplicar información:
 * - `financial_movements` (Fase 10) ya registra quién/cuándo/qué para toda
 *   venta, devolución, cancelación, corrección, cambio, compra y gasto.
 * - `audit_logs` (reservada desde la Fase 1, nunca usada hasta ahora) cubre
 *   lo que `financial_movements` no puede: login, cambios de configuración,
 *   edición de proveedores, activar/desactivar usuarios, ajustes de
 *   inventario y cambio de contraseña.
 * Esta vista unifica ambas en una sola lista ordenada por fecha.
 */
export interface ActivityEntryView {
  id: string;
  action: string;
  entityType: string;
  entityId: bigint | null;
  description: string;
  userName: string;
  createdAt: Date;
}

export type FinancialMovementForActivity =
  Prisma.financial_movementsGetPayload<{
    include: { users: true };
  }>;

export type AuditLogForActivity = Prisma.audit_logsGetPayload<{
  include: { users: true };
}>;

export function fromFinancialMovement(
  row: FinancialMovementForActivity,
): ActivityEntryView {
  return {
    id: `fm-${row.id}`,
    action: row.movement_type,
    entityType: row.reference_type ?? 'financial_movement',
    entityId: row.reference_id,
    description: row.description,
    userName: row.users.full_name,
    createdAt: row.movement_date,
  };
}

export function fromAuditLog(row: AuditLogForActivity): ActivityEntryView {
  return {
    id: `al-${row.id}`,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    description: row.reason ?? row.action,
    userName: row.users.full_name,
    createdAt: row.created_at,
  };
}
