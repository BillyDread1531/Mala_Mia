import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MOVEMENT_TYPES } from '../finance/finance.constants';
import { FinanceService } from '../finance/finance.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { QueryExpensesDto } from './dto/query-expenses.dto';
import { VoidExpenseDto } from './dto/void-expense.dto';
import { ExpenseView, toExpenseView } from './expenses.mapper';

const EXPENSE_INCLUDE = {
  expense_categories: true,
  payment_methods: true,
  users: true,
} satisfies Prisma.expensesInclude;

export interface PaginatedExpenses {
  items: ExpenseView[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
  ) {}

  async list(query: QueryExpensesDto): Promise<PaginatedExpenses> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.expensesWhereInput = {};
    if (query.categoryId) where.category_id = BigInt(query.categoryId);
    if (query.paymentMethodId)
      where.payment_method_id = BigInt(query.paymentMethodId);
    if (query.status) where.status = query.status;
    if (query.from || query.to) {
      where.expense_date = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lt: new Date(query.to) } : {}),
      };
    }
    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { description: { contains: term } },
        { expense_categories: { name: { contains: term } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.expenses.findMany({
        where,
        include: EXPENSE_INCLUDE,
        orderBy: { expense_date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.expenses.count({ where }),
    ]);

    return { items: items.map(toExpenseView), total, page, pageSize };
  }

  async findOne(id: bigint): Promise<ExpenseView> {
    const expense = await this.prisma.expenses.findUnique({
      where: { id },
      include: EXPENSE_INCLUDE,
    });
    if (!expense) {
      throw new NotFoundException('Gasto no encontrado.');
    }
    return toExpenseView(expense);
  }

  async create(dto: CreateExpenseDto, userId: bigint): Promise<ExpenseView> {
    const created = await this.prisma.$transaction((tx) =>
      this.createInTransaction(tx, dto, userId),
    );
    return toExpenseView(created);
  }

  /**
   * Núcleo transaccional de `create`, reutilizable por otros módulos que
   * necesitan registrar un gasto como parte de SU PROPIA transacción (ej.
   * Insumos, cuando se compra material de empaque junto con darle entrada al
   * stock) — así ese gasto y la operación que lo originó quedan atómicos,
   * sin duplicar la validación de categoría/forma de pago ni el registro en
   * `financial_movements`.
   */
  async createInTransaction(
    tx: Prisma.TransactionClient,
    dto: CreateExpenseDto,
    userId: bigint,
  ) {
    const category = await tx.expense_categories.findUnique({
      where: { id: BigInt(dto.categoryId) },
    });
    if (!category || !category.is_active) {
      throw new BadRequestException(
        'La categoría seleccionada no existe o no está activa.',
      );
    }

    const paymentMethod = await tx.payment_methods.findUnique({
      where: { id: BigInt(dto.paymentMethodId) },
    });
    if (!paymentMethod || !paymentMethod.applies_to_expenses) {
      throw new BadRequestException(
        'La forma de pago seleccionada no es válida para gastos.',
      );
    }

    const expense = await tx.expenses.create({
      data: {
        category_id: BigInt(dto.categoryId),
        description: dto.description.trim(),
        amount: new Prisma.Decimal(dto.amount),
        payment_method_id: BigInt(dto.paymentMethodId),
        expense_date: dto.expenseDate ? new Date(dto.expenseDate) : undefined,
        notes: dto.notes?.trim() || null,
        created_by: userId,
      },
    });

    // Misma transacción: si esto falla, el gasto tampoco queda registrado.
    await this.financeService.recordMovement(tx, {
      movementType: MOVEMENT_TYPES.EXPENSE,
      direction: 'OUT',
      amount: expense.amount,
      paymentMethodId: expense.payment_method_id,
      referenceType: 'expense',
      referenceId: expense.id,
      description: `Gasto: ${expense.description}`,
      createdBy: userId,
    });

    return tx.expenses.findUniqueOrThrow({
      where: { id: expense.id },
      include: EXPENSE_INCLUDE,
    });
  }

  /**
   * Anula un gasto sin borrarlo: lo marca VOIDED y registra un movimiento
   * ENTRADA que revierte el monto original (mismo principio de Fase 8 para
   * ventas — nunca editar/borrar un movimiento histórico, solo agregar la
   * operación inversa). Para "corregir" un gasto, el flujo es anular este y
   * registrar uno nuevo con los datos correctos: mantiene ambos visibles en
   * el historial con su usuario y fecha, sin inventar una tabla de
   * correcciones nueva para un caso tan simple.
   */
  async void(
    id: bigint,
    dto: VoidExpenseDto,
    userId: bigint,
  ): Promise<ExpenseView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const expense = await tx.expenses.findUnique({ where: { id } });
      if (!expense) {
        throw new NotFoundException('Gasto no encontrado.');
      }
      if (expense.status === 'VOIDED') {
        throw new BadRequestException('Este gasto ya fue anulado.');
      }

      await tx.expenses.update({
        where: { id },
        data: {
          status: 'VOIDED',
          notes: dto.reason
            ? `${expense.notes ? `${expense.notes} | ` : ''}Anulado: ${dto.reason}`
            : expense.notes,
        },
      });

      await this.financeService.recordMovement(tx, {
        movementType: MOVEMENT_TYPES.EXPENSE_VOID,
        direction: 'IN',
        amount: expense.amount,
        paymentMethodId: expense.payment_method_id,
        referenceType: 'expense',
        referenceId: expense.id,
        description: `Anulación de gasto: ${expense.description}`,
        createdBy: userId,
      });

      return tx.expenses.findUniqueOrThrow({
        where: { id },
        include: EXPENSE_INCLUDE,
      });
    });

    return toExpenseView(updated);
  }
}
