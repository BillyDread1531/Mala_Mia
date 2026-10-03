import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MOVEMENT_TYPES } from '../finance/finance.constants';
import { QueryAuditDto } from './dto/query-audit.dto';
import {
  ActivityEntryView,
  fromAuditLog,
  fromFinancialMovement,
} from './audit.mapper';

export const AUDIT_ACTIONS = {
  LOGIN: 'LOGIN',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  SUPPLIER_UPDATED: 'SUPPLIER_UPDATED',
  SUPPLIER_ACTIVE_CHANGED: 'SUPPLIER_ACTIVE_CHANGED',
  USER_ACTIVE_CHANGED: 'USER_ACTIVE_CHANGED',
  INVENTORY_ADJUSTED: 'INVENTORY_ADJUSTED',
  PRODUCT_ACTIVE_CHANGED: 'PRODUCT_ACTIVE_CHANGED',
  CONSUMABLE_UPDATED: 'CONSUMABLE_UPDATED',
  CONSUMABLE_ACTIVE_CHANGED: 'CONSUMABLE_ACTIVE_CHANGED',
  CONSUMABLE_ADJUSTED: 'CONSUMABLE_ADJUSTED',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

const FINANCIAL_ACTIONS = new Set<string>(Object.values(MOVEMENT_TYPES));
const AUDIT_LOG_ACTIONS = new Set<string>(Object.values(AUDIT_ACTIONS));

export interface RecordAuditInput {
  userId: bigint;
  action: AuditAction;
  entityType: string;
  entityId?: bigint | null;
  description: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
}

/** Cliente mínimo que necesita `record`: tanto `PrismaService` como un
 * `Prisma.TransactionClient` lo satisfacen, así una acción financiera y su
 * registro de auditoría pueden compartir la misma transacción cuando haga
 * falta (y una acción suelta como el login puede usar `PrismaService` tal cual). */
type AuditDb = Pick<PrismaService, 'audit_logs'> | Prisma.TransactionClient;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

const SOURCE_WINDOW = 150;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(db: AuditDb, input: RecordAuditInput): Promise<void> {
    await db.audit_logs.create({
      data: {
        user_id: input.userId,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId ?? null,
        reason: input.description,
        old_values: input.oldValues,
        new_values: input.newValues,
      },
    });
  }

  /**
   * Combina `financial_movements` (ventas/compras/gastos/devoluciones/
   * cambios/correcciones, ya registrados desde Fase 10) y `audit_logs`
   * (login/configuración/proveedores/usuarios/ajustes de inventario) en una
   * sola lista ordenada por fecha. Cada fuente se trae acotada a las últimas
   * `SOURCE_WINDOW` filas que cumplen el filtro — suficiente para el volumen
   * real de un negocio como MALA MÍA sin traer la tabla completa.
   */
  async list(query: QueryAuditDto): Promise<Paginated<ActivityEntryView>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const wantsFinancial = !query.action || FINANCIAL_ACTIONS.has(query.action);
    const wantsAuditLog = !query.action || AUDIT_LOG_ACTIONS.has(query.action);

    const dateFilter =
      query.from || query.to
        ? {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lt: new Date(query.to) } : {}),
          }
        : undefined;

    const fmWhere: Prisma.financial_movementsWhereInput = {
      ...(dateFilter ? { movement_date: dateFilter } : {}),
      ...(query.action && FINANCIAL_ACTIONS.has(query.action)
        ? { movement_type: query.action }
        : {}),
      ...(query.search?.trim()
        ? { description: { contains: query.search.trim() } }
        : {}),
    };
    const alWhere: Prisma.audit_logsWhereInput = {
      ...(dateFilter ? { created_at: dateFilter } : {}),
      ...(query.action && AUDIT_LOG_ACTIONS.has(query.action)
        ? { action: query.action }
        : {}),
      ...(query.search?.trim()
        ? { reason: { contains: query.search.trim() } }
        : {}),
    };

    const [fmRows, alRows] = await Promise.all([
      wantsFinancial
        ? this.prisma.financial_movements.findMany({
            where: fmWhere,
            include: { users: true },
            orderBy: { movement_date: 'desc' },
            take: SOURCE_WINDOW,
          })
        : Promise.resolve([]),
      wantsAuditLog
        ? this.prisma.audit_logs.findMany({
            where: alWhere,
            include: { users: true },
            orderBy: { created_at: 'desc' },
            take: SOURCE_WINDOW,
          })
        : Promise.resolve([]),
    ]);

    const merged = [
      ...fmRows.map(fromFinancialMovement),
      ...alRows.map(fromAuditLog),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = merged.length;
    const items = merged.slice((page - 1) * pageSize, page * pageSize);
    return { items, total, page, pageSize };
  }
}
