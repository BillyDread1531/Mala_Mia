import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_reports_user';
const TEST_PASSWORD = 'e2e-test-password-Dd4!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
const TEST_NAME_PREFIX = 'E2E13R ';

interface SaleBody {
  id: string;
  items: { id: string }[];
}

interface SalesReportBody {
  salesCount: number;
  unitsSold: number;
  grossTotal: string;
  discountsTotal: string;
  cancellationsCount: number;
  cancellationsTotal: string;
  byPaymentMethod: { paymentMethodId: string; total: string }[];
  topProducts: {
    productId: string;
    productName: string;
    quantity: number;
    revenue: string;
    cost: string;
    profit: string;
  }[];
  topProductsByProfit: {
    productId: string;
    productName: string;
    quantity: number;
    revenue: string;
    cost: string;
    profit: string;
  }[];
}

interface PurchasesReportBody {
  purchasesCount: number;
  unitsPurchased: number;
  totalAmount: string;
  bySupplier: { supplierId: string; total: string }[];
  products: { productId: string; quantity: number; totalCost: string }[];
}

interface InventoryReportBody {
  totalUnits: number;
  productsCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  approxValue: string;
  lowStockItems: {
    productId: string;
    productName: string;
    quantity: number;
    status: string;
  }[];
  lowStockConsumables: {
    id: string;
    name: string;
    quantity: number;
    status: string;
  }[];
}

interface FinanceSummaryBody {
  breakdown: { ventas: string; compras: string };
}

describe('Reports (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: bigint;
  let supplierId: bigint;
  let productId: bigint;
  let lowStockProductId: bigint;
  let sizeM: bigint;
  let colorBeige: bigint;
  let efectivoId: bigint;
  let transferenciaId: bigint;
  let categoryId: bigint;
  let lowStockThreshold: number;
  let windowFrom: string;

  function authed(req: request.Test): request.Test {
    return req.set('Cookie', [sessionCookie]);
  }

  function windowTo(): string {
    return new Date(Date.now() + 5000).toISOString();
  }

  async function getSalesReport(
    extra: Record<string, string | number> = {},
  ): Promise<SalesReportBody> {
    const res = await authed(
      request(app.getHttpServer())
        .get('/reports/sales')
        .query({
          period: 'custom',
          from: windowFrom,
          to: windowTo(),
          ...extra,
        }),
    ).expect(200);
    return res.body as SalesReportBody;
  }

  async function getPurchasesReport(
    extra: Record<string, string | number> = {},
  ): Promise<PurchasesReportBody> {
    const res = await authed(
      request(app.getHttpServer())
        .get('/reports/purchases')
        .query({
          period: 'custom',
          from: windowFrom,
          to: windowTo(),
          ...extra,
        }),
    ).expect(200);
    return res.body as PurchasesReportBody;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new BigIntInterceptor());
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    const role = await prisma.roles.findUniqueOrThrow({
      where: { name: 'SELLER' },
    });
    const passwordHash = await argon2.hash(TEST_PASSWORD, {
      type: argon2.argon2id,
    });
    const user = await prisma.users.create({
      data: {
        username: TEST_USERNAME,
        full_name: 'E2E Reports Tester',
        role_id: role.id,
        password_hash: passwordHash,
        is_active: true,
      },
    });
    userId = user.id;

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
      .expect(200);
    const rawCookies = loginRes.get('set-cookie') as unknown as
      string[] | undefined;
    const cookie = rawCookies?.find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    );
    if (!cookie)
      throw new Error('No se recibió la cookie de sesión en el test');
    sessionCookie = cookie.split(';')[0];

    const category = await prisma.categories.findUniqueOrThrow({
      where: { name: 'Blusas' },
    });
    categoryId = category.id;
    sizeM = (
      await prisma.sizes.findUniqueOrThrow({ where: { normalized_name: 'M' } })
    ).id;
    colorBeige = (
      await prisma.colors.findUniqueOrThrow({
        where: { normalized_name: 'BEIGE' },
      })
    ).id;
    efectivoId = (
      await prisma.payment_methods.findUniqueOrThrow({
        where: { name: 'Efectivo' },
      })
    ).id;
    transferenciaId = (
      await prisma.payment_methods.findUniqueOrThrow({
        where: { name: 'Transferencia' },
      })
    ).id;

    const thresholdSetting = await prisma.app_settings.findUnique({
      where: { setting_key: 'low_stock_threshold' },
    });
    lowStockThreshold = thresholdSetting
      ? Number(thresholdSetting.setting_value)
      : 3;

    const supplier = await prisma.suppliers.create({
      data: { name: `${TEST_NAME_PREFIX}Proveedor` },
    });
    supplierId = supplier.id;

    const product = await prisma.products.create({
      data: {
        category_id: categoryId,
        code: 'E2E13R-0001',
        name: `${TEST_NAME_PREFIX}Blusa`,
        sale_price: 100,
      },
    });
    productId = product.id;
    await prisma.product_variants.create({
      data: { product_id: productId, size_id: sizeM, color_id: colorBeige },
    });

    const lowStockProduct = await prisma.products.create({
      data: {
        category_id: categoryId,
        code: 'E2E13R-0002',
        name: `${TEST_NAME_PREFIX}Blusa poco stock`,
        sale_price: 50,
      },
    });
    lowStockProductId = lowStockProduct.id;
    await prisma.product_variants.create({
      data: {
        product_id: lowStockProductId,
        size_id: sizeM,
        color_id: colorBeige,
      },
    });

    windowFrom = new Date(Date.now() - 5000).toISOString();
  });

  afterAll(async () => {
    const products = await prisma.products.findMany({
      where: { name: { startsWith: TEST_NAME_PREFIX } },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);
    const inventoryItems = await prisma.inventory_items.findMany({
      where: { product_id: { in: productIds } },
      select: { id: true },
    });
    const inventoryIds = inventoryItems.map((i) => i.id);
    const saleItems = await prisma.sale_items.findMany({
      where: { inventory_item_id: { in: inventoryIds } },
      select: { id: true, sale_id: true },
    });
    const saleIds = [...new Set(saleItems.map((s) => s.sale_id))];
    const purchases = await prisma.purchases.findMany({
      where: { supplier_id: supplierId ?? 0n },
      select: { id: true },
    });
    const purchaseIds = purchases.map((p) => p.id);

    await prisma.return_items.deleteMany({
      where: { sale_item_id: { in: saleItems.map((s) => s.id) } },
    });
    await prisma.returns.deleteMany({ where: { sale_id: { in: saleIds } } });
    await prisma.inventory_movements.deleteMany({
      where: { inventory_item_id: { in: inventoryIds } },
    });
    await prisma.receipts.deleteMany({ where: { sale_id: { in: saleIds } } });
    await prisma.sale_items.deleteMany({ where: { sale_id: { in: saleIds } } });
    await prisma.financial_movements.deleteMany({
      where: { created_by: userId ?? 0n },
    });
    await prisma.sales.deleteMany({ where: { id: { in: saleIds } } });
    await prisma.inventory_items.deleteMany({
      where: { id: { in: inventoryIds } },
    });
    await prisma.purchase_items.deleteMany({
      where: { purchase_id: { in: purchaseIds } },
    });
    await prisma.purchases.deleteMany({ where: { id: { in: purchaseIds } } });
    await prisma.product_variants.deleteMany({
      where: { product_id: { in: productIds } },
    });
    await prisma.products.deleteMany({ where: { id: { in: productIds } } });
    await prisma.suppliers.deleteMany({ where: { id: supplierId ?? 0n } });
    await prisma.audit_logs.deleteMany({ where: { user_id: userId ?? 0n } });
    await prisma.users.deleteMany({ where: { id: userId ?? 0n } });
    await app.close();
  });

  it('sin sesión responde 401 en los tres reportes', async () => {
    await request(app.getHttpServer()).get('/reports/sales').expect(401);
    await request(app.getHttpServer()).get('/reports/purchases').expect(401);
    await request(app.getHttpServer()).get('/reports/inventory').expect(401);
  });

  it('periodo personalizado sin from/to responde 400', async () => {
    await authed(
      request(app.getHttpServer())
        .get('/reports/sales')
        .query({ period: 'custom' }),
    ).expect(400);
  });

  it.each(['week', 'month', 'year'])(
    'acepta el periodo %s sin fechas',
    async (period) => {
      await authed(
        request(app.getHttpServer()).get('/reports/sales').query({ period }),
      ).expect(200);
    },
  );

  it('sin datos en el periodo responde reporte vacío, sin errores', async () => {
    const past = '2020-01-01T00:00:00.000Z';
    const res = await authed(
      request(app.getHttpServer()).get('/reports/sales').query({
        period: 'custom',
        from: past,
        to: '2020-01-02T00:00:00.000Z',
      }),
    ).expect(200);
    const body = res.body as SalesReportBody;
    expect(body.salesCount).toBe(0);
    expect(body.unitsSold).toBe(0);
    expect(body.topProducts).toEqual([]);
    expect(body.byPaymentMethod).toEqual([]);
  });

  it('una compra aparece en el reporte de compras con proveedor y unidades', async () => {
    await authed(
      request(app.getHttpServer())
        .post('/purchases')
        .send({
          supplierId: Number(supplierId),
          paymentMethodId: Number(efectivoId),
          items: [
            {
              productId: Number(productId),
              sizeId: Number(sizeM),
              colorId: Number(colorBeige),
              quantity: 10,
              unitCost: 50,
            },
          ],
        }),
    ).expect(201);

    const report = await getPurchasesReport();
    expect(report.purchasesCount).toBe(1);
    expect(report.unitsPurchased).toBe(10);
    expect(report.totalAmount).toBe('500');
    expect(report.bySupplier).toHaveLength(1);
    expect(report.bySupplier[0].supplierId).toBe(supplierId.toString());
    expect(report.bySupplier[0].total).toBe('500');
    expect(report.products[0].quantity).toBe(10);

    // Filtro por proveedor que no compró nada en el periodo: reporte vacío.
    const otherSupplier = await prisma.suppliers.create({
      data: { name: `${TEST_NAME_PREFIX}Otro` },
    });
    const filtered = await getPurchasesReport({
      supplierId: Number(otherSupplier.id),
    });
    expect(filtered.purchasesCount).toBe(0);
    await prisma.suppliers.deleteMany({ where: { id: otherSupplier.id } });
  });

  it('una venta normal y una con regateo aparecen en ventas, con descuento y producto más vendido', async () => {
    const items = await prisma.inventory_items.findMany({
      where: { product_id: productId },
    });
    const item = items[0];

    const normalSale = await authed(
      request(app.getHttpServer())
        .post('/sales')
        .send({
          paymentMethodId: Number(efectivoId),
          items: [
            {
              inventoryItemId: Number(item.id),
              quantity: 1,
              unitSalePrice: 100,
            },
          ],
        }),
    ).expect(201);

    const regateoSale = await authed(
      request(app.getHttpServer())
        .post('/sales')
        .send({
          paymentMethodId: Number(transferenciaId),
          items: [
            {
              inventoryItemId: Number(item.id),
              quantity: 1,
              unitSalePrice: 80,
            },
          ],
        }),
    ).expect(201);

    const report = await getSalesReport();
    expect(report.salesCount).toBeGreaterThanOrEqual(2);
    expect(report.unitsSold).toBeGreaterThanOrEqual(2);
    expect(Number(report.discountsTotal)).toBeGreaterThanOrEqual(20);
    const topProduct = report.topProducts.find(
      (p) => p.productId === productId.toString(),
    );
    expect(topProduct).toBeDefined();
    expect(topProduct!.quantity).toBeGreaterThanOrEqual(2);
    expect(Number(topProduct!.profit)).toBe(
      Number(topProduct!.revenue) - Number(topProduct!.cost),
    );

    const profitProduct = report.topProductsByProfit.find(
      (p) => p.productId === productId.toString(),
    );
    expect(profitProduct).toBeDefined();

    // Filtro por método de pago: Transferencia solo debe ver la venta con regateo.
    const byTransfer = await getSalesReport({
      paymentMethodId: Number(transferenciaId),
    });
    expect(byTransfer.salesCount).toBe(1);
    expect(byTransfer.grossTotal).toBe('80');

    const byPaymentMethod = report.byPaymentMethod;
    expect(
      byPaymentMethod.some((p) => p.paymentMethodId === efectivoId.toString()),
    ).toBe(true);
    expect(
      byPaymentMethod.some(
        (p) => p.paymentMethodId === transferenciaId.toString(),
      ),
    ).toBe(true);

    void normalSale;
    void regateoSale;
  });

  it('una venta cancelada se cuenta aparte y no suma a las unidades activas', async () => {
    const items = await prisma.inventory_items.findMany({
      where: { product_id: productId },
    });
    const item = items[0];

    const before = await getSalesReport();

    const sale = await authed(
      request(app.getHttpServer())
        .post('/sales')
        .send({
          paymentMethodId: Number(efectivoId),
          items: [
            {
              inventoryItemId: Number(item.id),
              quantity: 1,
              unitSalePrice: 100,
            },
          ],
        }),
    ).expect(201);
    const saleId = (sale.body as SaleBody).id;

    await authed(
      request(app.getHttpServer()).post(`/sales/${saleId}/cancel`).send({}),
    ).expect(201);

    const after = await getSalesReport();
    expect(after.salesCount).toBe(before.salesCount); // la cancelada no cuenta como activa
    expect(after.unitsSold).toBe(before.unitsSold);
    expect(after.cancellationsCount).toBe(before.cancellationsCount + 1);
    expect(Number(after.cancellationsTotal)).toBe(
      Number(before.cancellationsTotal) + 100,
    );
  });

  it('las cifras de dinero del reporte de ventas/compras coinciden con Finanzas', async () => {
    const [salesReport, purchasesReport, financeSummary] = await Promise.all([
      getSalesReport(),
      getPurchasesReport(),
      authed(
        request(app.getHttpServer())
          .get('/finance/summary')
          .query({ period: 'custom', from: windowFrom, to: windowTo() }),
      ).expect(200),
    ]);
    const finance = financeSummary.body as FinanceSummaryBody;

    expect(salesReport.grossTotal).toBe(finance.breakdown.ventas);
    expect(purchasesReport.totalAmount).toBe(finance.breakdown.compras);
  });

  it('el reporte de inventario refleja el stock bajo usando el umbral configurado', async () => {
    await authed(
      request(app.getHttpServer())
        .post('/purchases')
        .send({
          supplierId: Number(supplierId),
          paymentMethodId: Number(efectivoId),
          items: [
            {
              productId: Number(lowStockProductId),
              sizeId: Number(sizeM),
              colorId: Number(colorBeige),
              quantity: lowStockThreshold,
              unitCost: 20,
            },
          ],
        }),
    ).expect(201);

    const res = await authed(
      request(app.getHttpServer()).get('/reports/inventory'),
    ).expect(200);
    const report = res.body as InventoryReportBody;

    expect(report.totalUnits).toBeGreaterThanOrEqual(lowStockThreshold);
    expect(Number(report.approxValue)).toBeGreaterThan(0);
    const lowStockEntry = report.lowStockItems.find(
      (i) => i.productId === lowStockProductId.toString(),
    );
    expect(lowStockEntry).toBeDefined();
    expect(lowStockEntry!.quantity).toBe(lowStockThreshold);
    expect(['STOCK_BAJO', 'AGOTADO']).toContain(lowStockEntry!.status);

    // Filtro por categoría: una categoría sin relación no debe incluirlo.
    const otherCategory = await prisma.categories.findFirst({
      where: { id: { not: categoryId } },
    });
    if (otherCategory) {
      const filteredRes = await authed(
        request(app.getHttpServer())
          .get('/reports/inventory')
          .query({ categoryId: Number(otherCategory.id) }),
      ).expect(200);
      const filtered = filteredRes.body as InventoryReportBody;
      expect(
        filtered.lowStockItems.some(
          (i) => i.productId === lowStockProductId.toString(),
        ),
      ).toBe(false);
    }
  });
});
