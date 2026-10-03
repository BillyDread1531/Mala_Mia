import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { ConsumablesService } from '../consumables/consumables.service';
import { FinanceService } from '../finance/finance.service';
import { QueryInventoryReportDto } from './dto/query-inventory-report.dto';
import { QueryPurchasesReportDto } from './dto/query-purchases-report.dto';
import { QuerySalesReportDto } from './dto/query-sales-report.dto';
import {
  InventoryReport,
  PurchasesReport,
  PurchasesReportProductPoint,
  PurchasesReportSupplierPoint,
  SalesReport,
  SalesReportPaymentMethodPoint,
  SalesReportProductPoint,
} from './reports.mapper';

const ZERO = new Prisma.Decimal(0);

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Reportes es una capa de SOLO LECTURA sobre Ventas/Compras/Finanzas/
 * Disponibilidad: no escribe nada ni reinterpreta sus reglas. Las cifras de
 * dinero "oficiales" (ventas netas, COGS, utilidad real) siguen viniendo de
 * `FinanceService.getSummary()` tal cual Fase 10 las calcula; aquí solo se
 * agregan datos operativos (conteos, unidades, rankings) que Finanzas no
 * expone porque no los necesita para el libro contable.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
    private readonly availabilityService: AvailabilityService,
    private readonly consumablesService: ConsumablesService,
  ) {}

  async getSalesReport(dto: QuerySalesReportDto): Promise<SalesReport> {
    const range = this.financeService.resolvePeriod(dto);

    const where: Prisma.salesWhereInput = {
      sale_date: { gte: range.from, lt: range.to },
      ...(dto.paymentMethodId
        ? { payment_method_id: BigInt(dto.paymentMethodId) }
        : {}),
    };

    const [sales, returnsAgg] = await Promise.all([
      this.prisma.sales.findMany({
        where,
        include: {
          payment_methods: true,
          sale_items: { include: { products: true } },
        },
      }),
      this.prisma.returns.aggregate({
        where: { return_date: { gte: range.from, lt: range.to } },
        _sum: { refund_amount: true },
      }),
    ]);

    const active = sales.filter((s) => s.status !== 'CANCELLED');
    const cancelled = sales.filter((s) => s.status === 'CANCELLED');

    const unitsSold = active.reduce(
      (sum, s) => sum + s.sale_items.reduce((q, i) => q + i.quantity, 0),
      0,
    );
    // Igual que `FinanceService.breakdown.ventas`: el ingreso bruto de TODAS
    // las ventas del periodo, cancelada o no (la cancelación se resta aparte
    // en `cancellationsTotal`, nunca se oculta la venta original).
    const grossTotal = sales.reduce((sum, s) => sum.plus(s.total), ZERO);
    const discountsTotal = active.reduce(
      (sum, s) => sum.plus(s.discount_amount),
      ZERO,
    );
    const cancellationsTotal = cancelled.reduce(
      (sum, s) => sum.plus(s.total),
      ZERO,
    );

    const byDayMap = new Map<string, Prisma.Decimal>();
    for (const s of active) {
      const key = dayKey(s.sale_date);
      byDayMap.set(key, (byDayMap.get(key) ?? ZERO).plus(s.total));
    }
    const byDay = [...byDayMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, total]) => ({ date, total }));

    const byPaymentMethodMap = new Map<string, SalesReportPaymentMethodPoint>();
    for (const s of active) {
      const key = s.payment_method_id.toString();
      const existing = byPaymentMethodMap.get(key);
      if (existing) {
        existing.total = existing.total.plus(s.total);
        existing.count += 1;
      } else {
        byPaymentMethodMap.set(key, {
          paymentMethodId: s.payment_method_id,
          name: s.payment_methods.name,
          total: s.total,
          count: 1,
        });
      }
    }

    const topProductsMap = new Map<string, SalesReportProductPoint>();
    for (const s of active) {
      for (const item of s.sale_items) {
        const key = item.product_id.toString();
        const itemCost = item.unit_cost.times(item.quantity);
        const existing = topProductsMap.get(key);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue = existing.revenue.plus(item.subtotal);
          existing.cost = existing.cost.plus(itemCost);
          existing.profit = existing.revenue.minus(existing.cost);
        } else {
          topProductsMap.set(key, {
            productId: item.product_id,
            productName: item.products.name,
            quantity: item.quantity,
            revenue: item.subtotal,
            cost: itemCost,
            profit: item.subtotal.minus(itemCost),
          });
        }
      }
    }
    const topProductsList = [...topProductsMap.values()];
    const topProducts = [...topProductsList]
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);
    const topProductsByProfit = [...topProductsList]
      .sort((a, b) => b.profit.comparedTo(a.profit))
      .slice(0, 10);

    return {
      period: range,
      salesCount: active.length,
      unitsSold,
      grossTotal,
      discountsTotal,
      cancellationsCount: cancelled.length,
      cancellationsTotal,
      returnsTotal: returnsAgg._sum.refund_amount ?? ZERO,
      byDay,
      byPaymentMethod: [...byPaymentMethodMap.values()].sort((a, b) =>
        b.total.comparedTo(a.total),
      ),
      topProducts,
      topProductsByProfit,
    };
  }

  async getPurchasesReport(
    dto: QueryPurchasesReportDto,
  ): Promise<PurchasesReport> {
    const range = this.financeService.resolvePeriod(dto);

    const where: Prisma.purchasesWhereInput = {
      purchase_date: { gte: range.from, lt: range.to },
      ...(dto.supplierId ? { supplier_id: BigInt(dto.supplierId) } : {}),
    };

    const purchases = await this.prisma.purchases.findMany({
      where,
      include: {
        suppliers: true,
        purchase_items: { include: { products: true } },
      },
    });

    const unitsPurchased = purchases.reduce(
      (sum, p) => sum + p.purchase_items.reduce((q, i) => q + i.quantity, 0),
      0,
    );
    const totalAmount = purchases.reduce(
      (sum, p) => sum.plus(p.total_cost),
      ZERO,
    );

    const bySupplierMap = new Map<string, PurchasesReportSupplierPoint>();
    for (const p of purchases) {
      const key = p.supplier_id.toString();
      const existing = bySupplierMap.get(key);
      if (existing) {
        existing.total = existing.total.plus(p.total_cost);
        existing.count += 1;
      } else {
        bySupplierMap.set(key, {
          supplierId: p.supplier_id,
          name: p.suppliers.name,
          total: p.total_cost,
          count: 1,
        });
      }
    }

    const productsMap = new Map<string, PurchasesReportProductPoint>();
    for (const p of purchases) {
      for (const item of p.purchase_items) {
        const key = item.product_id.toString();
        const existing = productsMap.get(key);
        if (existing) {
          existing.quantity += item.quantity;
          existing.totalCost = existing.totalCost.plus(item.total_cost);
        } else {
          productsMap.set(key, {
            productId: item.product_id,
            productName: item.products.name,
            quantity: item.quantity,
            totalCost: item.total_cost,
          });
        }
      }
    }

    return {
      period: range,
      purchasesCount: purchases.length,
      unitsPurchased,
      totalAmount,
      bySupplier: [...bySupplierMap.values()].sort((a, b) =>
        b.total.comparedTo(a.total),
      ),
      products: [...productsMap.values()].sort(
        (a, b) => b.quantity - a.quantity,
      ),
    };
  }

  /**
   * Fotografía del inventario actual: deliberadamente NO depende de periodo
   * (sección 8 de la orden). Reutiliza `AvailabilityService` para la regla
   * de disponible/stock bajo/agotado (Fase 9) en vez de duplicarla.
   */
  async getInventoryReport(
    dto: QueryInventoryReportDto,
  ): Promise<InventoryReport> {
    const availability = await this.availabilityService.getAvailability({
      categoryId: dto.categoryId,
      pageSize: 10000,
    });

    const invWhere: Prisma.inventory_itemsWhereInput = dto.categoryId
      ? { products: { category_id: BigInt(dto.categoryId) } }
      : {};
    const invRows = await this.prisma.inventory_items.findMany({
      where: invWhere,
      select: { quantity: true, average_cost: true },
    });
    const totalUnits = invRows.reduce((sum, r) => sum + r.quantity, 0);
    const approxValue = invRows.reduce(
      (sum, r) => sum.plus(r.average_cost.times(r.quantity)),
      ZERO,
    );

    const lowStockItems = availability.items
      .filter((i) => i.status !== 'DISPONIBLE')
      .sort((a, b) => a.quantity - b.quantity)
      .map((i) => ({
        productId: i.productId,
        productName: i.productName,
        sizeName: i.sizeName,
        colorName: i.colorName,
        quantity: i.quantity,
        status: i.status as 'STOCK_BAJO' | 'AGOTADO',
      }));

    const consumables = await this.consumablesService.list();
    const lowStockConsumables = consumables
      .filter((c) => c.isActive && c.status !== 'DISPONIBLE')
      .sort((a, b) => a.quantity - b.quantity)
      .map((c) => ({
        id: c.id,
        name: c.name,
        quantity: c.quantity,
        status: c.status as 'STOCK_BAJO' | 'AGOTADO',
      }));

    return {
      totalUnits,
      productsCount: availability.summary.products,
      availableCount: availability.summary.available,
      lowStockCount: availability.summary.lowStock,
      outOfStockCount: availability.summary.outOfStock,
      approxValue,
      lowStockItems,
      lowStockConsumables,
    };
  }
}
