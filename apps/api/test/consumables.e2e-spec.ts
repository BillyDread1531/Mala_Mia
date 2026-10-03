import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_consumables_user';
const TEST_PASSWORD = 'e2e-test-password-Gg7!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
const TEST_NAME_PREFIX = 'E2E18C ';

interface ConsumableBody {
  id: string;
  name: string;
  quantity: number;
  lowStockThreshold: number;
  unitsPerSale: number;
  isActive: boolean;
  status: string;
}

describe('Consumables (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: bigint;
  let productId: bigint;
  let sizeM: bigint;
  let colorBeige: bigint;
  let efectivoId: bigint;

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
        full_name: 'E2E Consumables Tester',
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

    const product = await prisma.products.create({
      data: {
        category_id: category.id,
        code: 'E2E18C-0001',
        name: `${TEST_NAME_PREFIX}Blusa`,
        sale_price: 100,
      },
    });
    productId = product.id;
    await prisma.product_variants.create({
      data: { product_id: productId, size_id: sizeM, color_id: colorBeige },
    });
  });

  afterAll(async () => {
    await prisma.consumables.deleteMany({
      where: { name: { startsWith: TEST_NAME_PREFIX } },
    });
    await prisma.expenses.deleteMany({ where: { created_by: userId ?? 0n } });
    const sales = await prisma.sales.findMany({
      where: { created_by: userId ?? 0n },
      select: { id: true },
    });
    const saleIds = sales.map((s) => s.id);
    await prisma.receipts.deleteMany({ where: { sale_id: { in: saleIds } } });
    await prisma.sale_items.deleteMany({ where: { sale_id: { in: saleIds } } });
    await prisma.financial_movements.deleteMany({
      where: { created_by: userId ?? 0n },
    });
    await prisma.sales.deleteMany({ where: { id: { in: saleIds } } });
    const inventoryItems = await prisma.inventory_items.findMany({
      where: { product_id: productId },
      select: { id: true },
    });
    const inventoryIds = inventoryItems.map((i) => i.id);
    await prisma.inventory_movements.deleteMany({
      where: { inventory_item_id: { in: inventoryIds } },
    });
    await prisma.inventory_items.deleteMany({
      where: { id: { in: inventoryIds } },
    });
    await prisma.product_variants.deleteMany({
      where: { product_id: productId },
    });
    await prisma.products.deleteMany({ where: { id: productId ?? 0n } });
    await prisma.audit_logs.deleteMany({ where: { user_id: userId ?? 0n } });
    await prisma.users.deleteMany({ where: { id: userId ?? 0n } });
    await app.close();
  });

  it('sin sesión responde 401', async () => {
    await request(app.getHttpServer()).get('/consumables').expect(401);
  });

  it('crea un insumo con valores por defecto', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .post('/consumables')
        .send({ name: `${TEST_NAME_PREFIX}Bolsas` }),
    ).expect(201);
    const body = res.body as ConsumableBody;
    expect(body.quantity).toBe(0);
    expect(body.lowStockThreshold).toBe(5);
    expect(body.unitsPerSale).toBe(1);
    expect(body.isActive).toBe(true);
    expect(body.status).toBe('AGOTADO');
  });

  it('crear un insumo con costo registra un gasto real (categoría Empaque)', async () => {
    const before = await prisma.expenses.aggregate({
      where: { expense_categories: { name: 'Empaque' } },
      _count: true,
    });

    const res = await authed(
      request(app.getHttpServer())
        .post('/consumables')
        .send({
          name: `${TEST_NAME_PREFIX}BolsasConCosto`,
          quantity: 100,
          cost: 150,
          paymentMethodId: Number(efectivoId),
        }),
    ).expect(201);
    const body = res.body as ConsumableBody;
    expect(body.quantity).toBe(100);

    const after = await prisma.expenses.aggregate({
      where: { expense_categories: { name: 'Empaque' } },
      _count: true,
    });
    expect(after._count).toBe(before._count + 1);

    const expense = await prisma.expenses.findFirst({
      where: { description: { contains: `${TEST_NAME_PREFIX}BolsasConCosto` } },
    });
    expect(expense).not.toBeNull();
    expect(Number(expense!.amount)).toBe(150);
  });

  it('crear un insumo con costo pero sin forma de pago responde 400', async () => {
    await authed(
      request(app.getHttpServer())
        .post('/consumables')
        .send({ name: `${TEST_NAME_PREFIX}SinFormaPago`, cost: 50 }),
    ).expect(400);
  });

  it('ajustar con costo positivo registra un gasto; con costo en ajuste negativo responde 400', async () => {
    const createdRes = await authed(
      request(app.getHttpServer())
        .post('/consumables')
        .send({ name: `${TEST_NAME_PREFIX}Etiquetas`, quantity: 5 }),
    ).expect(201);
    const created = createdRes.body as ConsumableBody;

    await authed(
      request(app.getHttpServer())
        .patch(`/consumables/${created.id}/adjust`)
        .send({ quantityChange: 50, cost: 80, paymentMethodId: Number(efectivoId) }),
    ).expect(200);

    const expense = await prisma.expenses.findFirst({
      where: { description: { contains: `${TEST_NAME_PREFIX}Etiquetas` } },
    });
    expect(expense).not.toBeNull();
    expect(Number(expense!.amount)).toBe(80);

    await authed(
      request(app.getHttpServer())
        .patch(`/consumables/${created.id}/adjust`)
        .send({ quantityChange: -1, cost: 10, paymentMethodId: Number(efectivoId) }),
    ).expect(400);
  });

  it('PATCH /consumables/:id/adjust suma o resta stock sin dejarlo negativo', async () => {
    const createdRes = await authed(
      request(app.getHttpServer())
        .post('/consumables')
        .send({ name: `${TEST_NAME_PREFIX}Cintas`, quantity: 10 }),
    ).expect(201);
    const created = createdRes.body as ConsumableBody;

    const res = await authed(
      request(app.getHttpServer())
        .patch(`/consumables/${created.id}/adjust`)
        .send({ quantityChange: 20 }),
    ).expect(200);
    expect((res.body as ConsumableBody).quantity).toBe(30);

    await authed(
      request(app.getHttpServer())
        .patch(`/consumables/${created.id}/adjust`)
        .send({ quantityChange: -999 }),
    ).expect(400);
  });

  it('PATCH /consumables/:id actualiza umbral y unidades por venta', async () => {
    const createdRes = await authed(
      request(app.getHttpServer())
        .post('/consumables')
        .send({ name: `${TEST_NAME_PREFIX}Editable`, quantity: 10 }),
    ).expect(201);
    const created = createdRes.body as ConsumableBody;

    const res = await authed(
      request(app.getHttpServer())
        .patch(`/consumables/${created.id}`)
        .send({ lowStockThreshold: 3, unitsPerSale: 2 }),
    ).expect(200);
    const updated = res.body as ConsumableBody;
    expect(updated.lowStockThreshold).toBe(3);
    expect(updated.unitsPerSale).toBe(2);
  });

  it('PATCH /consumables/:id/active desactiva y reactiva', async () => {
    const createdRes = await authed(
      request(app.getHttpServer())
        .post('/consumables')
        .send({ name: `${TEST_NAME_PREFIX}Activable` }),
    ).expect(201);
    const created = createdRes.body as ConsumableBody;

    const deactivated = await authed(
      request(app.getHttpServer())
        .patch(`/consumables/${created.id}/active`)
        .send({ isActive: false }),
    ).expect(200);
    expect((deactivated.body as ConsumableBody).isActive).toBe(false);
  });

  it('una venta descuenta automáticamente los insumos activos, sin bloquear la venta al llegar a cero', async () => {
    const consumableRes = await authed(
      request(app.getHttpServer())
        .post('/consumables')
        .send({ name: `${TEST_NAME_PREFIX}BolsasVenta`, quantity: 1 }),
    ).expect(201);
    const consumable = consumableRes.body as ConsumableBody;

    const inventoryItem = await prisma.inventory_items.create({
      data: {
        product_id: productId,
        size_id: sizeM,
        color_id: colorBeige,
        quantity: 5,
        average_cost: 40,
      },
    });

    // Primera venta: consume la única bolsa disponible (1 -> 0).
    await authed(
      request(app.getHttpServer())
        .post('/sales')
        .send({
          paymentMethodId: Number(efectivoId),
          items: [
            {
              inventoryItemId: Number(inventoryItem.id),
              quantity: 1,
              unitSalePrice: 100,
            },
          ],
        }),
    ).expect(201);

    let current = await authed(
      request(app.getHttpServer()).get('/consumables'),
    ).expect(200);
    let found = (current.body as ConsumableBody[]).find(
      (c) => c.id === consumable.id,
    );
    expect(found!.quantity).toBe(0);
    expect(found!.status).toBe('AGOTADO');

    // Segunda venta: ya no hay bolsas, pero la venta de la prenda igual se completa.
    await authed(
      request(app.getHttpServer())
        .post('/sales')
        .send({
          paymentMethodId: Number(efectivoId),
          items: [
            {
              inventoryItemId: Number(inventoryItem.id),
              quantity: 1,
              unitSalePrice: 100,
            },
          ],
        }),
    ).expect(201);

    current = await authed(
      request(app.getHttpServer()).get('/consumables'),
    ).expect(200);
    found = (current.body as ConsumableBody[]).find(
      (c) => c.id === consumable.id,
    );
    expect(found!.quantity).toBe(0);
  });
});
