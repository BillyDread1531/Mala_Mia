import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_sales_user';
const TEST_PASSWORD = 'e2e-test-password-Dd4!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
const TEST_NAME_PREFIX = 'E2E7 ';

interface SaleBody {
  id: string;
  saleNumber: string;
  subtotal: string;
  discountAmount: string;
  shippingAmount: string;
  total: string;
  paymentMethod: { id: string; name: string };
  items: {
    id: string;
    unitSalePrice: string;
    unitCost: string;
    discountAmount: string;
    subtotal: string;
    quantity: number;
  }[];
}

interface ErrorResponseBody {
  message: string;
}

describe('Sales (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let productAId: bigint;
  let productBId: bigint;
  let sizeM: bigint;
  let sizeL: bigint;
  let colorBeige: bigint;
  let colorNegro: bigint;
  let efectivoId: bigint;
  let transferenciaId: bigint;
  let tarjetaId: bigint;
  let userId: bigint;
  let supplierId: bigint;

  async function stockOf(productId: bigint, sizeId: bigint, colorId: bigint) {
    const item = await prisma.inventory_items.findUnique({
      where: {
        product_id_size_id_color_id: {
          product_id: productId,
          size_id: sizeId,
          color_id: colorId,
        },
      },
    });
    if (!item) throw new Error('fixture inválido: inventario no encontrado');
    return item;
  }

  async function purchase(
    productId: bigint,
    sizeId: bigint,
    colorId: bigint,
    quantity: number,
    unitCost: number,
  ) {
    await authed(
      request(app.getHttpServer())
        .post('/purchases')
        .send({
          supplierId: Number(supplierId),
          paymentMethodId: Number(efectivoId),
          items: [
            {
              productId: Number(productId),
              sizeId: Number(sizeId),
              colorId: Number(colorId),
              quantity,
              unitCost,
            },
          ],
        }),
    ).expect(201);
  }

  function authed(req: request.Test): request.Test {
    return req.set('Cookie', [sessionCookie]);
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
        full_name: 'E2E Sales Tester',
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
    sizeL = (
      await prisma.sizes.findUniqueOrThrow({ where: { normalized_name: 'L' } })
    ).id;
    colorBeige = (
      await prisma.colors.findUniqueOrThrow({
        where: { normalized_name: 'BEIGE' },
      })
    ).id;
    colorNegro = (
      await prisma.colors.findUniqueOrThrow({
        where: { normalized_name: 'NEGRO' },
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
    tarjetaId = (
      await prisma.payment_methods.findUniqueOrThrow({
        where: { name: 'Tarjeta' },
      })
    ).id;

    const supplier = await prisma.suppliers.create({
      data: { name: `${TEST_NAME_PREFIX}Boutique` },
    });
    supplierId = supplier.id;

    const productA = await prisma.products.create({
      data: {
        category_id: category.id,
        code: 'E2E7-0001',
        name: `${TEST_NAME_PREFIX}Producto A`,
        sale_price: 125,
      },
    });
    productAId = productA.id;
    await prisma.product_variants.create({
      data: { product_id: productAId, size_id: sizeM, color_id: colorBeige },
    });

    const productB = await prisma.products.create({
      data: {
        category_id: category.id,
        code: 'E2E7-0002',
        name: `${TEST_NAME_PREFIX}Producto B`,
        sale_price: 150,
      },
    });
    productBId = productB.id;
    await prisma.product_variants.create({
      data: { product_id: productBId, size_id: sizeL, color_id: colorNegro },
    });

    await purchase(productAId, sizeM, colorBeige, 10, 60);
    await purchase(productBId, sizeL, colorNegro, 10, 80);
  });

  afterAll(async () => {
    const testPurchases = await prisma.purchases.findMany({
      where: { suppliers: { name: { startsWith: TEST_NAME_PREFIX } } },
      select: { id: true },
    });
    const purchaseIds = testPurchases.map((p) => p.id);
    const testInventoryItems = await prisma.inventory_items.findMany({
      where: { products: { name: { startsWith: TEST_NAME_PREFIX } } },
      select: { id: true },
    });
    const inventoryIds = testInventoryItems.map((i) => i.id);
    const testSales = await prisma.sales.findMany({
      where: {
        sale_items: { some: { inventory_item_id: { in: inventoryIds } } },
      },
      select: { id: true },
    });
    const saleIds = testSales.map((s) => s.id);

    await prisma.inventory_movements.deleteMany({
      where: { inventory_item_id: { in: inventoryIds } },
    });
    await prisma.receipts.deleteMany({ where: { sale_id: { in: saleIds } } });
    await prisma.sale_items.deleteMany({ where: { sale_id: { in: saleIds } } });
    await prisma.sales.deleteMany({ where: { id: { in: saleIds } } });
    await prisma.inventory_items.deleteMany({
      where: { id: { in: inventoryIds } },
    });
    await prisma.purchase_items.deleteMany({
      where: { purchase_id: { in: purchaseIds } },
    });
    await prisma.purchases.deleteMany({ where: { id: { in: purchaseIds } } });
    await prisma.products.deleteMany({
      where: { name: { startsWith: TEST_NAME_PREFIX } },
    });
    await prisma.suppliers.deleteMany({
      where: { name: { startsWith: TEST_NAME_PREFIX } },
    });
    await prisma.financial_movements.deleteMany({
      where: { created_by: userId ?? 0n },
    });
    await prisma.audit_logs.deleteMany({ where: { user_id: userId ?? 0n } });
    await prisma.users.deleteMany({ where: { id: userId ?? 0n } });
    await app.close();
  });

  describe('POST /sales', () => {
    it('crea una venta de un solo producto y descuenta el inventario', async () => {
      const before = await stockOf(productAId, sizeM, colorBeige);

      const res = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(efectivoId),
            items: [
              {
                inventoryItemId: Number(before.id),
                quantity: 1,
                unitSalePrice: 125,
              },
            ],
          }),
      ).expect(201);
      const body = res.body as SaleBody;

      expect(body.items).toHaveLength(1);
      expect(body.total).toBe('125');
      expect(body.paymentMethod.name).toBe('Efectivo');

      const after = await stockOf(productAId, sizeM, colorBeige);
      expect(after.quantity).toBe(before.quantity - 1);
    });

    it('con envío, lo suma al total y lo refleja en los movimientos de ingreso', async () => {
      const before = await stockOf(productAId, sizeM, colorBeige);

      const res = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(efectivoId),
            shippingAmount: 35,
            items: [
              {
                inventoryItemId: Number(before.id),
                quantity: 1,
                unitSalePrice: 125,
              },
            ],
          }),
      ).expect(201);
      const body = res.body as SaleBody;

      expect(body.shippingAmount).toBe('35');
      expect(body.total).toBe('160');

      const movement = await prisma.financial_movements.findFirstOrThrow({
        where: { reference_type: 'sale', reference_id: BigInt(body.id) },
      });
      expect(Number(movement.amount)).toBe(160); // el envío no se registra aparte
    });

    it('sin envío, no afecta el total (compatibilidad con ventas existentes)', async () => {
      const before = await stockOf(productBId, sizeL, colorNegro);

      const res = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(efectivoId),
            items: [
              {
                inventoryItemId: Number(before.id),
                quantity: 1,
                unitSalePrice: 150,
              },
            ],
          }),
      ).expect(201);
      const body = res.body as SaleBody;

      expect(body.shippingAmount).toBe('0');
      expect(body.total).toBe('150');
    });

    it('crea una venta con múltiples productos en una sola operación', async () => {
      const beforeA = await stockOf(productAId, sizeM, colorBeige);
      const beforeB = await stockOf(productBId, sizeL, colorNegro);

      const res = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(transferenciaId),
            items: [
              {
                inventoryItemId: Number(beforeA.id),
                quantity: 1,
                unitSalePrice: 125,
              },
              {
                inventoryItemId: Number(beforeB.id),
                quantity: 2,
                unitSalePrice: 150,
              },
            ],
          }),
      ).expect(201);
      const body = res.body as SaleBody;

      expect(body.items).toHaveLength(2);
      expect(body.total).toBe('425'); // 125 + 2*150
      expect(body.paymentMethod.name).toBe('Transferencia');

      const afterA = await stockOf(productAId, sizeM, colorBeige);
      const afterB = await stockOf(productBId, sizeL, colorNegro);
      expect(afterA.quantity).toBe(beforeA.quantity - 1);
      expect(afterB.quantity).toBe(beforeB.quantity - 2);
    });

    it('vender múltiples unidades de una misma variante funciona en una sola línea', async () => {
      const before = await stockOf(productBId, sizeL, colorNegro);

      const res = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(efectivoId),
            items: [
              {
                inventoryItemId: Number(before.id),
                quantity: 3,
                unitSalePrice: 150,
              },
            ],
          }),
      ).expect(201);
      const body = res.body as SaleBody;

      expect(body.items[0].quantity).toBe(3);
      expect(body.total).toBe('450');

      const after = await stockOf(productBId, sizeL, colorNegro);
      expect(after.quantity).toBe(before.quantity - 3);
    });

    it('registra un precio modificado por regateo sin alterar el precio del producto', async () => {
      const before = await stockOf(productAId, sizeM, colorBeige);

      const res = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(efectivoId),
            items: [
              {
                inventoryItemId: Number(before.id),
                quantity: 1,
                unitSalePrice: 115,
              },
            ],
          }),
      ).expect(201);
      const body = res.body as SaleBody;

      expect(body.items[0].unitSalePrice).toBe('115');
      expect(body.items[0].discountAmount).toBe('10'); // 125 (precio de catálogo) - 115
      expect(body.items[0].subtotal).toBe('115');

      const product = await prisma.products.findUniqueOrThrow({
        where: { id: productAId },
      });
      expect(Number(product.sale_price)).toBe(125); // sin alterar
    });

    it('rechaza vender más unidades de las disponibles en stock', async () => {
      const before = await stockOf(productAId, sizeM, colorBeige);

      const res = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(efectivoId),
            items: [
              {
                inventoryItemId: Number(before.id),
                quantity: before.quantity + 1,
                unitSalePrice: 125,
              },
            ],
          }),
      ).expect(400);
      expect((res.body as ErrorResponseBody).message).toContain(
        'Stock insuficiente',
      );

      const after = await stockOf(productAId, sizeM, colorBeige);
      expect(after.quantity).toBe(before.quantity); // no se tocó
    });

    it('genera el movimiento de SALIDA con referencia a la venta', async () => {
      const before = await stockOf(productAId, sizeM, colorBeige);

      const res = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(efectivoId),
            items: [
              {
                inventoryItemId: Number(before.id),
                quantity: 1,
                unitSalePrice: 125,
              },
            ],
          }),
      ).expect(201);
      const sale = res.body as SaleBody;

      const movements = await prisma.inventory_movements.findMany({
        where: {
          inventory_item_id: before.id,
          reference_type: 'sale',
          reference_id: BigInt(sale.id),
        },
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].movement_type).toBe('SALIDA');
      expect(movements[0].quantity).toBe(-1);
    });

    it('la operación es transaccional: una forma de pago inválida no crea la venta ni toca el inventario', async () => {
      const before = await stockOf(productAId, sizeM, colorBeige);
      const salesCountBefore = await prisma.sales.count();

      await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: 999999,
            items: [
              {
                inventoryItemId: Number(before.id),
                quantity: 1,
                unitSalePrice: 125,
              },
            ],
          }),
      ).expect(400);

      const after = await stockOf(productAId, sizeM, colorBeige);
      expect(after.quantity).toBe(before.quantity);
      expect(await prisma.sales.count()).toBe(salesCountBefore);
    });

    it('rechaza una forma de pago que no aplica a ventas (ej. Tarjeta)', async () => {
      const before = await stockOf(productAId, sizeM, colorBeige);

      await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(tarjetaId),
            items: [
              {
                inventoryItemId: Number(before.id),
                quantity: 1,
                unitSalePrice: 125,
              },
            ],
          }),
      ).expect(400);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer()).get('/sales').expect(401);
    });
  });

  describe('GET /sales', () => {
    it('busca por nombre de producto, no solo por número de venta', async () => {
      const before = await stockOf(productAId, sizeM, colorBeige);
      const created = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(efectivoId),
            items: [
              {
                inventoryItemId: Number(before.id),
                quantity: 1,
                unitSalePrice: 125,
              },
            ],
          }),
      ).expect(201);
      const sale = created.body as SaleBody;

      const res = await authed(
        request(app.getHttpServer()).get(
          `/sales?search=${encodeURIComponent(`${TEST_NAME_PREFIX}Producto A`)}`,
        ),
      ).expect(200);
      const body = res.body as { items: SaleBody[] };

      expect(body.items.some((item) => item.id === sale.id)).toBe(true);
    });

    it('filtra por rango de fechas', async () => {
      const before = await stockOf(productAId, sizeM, colorBeige);
      const created = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(efectivoId),
            items: [
              {
                inventoryItemId: Number(before.id),
                quantity: 1,
                unitSalePrice: 125,
              },
            ],
          }),
      ).expect(201);
      const sale = created.body as SaleBody;

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 1);

      const within = await authed(
        request(app.getHttpServer()).get(
          `/sales?search=${encodeURIComponent(TEST_NAME_PREFIX)}&to=${tomorrow.toISOString()}`,
        ),
      ).expect(200);
      expect(
        (within.body as { items: SaleBody[] }).items.some(
          (item) => item.id === sale.id,
        ),
      ).toBe(true);

      const outside = await authed(
        request(app.getHttpServer()).get(
          `/sales?search=${encodeURIComponent(TEST_NAME_PREFIX)}&from=${nextYear.toISOString()}`,
        ),
      ).expect(200);
      expect(
        (outside.body as { items: SaleBody[] }).items.some(
          (item) => item.id === sale.id,
        ),
      ).toBe(false);
    });
  });

  describe('GET /sales/:id', () => {
    it('consulta el detalle de una venta con sus líneas', async () => {
      const before = await stockOf(productBId, sizeL, colorNegro);
      const created = await authed(
        request(app.getHttpServer())
          .post('/sales')
          .send({
            paymentMethodId: Number(efectivoId),
            notes: 'Cliente frecuente',
            items: [
              {
                inventoryItemId: Number(before.id),
                quantity: 1,
                unitSalePrice: 150,
              },
            ],
          }),
      ).expect(201);
      const sale = created.body as SaleBody;

      const detail = await authed(
        request(app.getHttpServer()).get(`/sales/${sale.id}`),
      ).expect(200);
      const body = detail.body as SaleBody & { notes: string | null };

      expect(body.id).toBe(sale.id);
      expect(body.notes).toBe('Cliente frecuente');
      expect(body.items).toHaveLength(1);
    });

    it('venta inexistente responde 404', () => {
      return authed(
        request(app.getHttpServer()).get('/sales/999999999'),
      ).expect(404);
    });
  });
});
