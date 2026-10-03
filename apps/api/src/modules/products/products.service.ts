import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AUDIT_ACTIONS, AuditService } from '../audit/audit.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { VariantInputDto } from './dto/variant-input.dto';
import {
  calculateRecommendedPrice,
  ProductView,
  toProductView,
} from './products.mapper';

const PRODUCT_INCLUDE = {
  categories: true,
  product_variants: { include: { sizes: true, colors: true } },
} satisfies Prisma.productsInclude;

const DEFAULT_MARGIN_PERCENT = 35;
const CODE_SEQUENCE_DIGITS = 4;

export interface PaginatedProducts {
  items: ProductView[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  private async getMarginPercent(): Promise<number> {
    const setting = await this.prisma.app_settings.findUnique({
      where: { setting_key: 'target_profit_margin' },
    });
    const parsed = setting ? Number(setting.setting_value) : NaN;
    return Number.isFinite(parsed) ? parsed : DEFAULT_MARGIN_PERCENT;
  }

  /** Vista previa en vivo mientras se completa el formulario, antes de que
   * el producto exista (usa el mismo margen y la misma fórmula que la
   * respuesta final del producto). */
  async previewRecommendedPrice(
    cost: number,
  ): Promise<{ recommendedPrice: string | null }> {
    const marginPercent = await this.getMarginPercent();
    const recommended = calculateRecommendedPrice(
      new Prisma.Decimal(cost),
      marginPercent,
    );
    return { recommendedPrice: recommended ? recommended.toString() : null };
  }

  private buildCodePrefix(categoryName: string): string {
    const lettersOnly = categoryName
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '');
    return (lettersOnly || 'PRO').slice(0, 3).padEnd(3, 'X');
  }

  async generateCode(categoryId: number): Promise<string> {
    const category = await this.prisma.categories.findUnique({
      where: { id: BigInt(categoryId) },
    });
    if (!category) {
      throw new BadRequestException('La categoría seleccionada no existe.');
    }

    const prefix = this.buildCodePrefix(category.name);
    const lastProduct = await this.prisma.products.findFirst({
      where: { code: { startsWith: `${prefix}-` } },
      orderBy: { code: 'desc' },
      select: { code: true },
    });

    let nextSequence = 1;
    const match = lastProduct?.code.match(/-(\d+)$/);
    if (match) {
      nextSequence = parseInt(match[1], 10) + 1;
    }

    return `${prefix}-${String(nextSequence).padStart(CODE_SEQUENCE_DIGITS, '0')}`;
  }

  async checkDuplicates(query: string): Promise<ProductView[]> {
    const marginPercent = await this.getMarginPercent();
    const tokens = query.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    const products = await this.prisma.products.findMany({
      where: {
        OR: [
          { code: { contains: query.trim() } },
          { AND: tokens.map((token) => ({ name: { contains: token } })) },
        ],
      },
      include: PRODUCT_INCLUDE,
      orderBy: { name: 'asc' },
      take: 5,
    });

    return products.map((product) => toProductView(product, marginPercent));
  }

  async list(query: QueryProductsDto): Promise<PaginatedProducts> {
    const marginPercent = await this.getMarginPercent();
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.productsWhereInput =
      query.includeInactive === 'true' ? {} : { is_available_for_sale: true };
    if (query.categoryId) {
      where.category_id = BigInt(query.categoryId);
    }
    if (query.search?.trim()) {
      const tokens = query.search.trim().split(/\s+/).filter(Boolean);
      where.OR = [
        { code: { contains: query.search.trim() } },
        { AND: tokens.map((token) => ({ name: { contains: token } })) },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.products.findMany({
        where,
        include: PRODUCT_INCLUDE,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.products.count({ where }),
    ]);

    return {
      items: items.map((product) => toProductView(product, marginPercent)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: bigint): Promise<ProductView> {
    const product = await this.prisma.products.findUnique({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }
    const marginPercent = await this.getMarginPercent();
    return toProductView(product, marginPercent);
  }

  private async assertCodeIsAvailable(
    code: string,
    excludeProductId?: bigint,
  ): Promise<void> {
    const existing = await this.prisma.products.findUnique({ where: { code } });
    if (existing && existing.id !== excludeProductId) {
      throw new ConflictException(
        `El código "${code}" ya está en uso por otro producto.`,
      );
    }
  }

  private async assertSizesAndColorsExist(
    variants: VariantInputDto[],
  ): Promise<void> {
    if (variants.length === 0) return;

    const sizeIds = [...new Set(variants.map((v) => BigInt(v.sizeId)))];
    const colorIds = [...new Set(variants.map((v) => BigInt(v.colorId)))];

    const [sizesFound, colorsFound] = await Promise.all([
      this.prisma.sizes.count({ where: { id: { in: sizeIds } } }),
      this.prisma.colors.count({ where: { id: { in: colorIds } } }),
    ]);

    if (sizesFound !== sizeIds.length) {
      throw new BadRequestException(
        'Una o más tallas seleccionadas no existen.',
      );
    }
    if (colorsFound !== colorIds.length) {
      throw new BadRequestException(
        'Uno o más colores seleccionados no existen.',
      );
    }
  }

  private dedupeVariants(variants: VariantInputDto[]): VariantInputDto[] {
    const seen = new Map<string, VariantInputDto>();
    for (const variant of variants) {
      seen.set(`${variant.sizeId}-${variant.colorId}`, variant);
    }
    return [...seen.values()];
  }

  async create(dto: CreateProductDto): Promise<ProductView> {
    const category = await this.prisma.categories.findUnique({
      where: { id: BigInt(dto.categoryId) },
    });
    if (!category) {
      throw new BadRequestException('La categoría seleccionada no existe.');
    }

    const variants = this.dedupeVariants(dto.variants);
    await this.assertSizesAndColorsExist(variants);

    const code = dto.code?.trim() || (await this.generateCode(dto.categoryId));
    await this.assertCodeIsAvailable(code);

    const created = await this.prisma.$transaction(async (tx) => {
      const product = await tx.products.create({
        data: {
          category_id: BigInt(dto.categoryId),
          code,
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          cost: dto.cost !== undefined ? new Prisma.Decimal(dto.cost) : null,
          sale_price:
            dto.salePrice !== undefined
              ? new Prisma.Decimal(dto.salePrice)
              : null,
          waist_measurement:
            dto.waistMeasurement !== undefined
              ? new Prisma.Decimal(dto.waistMeasurement)
              : null,
          length_measurement:
            dto.lengthMeasurement !== undefined
              ? new Prisma.Decimal(dto.lengthMeasurement)
              : null,
        },
      });

      await this.syncProductRelations(tx, product.id, variants);

      return tx.products.findUniqueOrThrow({
        where: { id: product.id },
        include: PRODUCT_INCLUDE,
      });
    });

    const marginPercent = await this.getMarginPercent();
    return toProductView(created, marginPercent);
  }

  async update(id: bigint, dto: UpdateProductDto): Promise<ProductView> {
    const existing = await this.prisma.products.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Producto no encontrado.');
    }

    if (dto.categoryId !== undefined) {
      const category = await this.prisma.categories.findUnique({
        where: { id: BigInt(dto.categoryId) },
      });
      if (!category) {
        throw new BadRequestException('La categoría seleccionada no existe.');
      }
    }

    const trimmedCode = dto.code?.trim();
    if (trimmedCode) {
      await this.assertCodeIsAvailable(trimmedCode, id);
    }

    const variants = dto.variants
      ? this.dedupeVariants(dto.variants)
      : undefined;
    if (variants) {
      await this.assertSizesAndColorsExist(variants);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.products.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
          ...(dto.categoryId !== undefined
            ? { category_id: BigInt(dto.categoryId) }
            : {}),
          ...(trimmedCode ? { code: trimmedCode } : {}),
          ...(dto.description !== undefined
            ? { description: dto.description.trim() || null }
            : {}),
          ...(dto.cost !== undefined
            ? { cost: new Prisma.Decimal(dto.cost) }
            : {}),
          ...(dto.salePrice !== undefined
            ? { sale_price: new Prisma.Decimal(dto.salePrice) }
            : {}),
          ...(dto.waistMeasurement !== undefined
            ? {
                waist_measurement:
                  dto.waistMeasurement === null
                    ? null
                    : new Prisma.Decimal(dto.waistMeasurement),
              }
            : {}),
          ...(dto.lengthMeasurement !== undefined
            ? {
                length_measurement:
                  dto.lengthMeasurement === null
                    ? null
                    : new Prisma.Decimal(dto.lengthMeasurement),
              }
            : {}),
        },
      });

      if (variants) {
        await this.syncProductRelations(tx, id, variants);
      }

      return tx.products.findUniqueOrThrow({
        where: { id },
        include: PRODUCT_INCLUDE,
      });
    });

    const marginPercent = await this.getMarginPercent();
    return toProductView(updated, marginPercent);
  }

  async setActive(
    id: bigint,
    isActive: boolean,
    currentUserId: bigint,
  ): Promise<ProductView> {
    const existing = await this.prisma.products.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Producto no encontrado.');
    }

    const updated = await this.prisma.products.update({
      where: { id },
      data: { is_available_for_sale: isActive, updated_at: new Date() },
      include: PRODUCT_INCLUDE,
    });
    await this.auditService.record(this.prisma, {
      userId: currentUserId,
      action: AUDIT_ACTIONS.PRODUCT_ACTIVE_CHANGED,
      entityType: 'product',
      entityId: id,
      description: `Producto ${updated.name} ${isActive ? 'reactivado' : 'desactivado'}.`,
      oldValues: { isAvailableForSale: !isActive },
      newValues: { isAvailableForSale: isActive },
    });

    const marginPercent = await this.getMarginPercent();
    return toProductView(updated, marginPercent);
  }

  /**
   * Declara combinaciones nuevas SIN tocar las que ya existen (a diferencia
   * de `update`, que reemplaza el set completo). Pensado para Compras e
   * Inventario: cada compra es su propia factura y puede traer tallas/colores
   * que el producto nunca había manejado, sin que eso desactive combinaciones
   * de compras anteriores que simplemente no se repitieron esta vez.
   */
  async addVariants(
    id: bigint,
    variants: VariantInputDto[],
  ): Promise<ProductView> {
    const existing = await this.prisma.products.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Producto no encontrado.');
    }

    const deduped = this.dedupeVariants(variants);
    if (deduped.length > 0) {
      await this.assertSizesAndColorsExist(deduped);

      await this.prisma.$transaction(async (tx) => {
        const sizeIds = [...new Set(deduped.map((v) => BigInt(v.sizeId)))];
        const colorIds = [...new Set(deduped.map((v) => BigInt(v.colorId)))];

        for (const sizeId of sizeIds) {
          await tx.product_sizes.upsert({
            where: { product_id_size_id: { product_id: id, size_id: sizeId } },
            create: { product_id: id, size_id: sizeId },
            update: {},
          });
        }
        for (const colorId of colorIds) {
          await tx.product_colors.upsert({
            where: {
              product_id_color_id: { product_id: id, color_id: colorId },
            },
            create: { product_id: id, color_id: colorId },
            update: {},
          });
        }
        for (const variant of deduped) {
          await tx.product_variants.upsert({
            where: {
              product_id_size_id_color_id: {
                product_id: id,
                size_id: BigInt(variant.sizeId),
                color_id: BigInt(variant.colorId),
              },
            },
            create: {
              product_id: id,
              size_id: BigInt(variant.sizeId),
              color_id: BigInt(variant.colorId),
            },
            update: { is_active: true },
          });
        }
      });
    }

    const marginPercent = await this.getMarginPercent();
    const updated = await this.prisma.products.findUniqueOrThrow({
      where: { id },
      include: PRODUCT_INCLUDE,
    });
    return toProductView(updated, marginPercent);
  }

  /**
   * Sincroniza product_sizes/product_colors (listas descriptivas, sin
   * historial: se pueden recrear libremente) y product_variants.
   *
   * product_variants NUNCA se borra: desmarcar una combinación la deja con
   * is_active=false (es lo que ya filtra toProductView), en vez de eliminar
   * la fila. Esto evita perder la combinación como "declarada alguna vez"
   * cuando ya tiene historial de compras/ventas vía inventory_items, y hace
   * que volver a marcarla reactive la misma fila en vez de crear una nueva.
   */
  private async syncProductRelations(
    tx: Prisma.TransactionClient,
    productId: bigint,
    variants: VariantInputDto[],
  ): Promise<void> {
    await tx.product_sizes.deleteMany({ where: { product_id: productId } });
    await tx.product_colors.deleteMany({ where: { product_id: productId } });

    if (variants.length > 0) {
      const sizeIds = [...new Set(variants.map((v) => BigInt(v.sizeId)))];
      const colorIds = [...new Set(variants.map((v) => BigInt(v.colorId)))];
      await tx.product_sizes.createMany({
        data: sizeIds.map((sizeId) => ({
          product_id: productId,
          size_id: sizeId,
        })),
      });
      await tx.product_colors.createMany({
        data: colorIds.map((colorId) => ({
          product_id: productId,
          color_id: colorId,
        })),
      });
    }

    const existing = await tx.product_variants.findMany({
      where: { product_id: productId },
    });
    const existingByKey = new Map(
      existing.map((v) => [`${v.size_id}-${v.color_id}`, v]),
    );
    const activeKeys = new Set(variants.map((v) => `${v.sizeId}-${v.colorId}`));

    for (const variant of variants) {
      const key = `${variant.sizeId}-${variant.colorId}`;
      const current = existingByKey.get(key);
      if (!current) {
        await tx.product_variants.create({
          data: {
            product_id: productId,
            size_id: BigInt(variant.sizeId),
            color_id: BigInt(variant.colorId),
          },
        });
      } else if (!current.is_active) {
        await tx.product_variants.update({
          where: { id: current.id },
          data: { is_active: true },
        });
      }
    }

    for (const current of existing) {
      const key = `${current.size_id}-${current.color_id}`;
      if (!activeKeys.has(key) && current.is_active) {
        await tx.product_variants.update({
          where: { id: current.id },
          data: { is_active: false },
        });
      }
    }
  }
}
