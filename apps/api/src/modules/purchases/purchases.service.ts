import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { QueryPurchasesDto } from './dto/query-purchases.dto';
import { PurchaseView, toPurchaseView } from './purchases.mapper';

const PURCHASE_INCLUDE = {
  suppliers: true,
  payment_methods: true,
  purchase_items: { include: { products: true, sizes: true, colors: true } },
} satisfies Prisma.purchasesInclude;

const PURCHASE_NUMBER_DIGITS = 5;

export interface PaginatedPurchases {
  items: PurchaseView[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class PurchasesService {
  constructor(private readonly prisma: PrismaService) {}

  private async generatePurchaseNumber(): Promise<string> {
    const last = await this.prisma.purchases.findFirst({
      orderBy: { purchase_number: 'desc' },
      select: { purchase_number: true },
    });
    const nextSequence = last ? parseInt(last.purchase_number, 10) + 1 : 1;
    return String(nextSequence).padStart(PURCHASE_NUMBER_DIGITS, '0');
  }

  async list(query: QueryPurchasesDto): Promise<PaginatedPurchases> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.purchasesWhereInput = query.search?.trim()
      ? {
          OR: [
            { purchase_number: { contains: query.search.trim() } },
            { suppliers: { name: { contains: query.search.trim() } } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchases.findMany({
        where,
        include: PURCHASE_INCLUDE,
        orderBy: { purchase_date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.purchases.count({ where }),
    ]);

    return { items: items.map(toPurchaseView), total, page, pageSize };
  }

  async findOne(id: bigint): Promise<PurchaseView> {
    const purchase = await this.prisma.purchases.findUnique({
      where: { id },
      include: PURCHASE_INCLUDE,
    });
    if (!purchase) {
      throw new NotFoundException('Compra no encontrada.');
    }
    return toPurchaseView(purchase);
  }

  async create(
    dto: CreatePurchaseDto,
    createdBy: bigint,
  ): Promise<PurchaseView> {
    const supplier = await this.prisma.suppliers.findUnique({
      where: { id: BigInt(dto.supplierId) },
    });
    if (!supplier) {
      throw new BadRequestException('El proveedor seleccionado no existe.');
    }

    const paymentMethod = await this.prisma.payment_methods.findUnique({
      where: { id: BigInt(dto.paymentMethodId) },
    });
    if (!paymentMethod || !paymentMethod.applies_to_purchases) {
      throw new BadRequestException(
        'La forma de pago seleccionada no es válida para compras.',
      );
    }

    await this.assertItemsAreValid(dto.items);

    const lineInputs = dto.items.map((item) => ({
      item,
      subtotal: new Prisma.Decimal(item.unitCost).times(item.quantity),
    }));
    const goodsTotal = lineInputs.reduce(
      (sum, { subtotal }) => sum.plus(subtotal),
      new Prisma.Decimal(0),
    );

    const purchaseNumber = await this.generatePurchaseNumber();

    const created = await this.prisma.$transaction(async (tx) => {
      const purchase = await tx.purchases.create({
        data: {
          supplier_id: BigInt(dto.supplierId),
          purchase_number: purchaseNumber,
          payment_method_id: BigInt(dto.paymentMethodId),
          goods_total: goodsTotal,
          additional_cost: new Prisma.Decimal(0),
          total_cost: goodsTotal,
          cost_mode: 'INDIVIDUAL',
          notes: dto.notes?.trim() || null,
          created_by: createdBy,
        },
      });

      await tx.purchase_items.createMany({
        data: lineInputs.map(({ item, subtotal }) => ({
          purchase_id: purchase.id,
          product_id: BigInt(item.productId),
          size_id: BigInt(item.sizeId),
          color_id: BigInt(item.colorId),
          quantity: item.quantity,
          unit_cost: new Prisma.Decimal(item.unitCost),
          total_cost: subtotal,
          cost_is_estimated: false,
        })),
      });

      return tx.purchases.findUniqueOrThrow({
        where: { id: purchase.id },
        include: PURCHASE_INCLUDE,
      });
    });

    return toPurchaseView(created);
  }

  private async assertItemsAreValid(
    items: CreatePurchaseDto['items'],
  ): Promise<void> {
    const productIds = [
      ...new Set(items.map((item) => BigInt(item.productId))),
    ];

    const products = await this.prisma.products.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'Uno o más productos de la compra no existen.',
      );
    }

    const variants = await this.prisma.product_variants.findMany({
      where: {
        is_active: true,
        OR: items.map((item) => ({
          product_id: BigInt(item.productId),
          size_id: BigInt(item.sizeId),
          color_id: BigInt(item.colorId),
        })),
      },
      select: { product_id: true, size_id: true, color_id: true },
    });
    const validKeys = new Set(
      variants.map((v) => `${v.product_id}-${v.size_id}-${v.color_id}`),
    );

    for (const item of items) {
      const key = `${item.productId}-${item.sizeId}-${item.colorId}`;
      if (!validKeys.has(key)) {
        throw new BadRequestException(
          'Una de las combinaciones talla/color no pertenece al producto seleccionado.',
        );
      }
    }
  }
}
