import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ACTIONS, AuditService } from '../audit/audit.service';
import {
  COGS_REFERENCE_TYPES,
  EXPENSE_MOVEMENT_TYPES,
  MOVEMENT_TYPES,
  MovementType,
  SALE_LIFECYCLE_MOVEMENT_TYPES,
} from './finance.constants';
import { CreateManualIncomeDto } from './dto/create-manual-income.dto';
import { QueryFinanceMovementsDto } from './dto/query-finance-movements.dto';
import { QueryFinanceSummaryDto } from './dto/query-finance-summary.dto';
import { UpdateDistributionSettingsDto } from './dto/update-distribution-settings.dto';
import {
  DistributionSettingsView,
  FinanceMovementView,
  FinanceSummary,
  toMovementView,
} from './finance.mapper';

const MOVEMENT_INCLUDE = {
  payment_methods: true,
  users: true,
} satisfies Prisma.financial_movementsInclude;

export interface RecordMovementInput {
  movementType: MovementType;
  direction: 'IN' | 'OUT';
  amount: Prisma.Decimal;
  paymentMethodId: bigint | null;
  referenceType: string;
  referenceId: bigint;
  description: string;
  createdBy: bigint;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Único punto de escritura del libro unificado `financial_movements`.
   * Lo llaman Ventas/Compras/Gastos DENTRO de su propia transacción, para
   * que una operación nunca quede registrada sin su movimiento financiero
   * (o viceversa).
   */
  async recordMovement(
    tx: Prisma.TransactionClient,
    input: RecordMovementInput,
  ): Promise<void> {
    await tx.financial_movements.create({
      data: {
        movement_type: input.movementType,
        direction: input.direction,
        amount: input.amount,
        payment_method_id: input.paymentMethodId,
        reference_type: input.referenceType,
        reference_id: input.referenceId,
        description: input.description,
        created_by: input.createdBy,
      },
    });
  }

  /**
   * Ingreso manual (ej. inyección de capital) sin venta de por medio.
   * Reutiliza las formas de pago de "gastos" (ninguna forma de pago aplica
   * específicamente a ingresos manuales todavía, y son igual de genéricas:
   * Efectivo/Transferencia). No tiene entidad propia: es solo una fila en
   * `financial_movements`, ya visible en Finanzas/Actividad como cualquier
   * otro movimiento.
   */
  async createManualIncome(
    dto: CreateManualIncomeDto,
    userId: bigint,
  ): Promise<FinanceMovementView> {
    const paymentMethod = await this.prisma.payment_methods.findUnique({
      where: { id: BigInt(dto.paymentMethodId) },
    });
    if (!paymentMethod || !paymentMethod.applies_to_expenses) {
      throw new BadRequestException(
        'La forma de pago seleccionada no es válida.',
      );
    }

    const created = await this.prisma.financial_movements.create({
      data: {
        movement_type: MOVEMENT_TYPES.MANUAL_INCOME,
        direction: 'IN',
        amount: new Prisma.Decimal(dto.amount),
        payment_method_id: BigInt(dto.paymentMethodId),
        description: dto.description.trim(),
        created_by: userId,
      },
      include: MOVEMENT_INCLUDE,
    });
    return toMovementView(created);
  }

  resolvePeriod(dto: QueryFinanceSummaryDto): {
    from: Date;
    to: Date;
    label: string;
  } {
    const period = dto.period ?? 'week';
    const now = new Date();

    if (period === 'custom') {
      if (!dto.from || !dto.to) {
        throw new BadRequestException(
          'Indica "from" y "to" para consultar un periodo personalizado.',
        );
      }
      const from = new Date(dto.from);
      const to = new Date(dto.to);
      if (!(to.getTime() > from.getTime())) {
        throw new BadRequestException(
          'La fecha final debe ser posterior a la inicial.',
        );
      }
      return { from, to, label: 'Personalizado' };
    }

    if (period === 'month') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { from, to, label: 'Este mes' };
    }

    if (period === 'year') {
      const from = new Date(now.getFullYear(), 0, 1);
      const to = new Date(now.getFullYear() + 1, 0, 1);
      return { from, to, label: 'Este año' };
    }

    // Semana calendario: lunes a domingo.
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const from = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - diffToMonday,
    );
    const to = new Date(
      from.getFullYear(),
      from.getMonth(),
      from.getDate() + 7,
    );
    return { from, to, label: 'Esta semana' };
  }

  async getSummary(dto: QueryFinanceSummaryDto): Promise<FinanceSummary> {
    const range = this.resolvePeriod(dto);

    const [periodGroups, allTimeGroups, distributionSettings] =
      await Promise.all([
        this.prisma.financial_movements.groupBy({
          by: ['movement_type', 'direction'],
          where: { movement_date: { gte: range.from, lt: range.to } },
          _sum: { amount: true },
        }),
        this.prisma.financial_movements.groupBy({
          by: ['direction'],
          _sum: { amount: true },
        }),
        this.getDistributionSettings(),
      ]);

    const netByType = (types: MovementType[]): Prisma.Decimal =>
      periodGroups
        .filter((g) => types.includes(g.movement_type as MovementType))
        .reduce((sum, g) => {
          const amount = g._sum.amount ?? new Prisma.Decimal(0);
          return g.direction === 'IN' ? sum.plus(amount) : sum.minus(amount);
        }, new Prisma.Decimal(0));

    const sumByType = (
      type: MovementType,
      direction: 'IN' | 'OUT',
    ): Prisma.Decimal =>
      periodGroups.find(
        (g) => g.movement_type === type && g.direction === direction,
      )?._sum.amount ?? new Prisma.Decimal(0);

    const ingresos = periodGroups
      .filter((g) => g.direction === 'IN')
      .reduce(
        (sum, g) => sum.plus(g._sum.amount ?? new Prisma.Decimal(0)),
        new Prisma.Decimal(0),
      );
    const salidas = periodGroups
      .filter((g) => g.direction === 'OUT')
      .reduce(
        (sum, g) => sum.plus(g._sum.amount ?? new Prisma.Decimal(0)),
        new Prisma.Decimal(0),
      );

    const allTimeIn =
      allTimeGroups.find((g) => g.direction === 'IN')?._sum.amount ??
      new Prisma.Decimal(0);
    const allTimeOut =
      allTimeGroups.find((g) => g.direction === 'OUT')?._sum.amount ??
      new Prisma.Decimal(0);
    const disponible = allTimeIn.minus(allTimeOut);

    const netSales = netByType(SALE_LIFECYCLE_MOVEMENT_TYPES);
    // netByType da "IN - OUT": para gastos (categoría dominada por salidas)
    // esto resulta NEGATIVO cuando se gastó más de lo anulado. "gastosSpent"
    // lo expresa como un monto positivo = lo realmente gastado neto.
    const netExpenses = netByType(EXPENSE_MOVEMENT_TYPES);
    const gastosSpent = netExpenses.negated();
    const cogs = await this.getCostOfGoodsSold(range);
    const realProfitRaw = netSales.minus(cogs).minus(gastosSpent);
    const hasProfit = realProfitRaw.greaterThan(0);
    const realProfit = hasProfit ? realProfitRaw : new Prisma.Decimal(0);

    const personalAmount = hasProfit
      ? realProfit.times(distributionSettings.personalPercentage).dividedBy(100)
      : new Prisma.Decimal(0);
    const reinvestmentAmount = hasProfit
      ? realProfit
          .times(distributionSettings.reinvestmentPercentage)
          .dividedBy(100)
      : new Prisma.Decimal(0);
    const reserveAmount = hasProfit
      ? realProfit.times(distributionSettings.reservePercentage).dividedBy(100)
      : new Prisma.Decimal(0);

    return {
      period: range,
      ingresos,
      salidas,
      disponible,
      netSales,
      cogs,
      breakdown: {
        ventas: sumByType('SALE', 'IN'),
        devoluciones: sumByType('SALE_RETURN', 'OUT'),
        cancelaciones: sumByType('SALE_CANCELLATION', 'OUT'),
        correcciones: netByType(['SALE_CORRECTION']),
        cambios: netByType(['EXCHANGE_DIFFERENCE']),
        compras: sumByType('PURCHASE', 'OUT'),
        gastos: gastosSpent,
        ingresoManual: sumByType('MANUAL_INCOME', 'IN'),
      },
      distribution: {
        hasProfit,
        realProfit: realProfitRaw,
        personalPercentage: distributionSettings.personalPercentage,
        reinvestmentPercentage: distributionSettings.reinvestmentPercentage,
        reservePercentage: distributionSettings.reservePercentage,
        personalAmount,
        reinvestmentAmount,
        reserveAmount,
      },
    };
  }

  /**
   * Costo de la mercadería realmente vendida en el periodo, derivado de
   * `inventory_movements` (ya es la fuente de verdad del costo por unidad
   * en cada entrada/salida ligada a una venta). SALIDA tiene cantidad
   * negativa (suma costo), ENTRADA por devolución/cambio/cancelación tiene
   * cantidad positiva (resta costo) — así que -1 * Σ(costo × cantidad) da
   * directamente el costo neto de lo que el cliente realmente se quedó.
   * Deliberadamente NO incluye 'purchase' (comprar mercadería no es costo
   * de lo vendido) ni 'adjustment' (ajuste manual, ajeno a una venta).
   */
  private async getCostOfGoodsSold(range: {
    from: Date;
    to: Date;
  }): Promise<Prisma.Decimal> {
    const movements = await this.prisma.inventory_movements.findMany({
      where: {
        reference_type: { in: COGS_REFERENCE_TYPES },
        created_at: { gte: range.from, lt: range.to },
      },
      select: { unit_cost: true, quantity: true },
    });
    return movements.reduce((sum, m) => {
      const unitCost = m.unit_cost ?? new Prisma.Decimal(0);
      return sum.minus(unitCost.times(m.quantity));
    }, new Prisma.Decimal(0));
  }

  async listMovements(
    query: QueryFinanceMovementsDto,
  ): Promise<Paginated<FinanceMovementView>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.financial_movementsWhereInput = {};
    if (query.movementType) where.movement_type = query.movementType;
    if (query.direction) where.direction = query.direction;
    if (query.paymentMethodId)
      where.payment_method_id = BigInt(query.paymentMethodId);
    if (query.from || query.to) {
      where.movement_date = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lt: new Date(query.to) } : {}),
      };
    }
    if (query.search?.trim()) {
      where.description = { contains: query.search.trim() };
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.financial_movements.findMany({
        where,
        include: MOVEMENT_INCLUDE,
        orderBy: { movement_date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.financial_movements.count({ where }),
    ]);

    return { items: items.map(toMovementView), total, page, pageSize };
  }

  async getDistributionSettings(): Promise<DistributionSettingsView> {
    const settings = await this.prisma.profit_distribution_settings.findFirst({
      orderBy: { id: 'asc' },
    });
    if (!settings) {
      // No debería ocurrir (la fila viene sembrada desde Fase 1), pero
      // evita que Finanzas se rompa si alguna vez falta.
      return {
        personalPercentage: new Prisma.Decimal(50),
        reinvestmentPercentage: new Prisma.Decimal(30),
        reservePercentage: new Prisma.Decimal(20),
        updatedAt: new Date(),
      };
    }
    return {
      personalPercentage: settings.personal_percentage,
      reinvestmentPercentage: settings.reinvestment_percentage,
      reservePercentage: settings.reserve_percentage,
      updatedAt: settings.updated_at,
    };
  }

  async updateDistributionSettings(
    dto: UpdateDistributionSettingsDto,
    userId: bigint,
  ): Promise<DistributionSettingsView> {
    const sum =
      dto.personalPercentage +
      dto.reinvestmentPercentage +
      dto.reservePercentage;
    if (Math.abs(sum - 100) > 0.01) {
      throw new BadRequestException('Los porcentajes deben sumar 100%.');
    }

    const existing = await this.prisma.profit_distribution_settings.findFirst({
      orderBy: { id: 'asc' },
    });

    const data = {
      personal_percentage: new Prisma.Decimal(dto.personalPercentage),
      reinvestment_percentage: new Prisma.Decimal(dto.reinvestmentPercentage),
      reserve_percentage: new Prisma.Decimal(dto.reservePercentage),
      updated_by: userId,
    };

    const updated = existing
      ? await this.prisma.profit_distribution_settings.update({
          where: { id: existing.id },
          data,
        })
      : await this.prisma.profit_distribution_settings.create({ data });

    await this.auditService.record(this.prisma, {
      userId,
      action: AUDIT_ACTIONS.SETTINGS_UPDATED,
      entityType: 'settings',
      description: 'Distribución de utilidad actualizada.',
      newValues: {
        personalPercentage: dto.personalPercentage,
        reinvestmentPercentage: dto.reinvestmentPercentage,
        reservePercentage: dto.reservePercentage,
      },
    });

    return {
      personalPercentage: updated.personal_percentage,
      reinvestmentPercentage: updated.reinvestment_percentage,
      reservePercentage: updated.reserve_percentage,
      updatedAt: updated.updated_at,
    };
  }
}
