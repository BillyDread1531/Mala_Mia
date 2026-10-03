import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { computeStatus } from '../inventory/inventory.mapper';
import { InventoryService } from '../inventory/inventory.service';
import { QueryAvailabilityDto } from './dto/query-availability.dto';
import {
  AvailabilityItemView,
  AvailabilityProductDetail,
  AvailabilityResponse,
  AvailabilitySummary,
} from './availability.mapper';

/**
 * Disponibilidad es una vista de SOLO CONSULTA: combina los combos
 * declarados en `product_variants` (la fuente de verdad de "qué talla/color
 * maneja este producto") con el stock real en `inventory_items`. Un combo
 * declarado pero nunca comprado no tiene fila en inventory_items — por eso
 * NO se puede reutilizar `GET /inventory` tal cual (ese endpoint solo lista
 * lo que ya existe como inventory_items): aquí se necesita mostrarlo con
 * stock 0 ("agotado"), que es justo el caso que Andrea más necesita ver.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Decisión de rendimiento: se trae una sola vez todo el universo de
   * combinaciones activas que cumplen los filtros "de catálogo" (categoría,
   * talla, color) con su stock, y búsqueda/estado/paginación se resuelven en
   * memoria. Para el tamaño de catálogo de esta tienda (decenas de
   * productos) es más simple y suficientemente rápido que construir un SQL
   * con LEFT JOIN manual contra una tabla sin relación directa en Prisma; si
   * el catálogo creciera mucho, esto se puede mover a SQL más adelante.
   */
  async getAvailability(
    query: QueryAvailabilityDto,
  ): Promise<AvailabilityResponse> {
    const threshold = await this.inventoryService.getLowStockThreshold();

    const where: Prisma.product_variantsWhereInput = {
      is_active: true,
      products: {
        is_available_for_sale: true,
        ...(query.categoryId ? { category_id: BigInt(query.categoryId) } : {}),
      },
    };
    if (query.sizeId) where.size_id = BigInt(query.sizeId);
    if (query.colorId) where.color_id = BigInt(query.colorId);

    const variants = await this.prisma.product_variants.findMany({
      where,
      include: {
        products: { include: { categories: true } },
        sizes: true,
        colors: true,
      },
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
    const quantityByKey = new Map(
      inventoryRows.map((i) => [
        `${i.product_id}-${i.size_id}-${i.color_id}`,
        i.quantity,
      ]),
    );

    let items: AvailabilityItemView[] = variants.map((v) => {
      const quantity =
        quantityByKey.get(`${v.product_id}-${v.size_id}-${v.color_id}`) ?? 0;
      return {
        productId: v.product_id,
        productName: v.products.name,
        productCode: v.products.code,
        categoryId: v.products.category_id,
        categoryName: v.products.categories.name,
        sizeId: v.size_id,
        sizeName: v.sizes.name,
        colorId: v.color_id,
        colorName: v.colors.name,
        quantity,
        salePrice: v.products.sale_price,
        waistMeasurement: v.products.waist_measurement,
        lengthMeasurement: v.products.length_measurement,
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
          item.categoryName,
          item.sizeName,
          item.colorName,
        ]
          .join(' ')
          .toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      });
    }

    // Los contadores reflejan búsqueda/categoría/talla/color (todo lo que ya
    // se aplicó arriba) pero NO el filtro de estado: así Andrea sigue viendo
    // el desglose completo (disponibles/pocas/agotadas) aunque esté mirando
    // solo un estado a la vez en la lista de abajo.
    const summary: AvailabilitySummary = {
      products: new Set(items.map((i) => i.productId.toString())).size,
      available: items.filter((i) => i.status === 'DISPONIBLE').length,
      lowStock: items.filter((i) => i.status === 'STOCK_BAJO').length,
      outOfStock: items.filter((i) => i.status === 'AGOTADO').length,
    };

    const filtered = query.status
      ? items.filter((i) => i.status === query.status)
      : items;

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 200;
    const total = filtered.length;
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

    return { items: paged, total, page, pageSize, summary };
  }

  async getProductDetail(
    productId: bigint,
  ): Promise<AvailabilityProductDetail> {
    const product = await this.prisma.products.findUnique({
      where: { id: productId },
      include: { categories: true },
    });
    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }

    const threshold = await this.inventoryService.getLowStockThreshold();
    const [variants, inventoryRows] = await Promise.all([
      this.prisma.product_variants.findMany({
        where: { product_id: productId, is_active: true },
        include: { sizes: true, colors: true },
        orderBy: [{ size_id: 'asc' }, { color_id: 'asc' }],
      }),
      this.prisma.inventory_items.findMany({
        where: { product_id: productId },
      }),
    ]);
    const quantityByKey = new Map(
      inventoryRows.map((i) => [`${i.size_id}-${i.color_id}`, i.quantity]),
    );

    return {
      id: product.id,
      name: product.name,
      code: product.code,
      category: { id: product.categories.id, name: product.categories.name },
      description: product.description,
      salePrice: product.sale_price,
      waistMeasurement: product.waist_measurement,
      lengthMeasurement: product.length_measurement,
      variants: variants.map((v) => {
        const quantity = quantityByKey.get(`${v.size_id}-${v.color_id}`) ?? 0;
        return {
          sizeId: v.size_id,
          sizeName: v.sizes.name,
          colorId: v.color_id,
          colorName: v.colors.name,
          quantity,
          status: computeStatus(quantity, threshold),
        };
      }),
    };
  }
}
