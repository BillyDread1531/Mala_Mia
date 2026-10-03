import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ACTIONS, AuditService } from '../audit/audit.service';
import { ExpensesService } from '../expenses/expenses.service';
import { AdjustConsumableDto } from './dto/adjust-consumable.dto';
import { CreateConsumableDto } from './dto/create-consumable.dto';
import { UpdateConsumableDto } from './dto/update-consumable.dto';
import { ConsumableView, toConsumableView } from './consumables.mapper';

const PACKAGING_EXPENSE_CATEGORY = 'Empaque';

@Injectable()
export class ConsumablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly expensesService: ExpensesService,
  ) {}

  async list(): Promise<ConsumableView[]> {
    const rows = await this.prisma.consumables.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map(toConsumableView);
  }

  /**
   * Registra, dentro de la misma transacción que da entrada al stock, el
   * costo de un insumo como un gasto real (categoría "Empaque") — sigue
   * siendo dinero que salió del negocio, así que debe aparecer en
   * Finanzas/Reportes igual que cualquier otro gasto, no solo como un
   * número de inventario.
   */
  private async recordPackagingExpense(
    tx: Prisma.TransactionClient,
    description: string,
    cost: number,
    paymentMethodId: number,
    userId: bigint,
  ): Promise<void> {
    const category = await tx.expense_categories.findFirst({
      where: { name: PACKAGING_EXPENSE_CATEGORY },
    });
    if (!category) {
      throw new BadRequestException(
        `No existe la categoría de gasto "${PACKAGING_EXPENSE_CATEGORY}" — créala desde Configuración antes de registrar el costo.`,
      );
    }
    await this.expensesService.createInTransaction(
      tx,
      {
        categoryId: Number(category.id),
        description,
        amount: cost,
        paymentMethodId,
      },
      userId,
    );
  }

  async create(dto: CreateConsumableDto, userId: bigint): Promise<ConsumableView> {
    if (dto.cost !== undefined && !dto.paymentMethodId) {
      throw new BadRequestException(
        'Selecciona una forma de pago para registrar el costo.',
      );
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const consumable = await tx.consumables.create({
        data: {
          name: dto.name.trim(),
          quantity: dto.quantity ?? 0,
          low_stock_threshold: dto.lowStockThreshold ?? 5,
          units_per_sale: dto.unitsPerSale ?? 1,
        },
      });

      if (dto.cost !== undefined && dto.paymentMethodId) {
        await this.recordPackagingExpense(
          tx,
          `Insumo: ${consumable.name}`,
          dto.cost,
          dto.paymentMethodId,
          userId,
        );
      }

      return consumable;
    });
    return toConsumableView(created);
  }

  async update(
    id: bigint,
    dto: UpdateConsumableDto,
    userId: bigint,
  ): Promise<ConsumableView> {
    const existing = await this.prisma.consumables.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Insumo no encontrado.');

    const updated = await this.prisma.consumables.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.lowStockThreshold !== undefined
          ? { low_stock_threshold: dto.lowStockThreshold }
          : {}),
        ...(dto.unitsPerSale !== undefined
          ? { units_per_sale: dto.unitsPerSale }
          : {}),
        updated_at: new Date(),
      },
    });
    await this.auditService.record(this.prisma, {
      userId,
      action: AUDIT_ACTIONS.CONSUMABLE_UPDATED,
      entityType: 'consumable',
      entityId: id,
      description: `Insumo actualizado: ${updated.name}.`,
    });
    return toConsumableView(updated);
  }

  async setActive(
    id: bigint,
    isActive: boolean,
    userId: bigint,
  ): Promise<ConsumableView> {
    const existing = await this.prisma.consumables.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Insumo no encontrado.');

    const updated = await this.prisma.consumables.update({
      where: { id },
      data: { is_active: isActive, updated_at: new Date() },
    });
    await this.auditService.record(this.prisma, {
      userId,
      action: AUDIT_ACTIONS.CONSUMABLE_ACTIVE_CHANGED,
      entityType: 'consumable',
      entityId: id,
      description: `Insumo ${updated.name} ${isActive ? 'reactivado' : 'desactivado'}.`,
      oldValues: { isActive: !isActive },
      newValues: { isActive },
    });
    return toConsumableView(updated);
  }

  async adjust(
    id: bigint,
    dto: AdjustConsumableDto,
    userId: bigint,
  ): Promise<ConsumableView> {
    const existing = await this.prisma.consumables.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Insumo no encontrado.');

    const quantityBefore = existing.quantity;
    const quantityAfter = quantityBefore + dto.quantityChange;
    if (quantityAfter < 0) {
      throw new BadRequestException(
        `No puedes ajustar a un stock negativo (actual: ${quantityBefore}).`,
      );
    }
    if (dto.cost !== undefined) {
      if (dto.quantityChange <= 0) {
        throw new BadRequestException(
          'El costo solo aplica cuando agregas existencias (cantidad positiva).',
        );
      }
      if (!dto.paymentMethodId) {
        throw new BadRequestException(
          'Selecciona una forma de pago para registrar el costo.',
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const consumable = await tx.consumables.update({
        where: { id },
        data: { quantity: quantityAfter, updated_at: new Date() },
      });

      if (dto.cost !== undefined && dto.paymentMethodId) {
        await this.recordPackagingExpense(
          tx,
          `Reabastecimiento de insumo: ${consumable.name}`,
          dto.cost,
          dto.paymentMethodId,
          userId,
        );
      }

      return consumable;
    });

    await this.auditService.record(this.prisma, {
      userId,
      action: AUDIT_ACTIONS.CONSUMABLE_ADJUSTED,
      entityType: 'consumable',
      entityId: id,
      description: `Ajuste de insumo: ${updated.name} ${dto.quantityChange > 0 ? '+' : ''}${dto.quantityChange}.`,
      oldValues: { quantity: quantityBefore },
      newValues: { quantity: quantityAfter },
    });
    return toConsumableView(updated);
  }

  /**
   * Descuenta automáticamente cada insumo activo al confirmarse una venta
   * (p. ej. bolsas de empaque). Se llama DENTRO de la misma transacción que
   * crea la venta, pero a diferencia del descuento de inventario de
   * productos, NUNCA bloquea la venta: si ya no queda stock, se queda en 0 y
   * solo aparecerá como alerta de stock bajo/agotado.
   */
  async decrementForSale(tx: Prisma.TransactionClient): Promise<void> {
    const items = await tx.consumables.findMany({ where: { is_active: true } });
    for (const item of items) {
      const quantityAfter = Math.max(0, item.quantity - item.units_per_sale);
      if (quantityAfter === item.quantity) continue;
      await tx.consumables.update({
        where: { id: item.id },
        data: { quantity: quantityAfter, updated_at: new Date() },
      });
    }
  }
}
