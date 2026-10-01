import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';
import {
  InventoryItemView,
  InventoryMovementView,
  toInventoryItemView,
  toMovementView,
} from './inventory.mapper';

const ITEM_INCLUDE = {
  products: true,
  sizes: true,
  colors: true,
} satisfies Prisma.inventory_itemsInclude;

const DEFAULT_LOW_STOCK_THRESHOLD = 2;

export interface PurchaseEntryLine {
  productId: number;
  sizeId: number;
  colorId: number;
  quantity: number;
  unitCost: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getLowStockThreshold(): Promise<number> {
    const setting = await this.prisma.app_settings.findUnique({
      where: { setting_key: 'low_stock_threshold' },
    });
    const parsed = setting ? Number(setting.setting_value) : NaN;
    return Number.isFinite(parsed) ? parsed : DEFAULT_LOW_STOCK_THRESHOLD;
  }

  async list(query: QueryInventoryDto): Promise<Paginated<InventoryItemView>> {
    const threshold = await this.getLowStockThreshold();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.inventory_itemsWhereInput = {};
    if (query.productId) where.product_id = BigInt(query.productId);
    if (query.available === 'true') where.quantity = { gt: 0 };
    if (query.available === 'false') where.quantity = { lte: 0 };
    if (query.search?.trim()) {
      const term = query.search.trim();
      const tokens = term.split(/\s+/).filter(Boolean);
      where.OR = [
        { products: { code: { contains: term } } },
        { products: { AND: tokens.map((t) => ({ name: { contains: t } })) } },
        { sizes: { name: { contains: term } } },
        { colors: { name: { contains: term } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.inventory_items.findMany({
        where,
        include: ITEM_INCLUDE,
        orderBy: [
          { products: { name: 'asc' } },
          { size_id: 'asc' },
          { color_id: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inventory_items.count({ where }),
    ]);

    return {
      items: items.map((i) => toInventoryItemView(i, threshold)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(
    id: bigint,
  ): Promise<{ item: InventoryItemView; movements: InventoryMovementView[] }> {
    const threshold = await this.getLowStockThreshold();
    const item = await this.prisma.inventory_items.findUnique({
      where: { id },
      include: ITEM_INCLUDE,
    });
    if (!item) {
      throw new NotFoundException('Inventario no encontrado.');
    }
    const movements = await this.prisma.inventory_movements.findMany({
      where: { inventory_item_id: id },
      include: { users: true },
      orderBy: { created_at: 'desc' },
    });
    return {
      item: toInventoryItemView(item, threshold),
      movements: movements.map(toMovementView),
    };
  }

  async listMovements(
    query: QueryMovementsDto,
  ): Promise<Paginated<InventoryMovementView>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const itemWhere: Prisma.inventory_itemsWhereInput = {};
    if (query.productId) itemWhere.product_id = BigInt(query.productId);
    if (query.sizeId) itemWhere.size_id = BigInt(query.sizeId);
    if (query.colorId) itemWhere.color_id = BigInt(query.colorId);

    const where: Prisma.inventory_movementsWhereInput = {
      ...(query.movementType ? { movement_type: query.movementType } : {}),
      ...(query.productId || query.sizeId || query.colorId
        ? { inventory_items: itemWhere }
        : {}),
    };

    const [movements, total] = await this.prisma.$transaction([
      this.prisma.inventory_movements.findMany({
        where,
        include: { users: true },
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.inventory_movements.count({ where }),
    ]);

    return { items: movements.map(toMovementView), total, page, pageSize };
  }

  async adjust(
    id: bigint,
    dto: AdjustInventoryDto,
    userId: bigint,
  ): Promise<InventoryItemView> {
    if (dto.reason === 'Otro' && !dto.notes?.trim()) {
      throw new BadRequestException(
        'Explica el motivo cuando selecciones "Otro".',
      );
    }

    const threshold = await this.getLowStockThreshold();

    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.inventory_items.findUnique({ where: { id } });
      if (!item) {
        throw new NotFoundException('Inventario no encontrado.');
      }

      const quantityBefore = item.quantity;
      const quantityAfter = quantityBefore + dto.quantityChange;
      if (quantityAfter < 0) {
        throw new BadRequestException(
          `No puedes ajustar a un stock negativo (actual: ${quantityBefore}).`,
        );
      }

      await tx.inventory_items.update({
        where: { id },
        data: {
          quantity: quantityAfter,
          is_available_for_sale: quantityAfter > 0,
        },
      });

      await tx.inventory_movements.create({
        data: {
          inventory_item_id: id,
          movement_type: 'AJUSTE',
          quantity: dto.quantityChange,
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
          reference_type: 'adjustment',
          reason: dto.reason,
          notes: dto.notes?.trim() || null,
          created_by: userId,
        },
      });

      return tx.inventory_items.findUniqueOrThrow({
        where: { id },
        include: ITEM_INCLUDE,
      });
    });

    return toInventoryItemView(updated, threshold);
  }

  /**
   * Genera las entradas de inventario de una compra. Se llama DENTRO de la
   * misma transacción con la que PurchasesService crea la compra: así una
   * compra nunca puede quedar confirmada con el inventario a medias, y
   * tampoco puede duplicar su propia entrada (solo se ejecuta una vez, en
   * el mismo request que crea la compra).
   */
  async applyPurchaseEntries(
    tx: Prisma.TransactionClient,
    purchaseId: bigint,
    items: PurchaseEntryLine[],
    createdBy: bigint,
  ): Promise<void> {
    for (const line of items) {
      const productId = BigInt(line.productId);
      const sizeId = BigInt(line.sizeId);
      const colorId = BigInt(line.colorId);
      const unitCost = new Prisma.Decimal(line.unitCost);

      const existing = await tx.inventory_items.findUnique({
        where: {
          product_id_size_id_color_id: {
            product_id: productId,
            size_id: sizeId,
            color_id: colorId,
          },
        },
      });

      const quantityBefore = existing?.quantity ?? 0;
      const quantityAfter = quantityBefore + line.quantity;
      const previousTotalCost = existing
        ? existing.average_cost.times(existing.quantity)
        : new Prisma.Decimal(0);
      const newAverageCost = previousTotalCost
        .plus(unitCost.times(line.quantity))
        .dividedBy(quantityAfter);

      const inventoryItem = existing
        ? await tx.inventory_items.update({
            where: { id: existing.id },
            data: {
              quantity: quantityAfter,
              average_cost: newAverageCost,
              is_available_for_sale: quantityAfter > 0,
            },
          })
        : await tx.inventory_items.create({
            data: {
              product_id: productId,
              size_id: sizeId,
              color_id: colorId,
              quantity: quantityAfter,
              average_cost: newAverageCost,
              is_available_for_sale: quantityAfter > 0,
            },
          });

      await tx.inventory_movements.create({
        data: {
          inventory_item_id: inventoryItem.id,
          movement_type: 'ENTRADA',
          quantity: line.quantity,
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
          unit_cost: unitCost,
          reference_type: 'purchase',
          reference_id: purchaseId,
          created_by: createdBy,
        },
      });
    }
  }
}
