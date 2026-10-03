import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_finance_user';
const TEST_PASSWORD = 'e2e-test-password-Dd4!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
const TEST_NAME_PREFIX = 'E2E10F ';

interface SummaryBody {
  ingresos: string;
  salidas: string;
  disponible: string;
  breakdown: {
    ventas: string;
    devoluciones: string;
    cancelaciones: string;
    compras: string;
    gastos: string;
    ingresoManual: string;
  };
  distribution: {
    hasProfit: boolean;
    realProfit: string;
    personalAmount: string;
    reinvestmentAmount: string;
    reserveAmount: string;
  };
}

interface SaleBody {
  id: string;
  total: string;
  items: { id: string }[];
}

interface ErrorResponseBody {
  message: string;
}

describe('Finance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: bigint;
  let supplierId: bigint;
  let productId: bigint;
  let sizeM: bigint;
  let colorBeige: bigint;
  let efectivoId: bigint;
  let expenseCategoryId: bigint;
  let originalSettings: {
    personal: number;
    reinvestment: number;
    reserve: number;
  };
  /** Ventana ancha y estable: evita falsos positivos por la precisión de
   * segundo de `movement_date` (DATETIME(0)) cuando los tests corren más
   * rápido que 1 segundo entre sí. Cada test compara un ANTES/DESPUÉS
   * (delta) dentro de esta misma ventana, en vez de intentar acotar un
   * rango exacto por reloj — así el resultado no depende de cuán rápido
   * corre la suite. */
  let windowFrom: string;

  function authed(req: request.Test): request.Test {
    return req.set('Cookie', [sessionCookie]);
  }

  function windowTo(): string {
    return new Date(Date.now() + 5000).toISOString();
  }

  async function getSummary(): Promise<SummaryBody> {
    const res = await authed(
      request(app.getHttpServer())
        .get('/finance/summary')
        .query({ period: 'custom', from: windowFrom, to: windowTo() }),
    ).expect(200);
    return res.body as SummaryBody;
  }

  /** Ejecuta `action` y devuelve el delta de cada campo numérico del
   * resumen (después - antes), dentro de la ventana ancha y estable. */
  async function summaryDelta(action: () => Promise<void>): Promise<{
    ingresos: number;
    salidas: number;
    ventas: number;
    devoluciones: number;
    cancelaciones: number;
    compras: number;
    gastos: number;
    realProfit: number;
  }> {
    const before = await getSummary();
    await action();
    const after = await getSummary();
    return {
      ingresos: Number(after.ingresos) - Number(before.ingresos),
      salidas: Number(after.salidas) - Number(before.salidas),
      ventas: Number(after.breakdown.ventas) - Number(before.breakdown.ventas),
      devoluciones:
        Number(after.breakdown.devoluciones) -
        Number(before.breakdown.devoluciones),
      cancelaciones:
        Number(after.breakdown.cancelaciones) -
        Number(before.breakdown.cancelaciones),
      compras:
        Number(after.breakdown.compras) - Number(before.breakdown.compras),
      gastos: Number(after.breakdown.gastos) - Number(before.breakdown.gastos),
      realProfit:
        Number(after.distribution.realProfit) -
        Number(before.distribution.realProfit),
    };
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
        full_name: 'E2E Finance Tester',
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
    expenseCategoryId = (
      await prisma.expense_categories.findFirstOrThrow({
        where: { is_active: true },
      })
    ).id;

    const supplier = await prisma.suppliers.create({
      data: { name: `${TEST_NAME_PREFIX}Boutique` },
    });
    supplierId = supplier.id;

    const product = await prisma.products.create({
      data: {
        category_id: category.id,
        code: 'E2E10F-0001',
        name: `${TEST_NAME_PREFIX}Blusa`,
        sale_price: 100,
      },
    });
    productId = product.id;
    await prisma.product_variants.create({
      data: { product_id: productId, size_id: sizeM, color_id: colorBeige },
    });

    const settings =
      await prisma.profit_distribution_settings.findFirstOrThrow();
    originalSettings = {
      personal: Number(settings.personal_percentage),
      reinvestment: Number(settings.reinvestment_percentage),
      reserve: Number(settings.reserve_percentage),
    };

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
    const expenses = await prisma.expenses.findMany({
      where: { description: { startsWith: TEST_NAME_PREFIX } },
      select: { id: true },
    });
    const expenseIds = expenses.map((e) => e.id);

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
    await prisma.expenses.deleteMany({ where: { id: { in: expenseIds } } });
    await prisma.product_variants.deleteMany({
      where: { product_id: { in: productIds } },
    });
    await prisma.products.deleteMany({ where: { id: { in: productIds } } });
    await prisma.suppliers.deleteMany({ where: { id: supplierId ?? 0n } });

    // Deja la configuración de distribución como estaba.
    const settings =
      await prisma.profit_distribution_settings.findFirstOrThrow();
    await prisma.profit_distribution_settings.update({
      where: { id: settings.id },
      data: {
        personal_percentage: originalSettings.personal,
        reinvestment_percentage: originalSettings.reinvestment,
        reserve_percentage: originalSettings.reserve,
      },
    });

    await prisma.audit_logs.deleteMany({ where: { user_id: userId ?? 0n } });
    await prisma.users.deleteMany({ where: { id: userId ?? 0n } });
    await app.close();
  });

  it('sin sesión responde 401', () => {
    return request(app.getHttpServer()).get('/finance/summary').expect(401);
  });

  it('una compra registra una salida por el monto exacto', async () => {
    const delta = await summaryDelta(async () => {
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
    });

    expect(delta.salidas).toBe(500);
    expect(delta.compras).toBe(500);
    expect(delta.realProfit).toBe(0); // comprar mercadería no afecta la utilidad real
  });

  it('una venta registra un ingreso y descuenta el costo de lo vendido de la utilidad real', async () => {
    let saleId = '';
    const delta = await summaryDelta(async () => {
      const res = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(efectivoId),
            items: [
              {
                inventoryItemId: Number(
                  (
                    await prisma.inventory_items.findFirstOrThrow({
                      where: { product_id: productId },
                    })
                  ).id,
                ),
                quantity: 2,
                unitSalePrice: 100,
              },
            ],
          }),
      ).expect(201);
      saleId = (res.body as SaleBody).id;
    });

    expect(delta.ingresos).toBe(200);
    expect(delta.ventas).toBe(200);
    // Costo: 2 unidades × Q50 (costo promedio tras la compra) = Q100.
    expect(delta.realProfit).toBe(100); // 200 ingreso - 100 costo - 0 gastos

    const movements = await prisma.financial_movements.count({
      where: { reference_type: 'sale', reference_id: BigInt(saleId) },
    });
    expect(movements).toBe(1); // no duplicados
  });

  it('un gasto registra una salida y reduce la utilidad real', async () => {
    const delta = await summaryDelta(async () => {
      await authed(
        request(app.getHttpServer())
          .post('/expenses')
          .send({
            categoryId: Number(expenseCategoryId),
            description: `${TEST_NAME_PREFIX}Bolsas`,
            amount: 30,
            paymentMethodId: Number(efectivoId),
          }),
      ).expect(201);
    });

    expect(delta.salidas).toBe(30);
    expect(delta.gastos).toBe(30);
    expect(delta.realProfit).toBe(-30);
  });

  it('un gasto anulado deja de restar de la utilidad real', async () => {
    let expenseId = '';
    const createDelta = await summaryDelta(async () => {
      const res = await authed(
        request(app.getHttpServer())
          .post('/expenses')
          .send({
            categoryId: Number(expenseCategoryId),
            description: `${TEST_NAME_PREFIX}Gasto a anular`,
            amount: 40,
            paymentMethodId: Number(efectivoId),
          }),
      ).expect(201);
      expenseId = (res.body as { id: string }).id;
    });
    expect(createDelta.realProfit).toBe(-40);

    const voidDelta = await summaryDelta(async () => {
      await authed(
        request(app.getHttpServer())
          .patch(`/expenses/${expenseId}/void`)
          .send({}),
      ).expect(200);
    });
    expect(voidDelta.gastos).toBe(-40); // el neto de gastos vuelve a bajar
    expect(voidDelta.realProfit).toBe(40); // revierte exactamente lo que había restado
  });

  it('una devolución registra una salida por el precio realmente vendido (no el de catálogo)', async () => {
    const item = await prisma.inventory_items.findFirstOrThrow({
      where: { product_id: productId },
    });

    const delta = await summaryDelta(async () => {
      const sale = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(efectivoId),
            items: [
              {
                inventoryItemId: Number(item.id),
                quantity: 1,
                unitSalePrice: 90,
              },
            ],
          }),
      ).expect(201);
      const saleBody = sale.body as SaleBody;

      await authed(
        request(app.getHttpServer())
          .post(`/sales/${saleBody.id}/returns`)
          .send({
            reason: 'Otro',
            items: [
              {
                saleItemId: Number(saleBody.items[0].id),
                quantity: 1,
                conditionStatus: 'SALEABLE',
              },
            ],
          }),
      ).expect(201);
    });

    expect(delta.ingresos).toBe(90); // la venta (90, el precio vendido, no 100 de catálogo)
    expect(delta.devoluciones).toBe(90); // la devolución reembolsa esos mismos 90
    expect(delta.salidas).toBe(90);
    // Venta y devolución del mismo producto al mismo precio: efecto neto nulo.
    expect(delta.realProfit).toBe(0);
  });

  it('cancelar una venta neutraliza su efecto financiero', async () => {
    const item = await prisma.inventory_items.findFirstOrThrow({
      where: { product_id: productId },
    });

    const delta = await summaryDelta(async () => {
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
    });

    expect(delta.ingresos).toBe(100); // la venta original
    expect(delta.cancelaciones).toBe(100); // la reversión completa
    expect(delta.realProfit).toBe(0); // neto: ingreso y reversión se cancelan
  });

  describe('POST /finance/manual-income', () => {
    it('registra un ingreso manual que suma a ingresos/disponible pero NO a la utilidad real', async () => {
      const before = await getSummary();

      await authed(
        request(app.getHttpServer())
          .post('/finance/manual-income')
          .send({
            description: `${TEST_NAME_PREFIX}Inyección de capital`,
            amount: 1000,
            paymentMethodId: Number(efectivoId),
          }),
      ).expect(201);

      const after = await getSummary();
      expect(Number(after.ingresos) - Number(before.ingresos)).toBe(1000);
      expect(
        Number(after.breakdown.ingresoManual) -
          Number(before.breakdown.ingresoManual),
      ).toBe(1000);
      expect(Number(after.distribution.realProfit)).toBe(
        Number(before.distribution.realProfit),
      );
    });

    it('rechaza una forma de pago que no aplica (ej. inexistente)', () => {
      return authed(
        request(app.getHttpServer())
          .post('/finance/manual-income')
          .send({
            description: `${TEST_NAME_PREFIX}Ingreso inválido`,
            amount: 100,
            paymentMethodId: 999999999,
          }),
      ).expect(400);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .post('/finance/manual-income')
        .send({ description: 'x', amount: 100, paymentMethodId: 1 })
        .expect(401);
    });
  });

  describe('Distribución del dinero', () => {
    it('obtiene la configuración actual', async () => {
      const res = await authed(
        request(app.getHttpServer()).get('/finance/distribution-settings'),
      ).expect(200);
      const body = res.body as { personalPercentage: string };
      expect(body.personalPercentage).toBeDefined();
    });

    it('60/20/20 reparte la utilidad real en esa proporción', async () => {
      await authed(
        request(app.getHttpServer())
          .patch('/finance/distribution-settings')
          .send({
            personalPercentage: 60,
            reinvestmentPercentage: 20,
            reservePercentage: 20,
          }),
      ).expect(200);

      const summary = await getSummary();
      const { realProfit, personalAmount, reinvestmentAmount, reserveAmount } =
        summary.distribution;
      expect(Number(realProfit)).toBeGreaterThan(0); // acumulado de los tests anteriores
      expect(Number(personalAmount)).toBeCloseTo(Number(realProfit) * 0.6, 2);
      expect(Number(reinvestmentAmount)).toBeCloseTo(
        Number(realProfit) * 0.2,
        2,
      );
      expect(Number(reserveAmount)).toBeCloseTo(Number(realProfit) * 0.2, 2);
      // Suma de las tres partes = utilidad real (sin perder ni inventar dinero).
      expect(
        Number(personalAmount) +
          Number(reinvestmentAmount) +
          Number(reserveAmount),
      ).toBeCloseTo(Number(realProfit), 2);
    });

    it('40/40/20 también suma 100 y reparte personal/reinversión por igual', async () => {
      const res = await authed(
        request(app.getHttpServer())
          .patch('/finance/distribution-settings')
          .send({
            personalPercentage: 40,
            reinvestmentPercentage: 40,
            reservePercentage: 20,
          }),
      ).expect(200);
      expect(
        (res.body as { personalPercentage: string }).personalPercentage,
      ).toBe('40');

      const summary = await getSummary();
      expect(summary.distribution.personalAmount).toBe(
        summary.distribution.reinvestmentAmount,
      );
    });

    it('rechaza porcentajes que no sumen 100', async () => {
      const res = await authed(
        request(app.getHttpServer())
          .patch('/finance/distribution-settings')
          .send({
            personalPercentage: 50,
            reinvestmentPercentage: 30,
            reservePercentage: 30,
          }),
      ).expect(400);
      expect((res.body as ErrorResponseBody).message).toContain('100');
    });
  });

  it('GET /finance/movements lista los movimientos de esta prueba sin duplicarlos', async () => {
    const movements = await prisma.financial_movements.findMany({
      where: { created_by: userId },
    });
    const keys = movements.map(
      (m) => `${m.movement_type}-${m.reference_type}-${m.reference_id}`,
    );
    // Cada operación (venta, compra, gasto, devolución, cancelación) genera
    // como máximo un movimiento de cada tipo — nunca se duplica.
    expect(new Set(keys).size).toBe(keys.length);

    const res = await authed(
      request(app.getHttpServer())
        .get('/finance/movements')
        .query({ pageSize: 100 }),
    ).expect(200);
    const body = res.body as { items: { id: string }[]; total: number };
    expect(body.items.length).toBeGreaterThan(0);
    expect(new Set(body.items.map((i) => i.id)).size).toBe(body.items.length);
  });
});
