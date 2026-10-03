import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ACTIONS, AuditService } from '../audit/audit.service';
import { AdjustInventoryDto } from './dto/adjust-inventory.dto';
import { AdjustVariantDto } from './dto/adjust-variant.dto';
import { QueryGroupedInventoryDto } from './dto/query-grouped-inventory.dto';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';
import {
  computeStatus,
  InventoryGroupedItemView,
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

export interface SaleExitLine {
  inventoryItemId: number;
  quantity: number;
}

export interface InventoryMovementLine {
  inventoryItemId: number;
  quantity: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

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

    await this.auditService.record(this.prisma, {
      userId,
      action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
      entityType: 'inventory_item',
      entityId: id,
      description: `Ajuste de inventario: ${updated.products.name} (${updated.sizes.name}/${updated.colors.name}) ${dto.quantityChange > 0 ? '+' : ''}${dto.quantityChange} — ${dto.reason}.`,
      oldValues: { quantity: updated.quantity - dto.quantityChange },
      newValues: { quantity: updated.quantity },
    });

    return toInventoryItemView(updated, threshold);
  }

  /**
   * Vista agrupable por producto: combina TODAS las combinaciones declaradas
   * en `product_variants` (no solo las que ya tienen fila en
   * `inventory_items`) con su stock real, para que una talla/color recién
   * declarada pero nunca comprada aparezca en 0 y se pueda ajustar desde
   * aquí — mismo principio que Disponibilidad, pero editable.
   */
  async listGroupedByProduct(
    query: QueryGroupedInventoryDto,
  ): Promise<InventoryGroupedItemView[]> {
    const threshold = await this.getLowStockThreshold();

    const where: Prisma.product_variantsWhereInput = {
      is_active: true,
      ...(query.productId
        ? { product_id: BigInt(query.productId) }
        : {
            products: {
              is_available_for_sale: true,
              ...(query.categoryId ? { category_id: BigInt(query.categoryId) } : {}),
            },
          }),
    };

    const variants = await this.prisma.product_variants.findMany({
      where,
      include: { products: true, sizes: true, colors: true },
      orderBy: [
        { products: { name: 'asc' } },
        { size_id: 'asc' },
        { color_id: 'asc' },
      ],
    });

    const productIds = [...new Set(variants.map((v) => v.product_id))];
    const inventoryRows = productIds.length
      ? await this.prisma.inventory_items.findMany({
          where: { product_id: { in: productIds } },
        })
      : [];
    const inventoryByKey = new Map(
      inventoryRows.map((i) => [
        `${i.product_id}-${i.size_id}-${i.color_id}`,
        i,
      ]),
    );

    let items: InventoryGroupedItemView[] = variants.map((v) => {
      const inv = inventoryByKey.get(
        `${v.product_id}-${v.size_id}-${v.color_id}`,
      );
      const quantity = inv?.quantity ?? 0;
      return {
        inventoryItemId: inv?.id ?? null,
        productId: v.product_id,
        productName: v.products.name,
        productCode: v.products.code,
        sizeId: v.size_id,
        sizeName: v.sizes.name,
        colorId: v.color_id,
        colorName: v.colors.name,
        quantity,
        averageCost: inv?.average_cost ?? null,
        status: computeStatus(quantity, threshold),
      };
    });

    if (query.search?.trim()) {
      const tokens = query.search
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
      items = items.filter((item) => {
        const haystack = [
          item.productName,
          item.productCode,
          item.sizeName,
          item.colorName,
        ]
          .join(' ')
          .toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      });
    }

    return items;
  }

  /**
   * Ajusta (o crea) el inventario de una combinación identificada por
   * producto+talla+color, sin exigir que ya exista una fila en
   * `inventory_items` — a diferencia de `adjust()`, que solo opera sobre una
   * fila ya existente. Pensado para dar stock inicial a una combinación
   * declarada pero nunca comprada, sin tener que registrar una compra falsa.
   */
  async adjustByVariant(
    dto: AdjustVariantDto,
    userId: bigint,
  ): Promise<InventoryItemView> {
    if (dto.reason === 'Otro' && !dto.notes?.trim()) {
      throw new BadRequestException(
        'Explica el motivo cuando selecciones "Otro".',
      );
    }

    const threshold = await this.getLowStockThreshold();
    const productId = BigInt(dto.productId);
    const sizeId = BigInt(dto.sizeId);
    const colorId = BigInt(dto.colorId);

    const updated = await this.prisma.$transaction(async (tx) => {
      const variant = await tx.product_variants.findUnique({
        where: {
          product_id_size_id_color_id: {
            product_id: productId,
            size_id: sizeId,
            color_id: colorId,
          },
        },
      });
      if (!variant || !variant.is_active) {
        throw new BadRequestException(
          'Esta combinación no está declarada en el producto.',
        );
      }

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
      const quantityAfter = quantityBefore + dto.quantityChange;
      if (quantityAfter < 0) {
        throw new BadRequestException(
          `No puedes ajustar a un stock negativo (actual: ${quantityBefore}).`,
        );
      }

      const item = existing
        ? await tx.inventory_items.update({
            where: { id: existing.id },
            data: {
              quantity: quantityAfter,
              is_available_for_sale: quantityAfter > 0,
            },
          })
        : await tx.inventory_items.create({
            data: {
              product_id: productId,
              size_id: sizeId,
              color_id: colorId,
              quantity: quantityAfter,
              average_cost: new Prisma.Decimal(0),
              is_available_for_sale: quantityAfter > 0,
            },
          });

      await tx.inventory_movements.create({
        data: {
          inventory_item_id: item.id,
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
        where: { id: item.id },
        include: ITEM_INCLUDE,
      });
    });

    await this.auditService.record(this.prisma, {
      userId,
      action: AUDIT_ACTIONS.INVENTORY_ADJUSTED,
      entityType: 'inventory_item',
      entityId: updated.id,
      description: `Ajuste de inventario: ${updated.products.name} (${updated.sizes.name}/${updated.colors.name}) ${dto.quantityChange > 0 ? '+' : ''}${dto.quantityChange} — ${dto.reason}.`,
      oldValues: { quantity: updated.quantity - dto.quantityChange },
      newValues: { quantity: updated.quantity },
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

  /**
   * Descuenta inventario por una venta confirmada y registra la SALIDA
   * correspondiente. Se llama DENTRO de la misma transacción con la que
   * SalesService crea la venta: si el stock no alcanza, toda la venta se
   * revierte (no queda una venta creada sin su descuento de inventario).
   */
  async applySaleExits(
    tx: Prisma.TransactionClient,
    saleId: bigint,
    lines: SaleExitLine[],
    createdBy: bigint,
  ): Promise<void> {
    for (const line of lines) {
      const id = BigInt(line.inventoryItemId);
      const item = await tx.inventory_items.findUniqueOrThrow({
        where: { id },
      });

      const quantityBefore = item.quantity;
      const quantityAfter = quantityBefore - line.quantity;
      if (quantityAfter < 0) {
        throw new BadRequestException(
          `Stock insuficiente (disponible: ${quantityBefore}).`,
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
          movement_type: 'SALIDA',
          quantity: -line.quantity,
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
          unit_cost: item.average_cost,
          reference_type: 'sale',
          reference_id: saleId,
          created_by: createdBy,
        },
      });
    }
  }

  /**
   * Reintegra unidades a un inventory_item ya existente (ENTRADA), para
   * operaciones posteriores a una venta: devolución, cancelación, el lado
   * "IN" de un cambio, o el lado de reversión de una corrección. No
   * recalcula average_cost: son las mismas unidades regresando, no una
   * compra nueva.
   */
  async applyRestock(
    tx: Prisma.TransactionClient,
    referenceType: string,
    referenceId: bigint,
    lines: InventoryMovementLine[],
    createdBy: bigint,
  ): Promise<void> {
    for (const line of lines) {
      const id = BigInt(line.inventoryItemId);
      const item = await tx.inventory_items.findUniqueOrThrow({
        where: { id },
      });

      const quantityBefore = item.quantity;
      const quantityAfter = quantityBefore + line.quantity;

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
          movement_type: 'ENTRADA',
          quantity: line.quantity,
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
          unit_cost: item.average_cost,
          reference_type: referenceType,
          reference_id: referenceId,
          created_by: createdBy,
        },
      });
    }
  }

  /**
   * Descuenta unidades de un inventory_item ya existente (SALIDA), para el
   * lado "OUT" de un cambio o el lado de aplicación de una corrección de
   * variante/cantidad. No permite dejar stock negativo.
   */
  async applyExit(
    tx: Prisma.TransactionClient,
    referenceType: string,
    referenceId: bigint,
    lines: InventoryMovementLine[],
    createdBy: bigint,
  ): Promise<void> {
    for (const line of lines) {
      const id = BigInt(line.inventoryItemId);
      const item = await tx.inventory_items.findUniqueOrThrow({
        where: { id },
      });

      const quantityBefore = item.quantity;
      const quantityAfter = quantityBefore - line.quantity;
      if (quantityAfter < 0) {
        throw new BadRequestException(
          `Stock insuficiente (disponible: ${quantityBefore}).`,
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
          movement_type: 'SALIDA',
          quantity: -line.quantity,
          quantity_before: quantityBefore,
          quantity_after: quantityAfter,
          unit_cost: item.average_cost,
          reference_type: referenceType,
          reference_id: referenceId,
          created_by: createdBy,
        },
      });
    }
  }
}
