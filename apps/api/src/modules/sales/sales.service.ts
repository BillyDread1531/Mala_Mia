import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ConsumablesService } from '../consumables/consumables.service';
import { MOVEMENT_TYPES } from '../finance/finance.constants';
import { FinanceService } from '../finance/finance.service';
import { InventoryService } from '../inventory/inventory.service';
import { CancelSaleDto } from './dto/cancel-sale.dto';
import { CreateCorrectionDto } from './dto/create-correction.dto';
import { CreateExchangeDto } from './dto/create-exchange.dto';
import { CreateReturnDto } from './dto/create-return.dto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { QuerySalesDto } from './dto/query-sales.dto';
import { SaleHistoryEntry, SaleView, toSaleView } from './sales.mapper';

const SALE_INCLUDE = {
  payment_methods: true,
  sale_items: { include: { products: true, sizes: true, colors: true } },
} satisfies Prisma.salesInclude;

const SALE_NUMBER_DIGITS = 5;

interface SaleLine {
  inventoryItemId: bigint;
  productId: bigint;
  sizeId: bigint;
  colorId: bigint;
  quantity: number;
  unitSalePrice: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  discountAmount: Prisma.Decimal;
  subtotal: Prisma.Decimal;
}

export interface PaginatedSales {
  items: SaleView[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly financeService: FinanceService,
    private readonly consumablesService: ConsumablesService,
  ) {}

  private async generateSaleNumber(): Promise<string> {
    const last = await this.prisma.sales.findFirst({
      orderBy: { sale_number: 'desc' },
      select: { sale_number: true },
    });
    const nextSequence = last ? parseInt(last.sale_number, 10) + 1 : 1;
    return String(nextSequence).padStart(SALE_NUMBER_DIGITS, '0');
  }

  async list(query: QuerySalesDto): Promise<PaginatedSales> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const search = query.search?.trim();
    const where: Prisma.salesWhereInput = {
      ...(search
        ? {
            OR: [
              { sale_number: { contains: search } },
              {
                sale_items: {
                  some: { products: { name: { contains: search } } },
                },
              },
            ],
          }
        : {}),
      ...(query.from || query.to
        ? {
            sale_date: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.sales.findMany({
        where,
        include: SALE_INCLUDE,
        orderBy: { sale_date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.sales.count({ where }),
    ]);

    return { items: items.map(toSaleView), total, page, pageSize };
  }

  async findOne(id: bigint): Promise<SaleView> {
    const sale = await this.prisma.sales.findUnique({
      where: { id },
      include: SALE_INCLUDE,
    });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada.');
    }
    const view = toSaleView(sale);
    for (const item of view.items) {
      const [returned, exchanged] = await Promise.all([
        this.prisma.return_items.aggregate({
          where: { sale_item_id: item.id },
          _sum: { quantity: true },
        }),
        this.prisma.exchange_items.aggregate({
          where: { original_sale_item_id: item.id },
          _sum: { quantity: true },
        }),
      ]);
      item.returnableQuantity =
        item.quantity -
        (returned._sum.quantity ?? 0) -
        (exchanged._sum.quantity ?? 0);
    }

    const refunded = await this.prisma.returns.aggregate({
      where: { sale_id: id },
      _sum: { refund_amount: true },
    });
    view.totalRefunded = refunded._sum.refund_amount ?? new Prisma.Decimal(0);
    view.netTotal = view.total.minus(view.totalRefunded);

    return view;
  }

  async create(dto: CreateSaleDto, createdBy: bigint): Promise<SaleView> {
    const paymentMethod = await this.prisma.payment_methods.findUnique({
      where: { id: BigInt(dto.paymentMethodId) },
    });
    if (!paymentMethod || !paymentMethod.applies_to_sales) {
      throw new BadRequestException(
        'La forma de pago seleccionada no es válida para ventas.',
      );
    }

    const saleNumber = await this.generateSaleNumber();

    const created = await this.prisma.$transaction(async (tx) => {
      const lines = await this.loadAndValidateLines(tx, dto.items);

      const subtotal = lines.reduce(
        (sum, line) => sum.plus(line.subtotal),
        new Prisma.Decimal(0),
      );
      const discountAmount = lines.reduce(
        (sum, line) => sum.plus(line.discountAmount),
        new Prisma.Decimal(0),
      );
      // Envío "pass-through": lo que se le cobra al cliente es exactamente
      // lo que cuesta, así que no se registra como gasto aparte (ya viene
      // incluido en el monto de la venta, sin inflar ni restar utilidad).
      const shippingAmount = new Prisma.Decimal(dto.shippingAmount ?? 0);
      const total = subtotal.plus(shippingAmount);

      const sale = await tx.sales.create({
        data: {
          sale_number: saleNumber,
          subtotal,
          discount_amount: discountAmount,
          shipping_customer_amount: shippingAmount,
          shipping_actual_cost: shippingAmount,
          shipping_paid_by: shippingAmount.greaterThan(0) ? 'CUSTOMER' : null,
          total,
          payment_method_id: BigInt(dto.paymentMethodId),
          notes: dto.notes?.trim() || null,
          created_by: createdBy,
        },
      });

      await tx.sale_items.createMany({
        data: lines.map((line) => ({
          sale_id: sale.id,
          product_id: line.productId,
          inventory_item_id: line.inventoryItemId,
          size_id: line.sizeId,
          color_id: line.colorId,
          quantity: line.quantity,
          unit_sale_price: line.unitSalePrice,
          unit_cost: line.unitCost,
          discount_amount: line.discountAmount,
          subtotal: line.subtotal,
        })),
      });

      // Misma transacción: si el inventario no alcanza, la venta tampoco queda creada.
      await this.inventoryService.applySaleExits(
        tx,
        sale.id,
        lines.map((line) => ({
          inventoryItemId: Number(line.inventoryItemId),
          quantity: line.quantity,
        })),
        createdBy,
      );

      // Insumos (bolsas/empaque): se descuentan solos, nunca bloquean la venta.
      await this.consumablesService.decrementForSale(tx);

      await tx.receipts.create({
        data: { sale_id: sale.id, receipt_number: `R-${saleNumber}` },
      });

      await this.financeService.recordMovement(tx, {
        movementType: MOVEMENT_TYPES.SALE,
        direction: 'IN',
        amount: sale.total,
        paymentMethodId: sale.payment_method_id,
        referenceType: 'sale',
        referenceId: sale.id,
        description: `Venta #${saleNumber}`,
        createdBy,
      });

      return tx.sales.findUniqueOrThrow({
        where: { id: sale.id },
        include: SALE_INCLUDE,
      });
    });

    return toSaleView(created);
  }

  async cancel(
    id: bigint,
    dto: CancelSaleDto,
    userId: bigint,
  ): Promise<SaleView> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sales.findUnique({
        where: { id },
        include: { sale_items: true },
      });
      if (!sale) {
        throw new NotFoundException('Venta no encontrada.');
      }
      if (sale.status !== 'COMPLETED') {
        throw new BadRequestException(
          'Solo se puede cancelar una venta completada, sin devoluciones ni cambios previos.',
        );
      }

      await this.inventoryService.applyRestock(
        tx,
        'cancellation',
        id,
        sale.sale_items.map((item) => ({
          inventoryItemId: Number(item.inventory_item_id),
          quantity: item.quantity,
        })),
        userId,
      );

      await this.financeService.recordMovement(tx, {
        movementType: MOVEMENT_TYPES.SALE_CANCELLATION,
        direction: 'OUT',
        amount: sale.total,
        paymentMethodId: sale.payment_method_id,
        referenceType: 'sale',
        referenceId: sale.id,
        description: `Cancelación de venta #${sale.sale_number}`,
        createdBy: userId,
      });

      return tx.sales.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          notes: dto.notes?.trim() || sale.notes,
          updated_by: userId,
          updated_at: new Date(),
        },
        include: SALE_INCLUDE,
      });
    });

    return toSaleView(updated);
  }

  async createReturn(
    saleId: bigint,
    dto: CreateReturnDto,
    userId: bigint,
  ): Promise<SaleView> {
    const returnNumber = await this.generateReturnNumber();

    const updated = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sales.findUnique({ where: { id: saleId } });
      if (!sale) {
        throw new NotFoundException('Venta no encontrada.');
      }
      if (sale.status === 'CANCELLED' || sale.status === 'RETURNED') {
        throw new BadRequestException('Esta venta ya no admite devoluciones.');
      }

      const saleItems = await tx.sale_items.findMany({
        where: {
          id: { in: dto.items.map((item) => BigInt(item.saleItemId)) },
          sale_id: saleId,
        },
      });
      const byId = new Map(saleItems.map((item) => [item.id.toString(), item]));

      let refundAmount = new Prisma.Decimal(0);
      const restockLines: { inventoryItemId: number; quantity: number }[] = [];
      const returnItemsData: Prisma.return_itemsCreateManyInput[] = [];

      for (const line of dto.items) {
        const saleItem = byId.get(String(line.saleItemId));
        if (!saleItem) {
          throw new BadRequestException(
            'Una de las líneas indicadas no pertenece a esta venta.',
          );
        }
        const consumed = await this.getConsumedQuantity(tx, saleItem.id);
        const remaining = saleItem.quantity - consumed;
        if (line.quantity > remaining) {
          throw new BadRequestException(
            `No puedes devolver más unidades de las disponibles (disponible: ${remaining}).`,
          );
        }

        refundAmount = refundAmount.plus(
          saleItem.unit_sale_price.times(line.quantity),
        );
        restockLines.push({
          inventoryItemId: Number(saleItem.inventory_item_id),
          quantity: line.quantity,
        });
        returnItemsData.push({
          return_id: 0n, // se reemplaza abajo una vez creado el return
          sale_item_id: saleItem.id,
          quantity: line.quantity,
          condition_status: line.conditionStatus,
        });
      }

      const ret = await tx.returns.create({
        data: {
          sale_id: saleId,
          return_number: returnNumber,
          reason: dto.reason,
          refund_amount: refundAmount,
          refund_payment_method_id: dto.refundPaymentMethodId
            ? BigInt(dto.refundPaymentMethodId)
            : null,
          notes: dto.notes?.trim() || null,
          created_by: userId,
        },
      });

      await tx.return_items.createMany({
        data: returnItemsData.map((item) => ({ ...item, return_id: ret.id })),
      });

      await this.inventoryService.applyRestock(
        tx,
        'return',
        ret.id,
        restockLines,
        userId,
      );

      if (refundAmount.greaterThan(0)) {
        await this.financeService.recordMovement(tx, {
          movementType: MOVEMENT_TYPES.SALE_RETURN,
          direction: 'OUT',
          amount: refundAmount,
          paymentMethodId: dto.refundPaymentMethodId
            ? BigInt(dto.refundPaymentMethodId)
            : null,
          referenceType: 'return',
          referenceId: ret.id,
          description: `Devolución ${returnNumber} de venta #${sale.sale_number}`,
          createdBy: userId,
        });
      }

      await this.recomputeSaleStatus(tx, saleId, userId);

      return tx.sales.findUniqueOrThrow({
        where: { id: saleId },
        include: SALE_INCLUDE,
      });
    });

    return toSaleView(updated);
  }

  async createExchange(
    saleId: bigint,
    dto: CreateExchangeDto,
    userId: bigint,
  ): Promise<SaleView> {
    const exchangeNumber = await this.generateExchangeNumber();

    if (dto.paymentMethodId) {
      const paymentMethod = await this.prisma.payment_methods.findUnique({
        where: { id: BigInt(dto.paymentMethodId) },
      });
      if (!paymentMethod || !paymentMethod.applies_to_sales) {
        throw new BadRequestException(
          'La forma de pago seleccionada no es válida para ventas.',
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sales.findUnique({ where: { id: saleId } });
      if (!sale) {
        throw new NotFoundException('Venta no encontrada.');
      }
      if (sale.status === 'CANCELLED' || sale.status === 'RETURNED') {
        throw new BadRequestException('Esta venta ya no admite cambios.');
      }

      let difference = new Prisma.Decimal(0);
      const exchangeItemsData: Prisma.exchange_itemsCreateManyInput[] = [];
      const restockLines: { inventoryItemId: number; quantity: number }[] = [];
      const exitLines: { inventoryItemId: number; quantity: number }[] = [];

      for (const line of dto.items) {
        const originalItem = await tx.sale_items.findUnique({
          where: { id: BigInt(line.originalSaleItemId) },
        });
        if (!originalItem || originalItem.sale_id !== saleId) {
          throw new BadRequestException(
            'La línea original indicada no pertenece a esta venta.',
          );
        }

        const consumed = await this.getConsumedQuantity(tx, originalItem.id);
        const remaining = originalItem.quantity - consumed;
        if (line.quantity > remaining) {
          throw new BadRequestException(
            `No puedes cambiar más unidades de las disponibles en esta línea (disponible: ${remaining}).`,
          );
        }

        const newInventoryItem = await tx.inventory_items.findUnique({
          where: { id: BigInt(line.newInventoryItemId) },
          include: { products: true },
        });
        if (!newInventoryItem) {
          throw new BadRequestException(
            'La variante nueva no existe en inventario.',
          );
        }
        if (newInventoryItem.quantity < line.quantity) {
          throw new BadRequestException(
            'No hay suficiente inventario para realizar este cambio.',
          );
        }

        exchangeItemsData.push({
          exchange_id: 0n, // se reemplaza abajo una vez creado el exchange
          movement_direction: 'IN',
          original_sale_item_id: originalItem.id,
          product_id: originalItem.product_id,
          inventory_item_id: originalItem.inventory_item_id,
          size_id: originalItem.size_id,
          color_id: originalItem.color_id,
          quantity: line.quantity,
          historical_unit_price: originalItem.unit_sale_price,
          unit_cost: originalItem.unit_cost,
        });
        restockLines.push({
          inventoryItemId: Number(originalItem.inventory_item_id),
          quantity: line.quantity,
        });

        const newUnitPrice =
          newInventoryItem.products.sale_price ?? originalItem.unit_sale_price;
        exchangeItemsData.push({
          exchange_id: 0n,
          movement_direction: 'OUT',
          original_sale_item_id: null,
          product_id: newInventoryItem.product_id,
          inventory_item_id: newInventoryItem.id,
          size_id: newInventoryItem.size_id,
          color_id: newInventoryItem.color_id,
          quantity: line.quantity,
          historical_unit_price: newUnitPrice,
          unit_cost: newInventoryItem.average_cost,
        });
        exitLines.push({
          inventoryItemId: Number(newInventoryItem.id),
          quantity: line.quantity,
        });

        difference = difference
          .plus(newUnitPrice.times(line.quantity))
          .minus(originalItem.unit_sale_price.times(line.quantity));
      }

      const direction = difference.greaterThan(0)
        ? 'CUSTOMER_PAYS'
        : difference.lessThan(0)
          ? 'BUSINESS_REFUNDS'
          : 'NONE';
      if (direction === 'CUSTOMER_PAYS' && !dto.paymentMethodId) {
        throw new BadRequestException(
          'Selecciona cómo pagará el cliente la diferencia.',
        );
      }

      const exch = await tx.exchanges.create({
        data: {
          original_sale_id: saleId,
          exchange_number: exchangeNumber,
          difference_amount: difference.abs(),
          difference_direction: direction,
          payment_method_id: dto.paymentMethodId
            ? BigInt(dto.paymentMethodId)
            : null,
          notes: dto.notes?.trim() || null,
          created_by: userId,
        },
      });

      await tx.exchange_items.createMany({
        data: exchangeItemsData.map((item) => ({
          ...item,
          exchange_id: exch.id,
        })),
      });

      await this.inventoryService.applyRestock(
        tx,
        'exchange',
        exch.id,
        restockLines,
        userId,
      );
      await this.inventoryService.applyExit(
        tx,
        'exchange',
        exch.id,
        exitLines,
        userId,
      );

      if (direction !== 'NONE') {
        await this.financeService.recordMovement(tx, {
          movementType: MOVEMENT_TYPES.EXCHANGE_DIFFERENCE,
          direction: direction === 'CUSTOMER_PAYS' ? 'IN' : 'OUT',
          amount: difference.abs(),
          paymentMethodId: dto.paymentMethodId
            ? BigInt(dto.paymentMethodId)
            : null,
          referenceType: 'exchange',
          referenceId: exch.id,
          description: `Cambio ${exchangeNumber} de venta #${sale.sale_number}`,
          createdBy: userId,
        });
      }

      await this.recomputeSaleStatus(tx, saleId, userId);

      return tx.sales.findUniqueOrThrow({
        where: { id: saleId },
        include: SALE_INCLUDE,
      });
    });

    return toSaleView(updated);
  }

  async createCorrection(
    saleId: bigint,
    dto: CreateCorrectionDto,
    userId: bigint,
  ): Promise<SaleView> {
    const correctionNumber = await this.generateCorrectionNumber();

    const updated = await this.prisma.$transaction(async (tx) => {
      const sale = await tx.sales.findUnique({ where: { id: saleId } });
      if (!sale) {
        throw new NotFoundException('Venta no encontrada.');
      }
      if (sale.status !== 'COMPLETED') {
        throw new BadRequestException(
          'Solo se puede corregir una venta completada, sin devoluciones ni cambios previos.',
        );
      }

      const saleItem = await tx.sale_items.findUnique({
        where: { id: BigInt(dto.saleItemId) },
      });
      if (!saleItem || saleItem.sale_id !== saleId) {
        throw new BadRequestException(
          'La línea indicada no pertenece a esta venta.',
        );
      }

      const consumed = await this.getConsumedQuantity(tx, saleItem.id);
      if (consumed > 0) {
        throw new BadRequestException(
          'No se puede corregir una línea que ya tuvo una devolución o un cambio.',
        );
      }

      const newSizeId = dto.newSizeId
        ? BigInt(dto.newSizeId)
        : saleItem.size_id;
      const newColorId = dto.newColorId
        ? BigInt(dto.newColorId)
        : saleItem.color_id;
      const newQuantity = dto.newQuantity ?? saleItem.quantity;
      const newUnitPrice =
        dto.newUnitPrice !== undefined
          ? new Prisma.Decimal(dto.newUnitPrice)
          : saleItem.unit_sale_price;

      const variantChanged =
        newSizeId !== saleItem.size_id || newColorId !== saleItem.color_id;
      if (
        !variantChanged &&
        newQuantity === saleItem.quantity &&
        newUnitPrice.equals(saleItem.unit_sale_price)
      ) {
        throw new BadRequestException('No hay ningún cambio que corregir.');
      }

      let newInventoryItemId = saleItem.inventory_item_id;
      if (variantChanged) {
        const target = await tx.inventory_items.findUnique({
          where: {
            product_id_size_id_color_id: {
              product_id: saleItem.product_id,
              size_id: newSizeId,
              color_id: newColorId,
            },
          },
        });
        if (!target) {
          throw new BadRequestException(
            'La combinación nueva no existe en inventario.',
          );
        }
        if (target.quantity < newQuantity) {
          throw new BadRequestException(
            'No hay suficiente inventario para realizar esta corrección.',
          );
        }

        await this.inventoryService.applyRestock(
          tx,
          'correction',
          saleId,
          [
            {
              inventoryItemId: Number(saleItem.inventory_item_id),
              quantity: saleItem.quantity,
            },
          ],
          userId,
        );
        await this.inventoryService.applyExit(
          tx,
          'correction',
          saleId,
          [{ inventoryItemId: Number(target.id), quantity: newQuantity }],
          userId,
        );
        newInventoryItemId = target.id;
      } else if (newQuantity !== saleItem.quantity) {
        const delta = newQuantity - saleItem.quantity;
        if (delta < 0) {
          await this.inventoryService.applyRestock(
            tx,
            'correction',
            saleId,
            [
              {
                inventoryItemId: Number(saleItem.inventory_item_id),
                quantity: -delta,
              },
            ],
            userId,
          );
        } else {
          await this.inventoryService.applyExit(
            tx,
            'correction',
            saleId,
            [
              {
                inventoryItemId: Number(saleItem.inventory_item_id),
                quantity: delta,
              },
            ],
            userId,
          );
        }
      }

      await tx.sale_corrections.create({
        data: {
          sale_id: saleId,
          sale_item_id: saleItem.id,
          correction_number: correctionNumber,
          previous_size_id: saleItem.size_id,
          previous_color_id: saleItem.color_id,
          previous_quantity: saleItem.quantity,
          previous_unit_price: saleItem.unit_sale_price,
          new_size_id: newSizeId,
          new_color_id: newColorId,
          new_quantity: newQuantity,
          new_unit_price: newUnitPrice,
          reason: dto.reason,
          notes: dto.notes?.trim() || null,
          created_by: userId,
        },
      });

      const newSubtotal = newUnitPrice.times(newQuantity);
      await tx.sale_items.update({
        where: { id: saleItem.id },
        data: {
          size_id: newSizeId,
          color_id: newColorId,
          inventory_item_id: newInventoryItemId,
          quantity: newQuantity,
          unit_sale_price: newUnitPrice,
          subtotal: newSubtotal,
        },
      });

      const allItems = await tx.sale_items.findMany({
        where: { sale_id: saleId },
      });
      const newSaleSubtotal = allItems.reduce(
        (sum, item) => sum.plus(item.subtotal),
        new Prisma.Decimal(0),
      );
      await tx.sales.update({
        where: { id: saleId },
        data: {
          subtotal: newSaleSubtotal,
          total: newSaleSubtotal,
          updated_by: userId,
          updated_at: new Date(),
        },
      });

      const totalDelta = newSaleSubtotal.minus(sale.total);
      if (!totalDelta.equals(0)) {
        await this.financeService.recordMovement(tx, {
          movementType: MOVEMENT_TYPES.SALE_CORRECTION,
          direction: totalDelta.greaterThan(0) ? 'IN' : 'OUT',
          amount: totalDelta.abs(),
          paymentMethodId: sale.payment_method_id,
          referenceType: 'sale',
          referenceId: saleId,
          description: `Corrección ${correctionNumber} de venta #${sale.sale_number}`,
          createdBy: userId,
        });
      }

      return tx.sales.findUniqueOrThrow({
        where: { id: saleId },
        include: SALE_INCLUDE,
      });
    });

    return toSaleView(updated);
  }

  async getHistory(saleId: bigint): Promise<SaleHistoryEntry[]> {
    const sale = await this.prisma.sales.findUnique({ where: { id: saleId } });
    if (!sale) {
      throw new NotFoundException('Venta no encontrada.');
    }

    const [returns, exchanges, corrections] = await Promise.all([
      this.prisma.returns.findMany({
        where: { sale_id: saleId },
        include: {
          return_items: {
            include: {
              sale_items: {
                include: { products: true, sizes: true, colors: true },
              },
            },
          },
          users: true,
        },
        orderBy: { return_date: 'asc' },
      }),
      this.prisma.exchanges.findMany({
        where: { original_sale_id: saleId },
        include: {
          exchange_items: {
            include: { products: true, sizes: true, colors: true },
          },
          users: true,
        },
        orderBy: { exchange_date: 'asc' },
      }),
      this.prisma.sale_corrections.findMany({
        where: { sale_id: saleId },
        include: { users: true },
        orderBy: { created_at: 'asc' },
      }),
    ]);

    const entries: SaleHistoryEntry[] = [
      {
        type: 'CREATED',
        date: sale.created_at,
        description: `Venta #${sale.sale_number} creada.`,
        by: null,
      },
    ];

    for (const r of returns) {
      const lines = r.return_items
        .map(
          (ri) =>
            `${ri.sale_items.products.name} ${ri.sale_items.sizes.name}/${ri.sale_items.colors.name} (${ri.quantity})`,
        )
        .join(', ');
      const refundText = r.refund_amount.greaterThan(0)
        ? `Reembolso de Q${r.refund_amount.toString()}`
        : 'sin reembolso';
      entries.push({
        type: 'RETURN',
        date: r.return_date,
        description: `Se devolvió ${lines} — ${refundText}.`,
        by: r.users.full_name,
      });
    }

    for (const e of exchanges) {
      const inItem = e.exchange_items.find(
        (i) => i.movement_direction === 'IN',
      );
      const outItem = e.exchange_items.find(
        (i) => i.movement_direction === 'OUT',
      );
      const sameProduct = inItem?.product_id === outItem?.product_id;
      const fromText = `${inItem?.products.name} ${inItem?.sizes.name}/${inItem?.colors.name}`;
      const toText = sameProduct
        ? `${outItem?.sizes.name}/${outItem?.colors.name}`
        : `${outItem?.products.name} ${outItem?.sizes.name}/${outItem?.colors.name}`;
      const diffText =
        e.difference_direction === 'CUSTOMER_PAYS'
          ? ` Diferencia a pagar: Q${e.difference_amount.toString()}.`
          : e.difference_direction === 'BUSINESS_REFUNDS'
            ? ` Diferencia a favor del cliente: Q${e.difference_amount.toString()}.`
            : '';
      entries.push({
        type: 'EXCHANGE',
        date: e.exchange_date,
        description: `Se cambió ${fromText} por ${toText}.${diffText}`,
        by: e.users.full_name,
      });
    }

    for (const c of corrections) {
      entries.push({
        type: 'CORRECTION',
        date: c.created_at,
        description: `Corrección ${c.correction_number}: ${c.reason}.`,
        by: c.users.full_name,
      });
    }

    if (sale.status === 'CANCELLED') {
      entries.push({
        type: 'CANCELLATION',
        date: sale.updated_at,
        description: 'Venta cancelada. El inventario vendido fue reintegrado.',
        by: null,
      });
    }

    return entries.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /** Suma lo ya devuelto o cambiado de una línea, para no permitir devolver
   * o cambiar más de lo que efectivamente sigue "vendido". */
  private async getConsumedQuantity(
    tx: Prisma.TransactionClient,
    saleItemId: bigint,
  ): Promise<number> {
    const [returned, exchanged] = await Promise.all([
      tx.return_items.aggregate({
        where: { sale_item_id: saleItemId },
        _sum: { quantity: true },
      }),
      tx.exchange_items.aggregate({
        where: { original_sale_item_id: saleItemId },
        _sum: { quantity: true },
      }),
    ]);
    return (returned._sum.quantity ?? 0) + (exchanged._sum.quantity ?? 0);
  }

  /** Recalcula el estado de la venta a partir de lo realmente devuelto o
   * cambiado. Una venta CANCELADA nunca se recalcula hacia otro estado. */
  private async recomputeSaleStatus(
    tx: Prisma.TransactionClient,
    saleId: bigint,
    userId: bigint,
  ): Promise<void> {
    const sale = await tx.sales.findUniqueOrThrow({ where: { id: saleId } });
    if (sale.status === 'CANCELLED') return;

    const items = await tx.sale_items.findMany({
      where: { sale_id: saleId },
      include: { return_items: true, exchange_items: true },
    });

    let totalQuantity = 0;
    let consumedQuantity = 0;
    for (const item of items) {
      totalQuantity += item.quantity;
      consumedQuantity += item.return_items.reduce(
        (sum, r) => sum + r.quantity,
        0,
      );
      consumedQuantity += item.exchange_items.reduce(
        (sum, e) => sum + e.quantity,
        0,
      );
    }

    const status =
      consumedQuantity > 0 && consumedQuantity >= totalQuantity
        ? 'RETURNED'
        : consumedQuantity > 0
          ? 'PARTIALLY_RETURNED'
          : 'COMPLETED';

    await tx.sales.update({
      where: { id: saleId },
      data: { status, updated_by: userId, updated_at: new Date() },
    });
  }

  private async generateReturnNumber(): Promise<string> {
    const last = await this.prisma.returns.findFirst({
      orderBy: { return_number: 'desc' },
      select: { return_number: true },
    });
    const next = last ? parseInt(last.return_number, 10) + 1 : 1;
    return String(next).padStart(5, '0');
  }

  private async generateExchangeNumber(): Promise<string> {
    const last = await this.prisma.exchanges.findFirst({
      orderBy: { exchange_number: 'desc' },
      select: { exchange_number: true },
    });
    const next = last ? parseInt(last.exchange_number, 10) + 1 : 1;
    return String(next).padStart(5, '0');
  }

  private async generateCorrectionNumber(): Promise<string> {
    const last = await this.prisma.sale_corrections.findFirst({
      orderBy: { correction_number: 'desc' },
      select: { correction_number: true },
    });
    const next = last ? parseInt(last.correction_number, 10) + 1 : 1;
    return String(next).padStart(5, '0');
  }

  /**
   * Resuelve cada inventory_item vendido (valida que exista y que haya
   * stock suficiente) y calcula precio/costo/descuento por línea. El precio
   * original de referencia es el `sale_price` configurado en el producto;
   * si Andrea vendió más barato, la diferencia queda como descuento. El
   * precio configurado del producto NUNCA se modifica aquí.
   */
  private async loadAndValidateLines(
    tx: Prisma.TransactionClient,
    items: CreateSaleDto['items'],
  ): Promise<SaleLine[]> {
    const ids = [...new Set(items.map((item) => BigInt(item.inventoryItemId)))];
    const rows = await tx.inventory_items.findMany({
      where: { id: { in: ids } },
      include: { products: true, sizes: true, colors: true },
    });
    const byId = new Map(rows.map((row) => [row.id.toString(), row]));

    return items.map((item) => {
      const row = byId.get(String(item.inventoryItemId));
      if (!row) {
        throw new BadRequestException(
          'Una de las variantes seleccionadas ya no existe en inventario.',
        );
      }
      if (item.quantity > row.quantity) {
        throw new BadRequestException(
          `Stock insuficiente para ${row.products.name} (${row.sizes.name}/${row.colors.name}): disponible ${row.quantity}.`,
        );
      }

      const unitSalePrice = new Prisma.Decimal(item.unitSalePrice);
      const originalPrice = row.products.sale_price ?? unitSalePrice;
      const diff = originalPrice.minus(unitSalePrice);
      const discountAmount = diff.greaterThan(0)
        ? diff.times(item.quantity)
        : new Prisma.Decimal(0);

      return {
        inventoryItemId: row.id,
        productId: row.product_id,
        sizeId: row.size_id,
        colorId: row.color_id,
        quantity: item.quantity,
        unitSalePrice,
        unitCost: row.average_cost,
        discountAmount,
        subtotal: unitSalePrice.times(item.quantity),
      };
    });
  }
}
