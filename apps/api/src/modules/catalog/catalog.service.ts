import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Misma convención ya usada por los datos sembrados en Fase 1 para
 * `normalized_name` (p.ej. "Café" → "CAFE"): mayúsculas, sin acentos. */
function normalizeName(name: string): string {
  return name.trim().toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

interface SimpleEntity {
  id: bigint;
  name: string;
  is_active: boolean;
}

function toSimpleView(entity: SimpleEntity) {
  return { id: entity.id, name: entity.name, isActive: entity.is_active };
}

interface NormalizedEntity extends SimpleEntity {
  normalized_name: string;
}

function toNormalizedView(entity: NormalizedEntity) {
  return {
    id: entity.id,
    name: entity.name,
    normalizedName: entity.normalized_name,
    isActive: entity.is_active,
  };
}

interface PaymentMethodEntity {
  id: bigint;
  name: string;
  applies_to_sales: boolean;
  applies_to_purchases: boolean;
  applies_to_expenses: boolean;
  is_active: boolean;
}

function toPaymentMethodView(entity: PaymentMethodEntity) {
  return {
    id: entity.id,
    name: entity.name,
    appliesToSales: entity.applies_to_sales,
    appliesToPurchases: entity.applies_to_purchases,
    appliesToExpenses: entity.applies_to_expenses,
    isActive: entity.is_active,
  };
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async listCategories() {
    const rows = await this.prisma.categories.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toSimpleView);
  }

  async listAllCategories() {
    const rows = await this.prisma.categories.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map(toSimpleView);
  }

  async createCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed)
      throw new BadRequestException('El nombre de la categoría es requerido.');
    const existing = await this.prisma.categories.findUnique({
      where: { name: trimmed },
    });
    if (existing) {
      throw new ConflictException(`La categoría "${trimmed}" ya existe.`);
    }
    const created = await this.prisma.categories.create({
      data: { name: trimmed },
    });
    return toSimpleView(created);
  }

  async setCategoryActive(id: bigint, isActive: boolean) {
    const category = await this.prisma.categories.findUnique({ where: { id } });
    if (!category) throw new NotFoundException('Categoría no encontrada.');
    const updated = await this.prisma.categories.update({
      where: { id },
      data: { is_active: isActive },
    });
    return toSimpleView(updated);
  }

  async listSizes() {
    const rows = await this.prisma.sizes.findMany({
      where: { is_active: true },
      orderBy: { id: 'asc' },
    });
    return rows.map(toNormalizedView);
  }

  async listAllSizes() {
    const rows = await this.prisma.sizes.findMany({ orderBy: { id: 'asc' } });
    return rows.map(toNormalizedView);
  }

  async createSize(name: string) {
    const trimmed = name.trim();
    if (!trimmed)
      throw new BadRequestException('El nombre de la talla es requerido.');
    const normalized = normalizeName(trimmed);
    const existing = await this.prisma.sizes.findUnique({
      where: { normalized_name: normalized },
    });
    if (existing) {
      throw new ConflictException(`La talla "${trimmed}" ya existe.`);
    }
    const created = await this.prisma.sizes.create({
      data: { name: trimmed, normalized_name: normalized },
    });
    return toNormalizedView(created);
  }

  async setSizeActive(id: bigint, isActive: boolean) {
    const size = await this.prisma.sizes.findUnique({ where: { id } });
    if (!size) throw new NotFoundException('Talla no encontrada.');
    const updated = await this.prisma.sizes.update({
      where: { id },
      data: { is_active: isActive },
    });
    return toNormalizedView(updated);
  }

  async listColors() {
    const rows = await this.prisma.colors.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toNormalizedView);
  }

  async listAllColors() {
    const rows = await this.prisma.colors.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map(toNormalizedView);
  }

  async createColor(name: string) {
    const trimmed = name.trim();
    if (!trimmed)
      throw new BadRequestException('El nombre del color es requerido.');
    const normalized = normalizeName(trimmed);
    const existing = await this.prisma.colors.findUnique({
      where: { normalized_name: normalized },
    });
    if (existing) {
      throw new ConflictException(`El color "${trimmed}" ya existe.`);
    }
    const created = await this.prisma.colors.create({
      data: { name: trimmed, normalized_name: normalized },
    });
    return toNormalizedView(created);
  }

  async setColorActive(id: bigint, isActive: boolean) {
    const color = await this.prisma.colors.findUnique({ where: { id } });
    if (!color) throw new NotFoundException('Color no encontrado.');
    const updated = await this.prisma.colors.update({
      where: { id },
      data: { is_active: isActive },
    });
    return toNormalizedView(updated);
  }

  async listPaymentMethods(
    context: 'purchases' | 'sales' | 'expenses' = 'purchases',
  ) {
    const contextFilter =
      context === 'sales'
        ? { applies_to_sales: true }
        : context === 'expenses'
          ? { applies_to_expenses: true }
          : { applies_to_purchases: true };
    const rows = await this.prisma.payment_methods.findMany({
      where: { is_active: true, ...contextFilter },
      orderBy: { name: 'asc' },
    });
    return rows.map(toPaymentMethodView);
  }

  async listAllPaymentMethods() {
    const rows = await this.prisma.payment_methods.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map(toPaymentMethodView);
  }

  async setPaymentMethodActive(id: bigint, isActive: boolean) {
    const method = await this.prisma.payment_methods.findUnique({
      where: { id },
    });
    if (!method) throw new NotFoundException('Forma de pago no encontrada.');
    const updated = await this.prisma.payment_methods.update({
      where: { id },
      data: { is_active: isActive },
    });
    return toPaymentMethodView(updated);
  }

  async listExpenseCategories() {
    const rows = await this.prisma.expense_categories.findMany({
      where: { is_active: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toSimpleView);
  }

  async listAllExpenseCategories() {
    const rows = await this.prisma.expense_categories.findMany({
      orderBy: { name: 'asc' },
    });
    return rows.map(toSimpleView);
  }

  async createExpenseCategory(name: string) {
    const trimmed = name.trim();
    if (!trimmed)
      throw new BadRequestException('El nombre de la categoría es requerido.');
    const existing = await this.prisma.expense_categories.findUnique({
      where: { name: trimmed },
    });
    if (existing) {
      throw new ConflictException(
        `La categoría de gasto "${trimmed}" ya existe.`,
      );
    }
    const created = await this.prisma.expense_categories.create({
      data: { name: trimmed },
    });
    return toSimpleView(created);
  }

  async setExpenseCategoryActive(id: bigint, isActive: boolean) {
    const category = await this.prisma.expense_categories.findUnique({
      where: { id },
    });
    if (!category)
      throw new NotFoundException('Categoría de gasto no encontrada.');
    const updated = await this.prisma.expense_categories.update({
      where: { id },
      data: { is_active: isActive },
    });
    return toSimpleView(updated);
  }
}
