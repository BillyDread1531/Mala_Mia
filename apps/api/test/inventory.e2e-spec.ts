import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_inventory_user';
const TEST_PASSWORD = 'e2e-test-password-Dd4!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
const TEST_NAME_PREFIX = 'E2E6 ';

interface InventoryItemBody {
  id: string;
  quantity: number;
  status: string;
  averageCost: string;
}

interface PurchaseBody {
  id: string;
}

interface ErrorResponseBody {
  message: string;
}

describe('Inventory (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let supplierId: bigint;
  let productId: bigint;
  let sizeS: bigint;
  let sizeM: bigint;
  let sizeL: bigint;
  let colorBeige: bigint;
  let colorRojo: bigint;
  let paymentMethodId: bigint;
  let userId: bigint;

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
        full_name: 'E2E Inventory Tester',
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
    sizeS = (
      await prisma.sizes.findUniqueOrThrow({ where: { normalized_name: 'S' } })
    ).id;
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
    colorRojo = (
      await prisma.colors.findUniqueOrThrow({
        where: { normalized_name: 'ROJO' },
      })
    ).id;
    paymentMethodId = (
      await prisma.payment_methods.findUniqueOrThrow({
        where: { name: 'Efectivo' },
      })
    ).id;

    const supplier = await prisma.suppliers.create({
      data: { name: `${TEST_NAME_PREFIX}Boutique` },
    });
    supplierId = supplier.id;

    const product = await prisma.products.create({
      data: {
        category_id: category.id,
        code: 'E2E6-0001',
        name: `${TEST_NAME_PREFIX}Blusa Satinada`,
      },
    });
    productId = product.id;
    await prisma.product_variants.createMany({
      data: [
        { product_id: productId, size_id: sizeS, color_id: colorBeige },
        { product_id: productId, size_id: sizeM, color_id: colorBeige },
        { product_id: productId, size_id: sizeL, color_id: colorBeige },
        { product_id: productId, size_id: sizeS, color_id: colorRojo },
      ],
    });
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

    await prisma.inventory_movements.deleteMany({
      where: { inventory_item_id: { in: inventoryIds } },
    });
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
    await prisma.users.deleteMany({ where: { id: userId } });
    await app.close();
  });

  function authed(req: request.Test): request.Test {
    return req.set('Cookie', [sessionCookie]);
  }

  async function createTestPurchase() {
    const res = await authed(
      request(app.getHttpServer())
        .post('/purchases')
        .send({
          supplierId: Number(supplierId),
          paymentMethodId: Number(paymentMethodId),
          items: [
            {
              productId: Number(productId),
              sizeId: Number(sizeM),
              colorId: Number(colorBeige),
              quantity: 3,
              unitCost: 65,
            },
            {
              productId: Number(productId),
              sizeId: Number(sizeL),
              colorId: Number(colorBeige),
              quantity: 2,
              unitCost: 65,
            },
            {
              productId: Number(productId),
              sizeId: Number(sizeS),
              colorId: Number(colorRojo),
              quantity: 1,
              unitCost: 65,
            },
          ],
        }),
    ).expect(201);
    return res.body as PurchaseBody;
  }

  describe('Compra confirmada → entrada de inventario', () => {
    it('una compra con múltiples variantes genera el stock correcto por variante', async () => {
      await createTestPurchase();

      const list = await authed(
        request(app.getHttpServer())
          .get('/inventory')
          .query({ productId: Number(productId) }),
      ).expect(200);
      const items = (
        list.body as {
          items: (InventoryItemBody & {
            sizeName: string;
            colorName: string;
          })[];
        }
      ).items;

      const mBeige = items.find(
        (i) => i.sizeName === 'M' && i.colorName === 'Beige',
      );
      const lBeige = items.find(
        (i) => i.sizeName === 'L' && i.colorName === 'Beige',
      );
      const sRojo = items.find(
        (i) => i.sizeName === 'S' && i.colorName === 'Rojo',
      );

      expect(mBeige?.quantity).toBe(3);
      expect(lBeige?.quantity).toBe(2);
      expect(sRojo?.quantity).toBe(1);
      expect(mBeige?.status).toBe('DISPONIBLE'); // umbral=2, 3>2
      expect(sRojo?.status).toBe('STOCK_BAJO'); // 1<=2 y >0
    });

    it('una segunda compra suma al stock existente (costo promedio ponderado)', async () => {
      const before = await authed(
        request(app.getHttpServer())
          .get('/inventory')
          .query({ productId: Number(productId) }),
      ).expect(200);
      const beforeMBeige = (
        before.body as {
          items: (InventoryItemBody & {
            sizeName: string;
            colorName: string;
          })[];
        }
      ).items.find((i) => i.sizeName === 'M' && i.colorName === 'Beige');
      const quantityBefore = beforeMBeige?.quantity ?? 0;

      await authed(
        request(app.getHttpServer())
          .post('/purchases')
          .send({
            supplierId: Number(supplierId),
            paymentMethodId: Number(paymentMethodId),
            items: [
              {
                productId: Number(productId),
                sizeId: Number(sizeM),
                colorId: Number(colorBeige),
                quantity: 2,
                unitCost: 70,
              },
            ],
          }),
      ).expect(201);

      const after = await authed(
        request(app.getHttpServer())
          .get('/inventory')
          .query({ productId: Number(productId) }),
      ).expect(200);
      const afterMBeige = (
        after.body as {
          items: (InventoryItemBody & {
            sizeName: string;
            colorName: string;
          })[];
        }
      ).items.find((i) => i.sizeName === 'M' && i.colorName === 'Beige');

      expect(afterMBeige?.quantity).toBe(quantityBefore + 2);
      // promedio ponderado: (quantityBefore*65 + 2*70) / (quantityBefore+2)
      const expectedAvg = (quantityBefore * 65 + 2 * 70) / (quantityBefore + 2);
      expect(Number(afterMBeige?.averageCost)).toBeCloseTo(expectedAvg, 2);
    });

    it('no duplica la entrada: una compra con N líneas genera exactamente N movimientos ENTRADA', async () => {
      const purchase = await createTestPurchase();

      const movements = await authed(
        request(app.getHttpServer())
          .get('/inventory/movements')
          .query({ productId: Number(productId) }),
      ).expect(200);
      const entriesForThisPurchase = (
        movements.body as {
          items: { referenceType: string | null; referenceId: string | null }[];
        }
      ).items.filter(
        (m) => m.referenceType === 'purchase' && m.referenceId === purchase.id,
      );

      expect(entriesForThisPurchase).toHaveLength(3);
    });

    it('una compra inválida (variante ajena) no crea inventario (rollback)', async () => {
      const beforeCount = await prisma.inventory_items.count({
        where: { product_id: productId },
      });

      await authed(
        request(app.getHttpServer())
          .post('/purchases')
          .send({
            supplierId: Number(supplierId),
            paymentMethodId: Number(paymentMethodId),
            items: [
              {
                productId: Number(productId),
                sizeId: Number(sizeL),
                colorId: Number(colorRojo),
                quantity: 1,
                unitCost: 65,
              },
            ],
          }),
      ).expect(400);

      const afterCount = await prisma.inventory_items.count({
        where: { product_id: productId },
      });
      expect(afterCount).toBe(beforeCount);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer()).get('/inventory').expect(401);
    });
  });

  describe('PATCH /inventory/:id/adjust', () => {
    it('ajuste negativo reduce el stock y queda en el historial', async () => {
      await createTestPurchase();
      const list = await authed(
        request(app.getHttpServer())
          .get('/inventory')
          .query({ productId: Number(productId) }),
      ).expect(200);
      const items = (
        list.body as {
          items: (InventoryItemBody & {
            sizeName: string;
            colorName: string;
          })[];
        }
      ).items;
      const mBeige = items.find(
        (i) => i.sizeName === 'M' && i.colorName === 'Beige',
      );
      if (!mBeige) throw new Error('fixture inválido');

      const res = await authed(
        request(app.getHttpServer())
          .patch(`/inventory/${mBeige.id}/adjust`)
          .send({ quantityChange: -1, reason: 'Error de conteo' }),
      ).expect(200);
      expect((res.body as InventoryItemBody).quantity).toBe(
        mBeige.quantity - 1,
      );

      const detail = await authed(
        request(app.getHttpServer()).get(`/inventory/${mBeige.id}`),
      ).expect(200);
      const movementTypes = (
        detail.body as { movements: { movementType: string }[] }
      ).movements.map((m) => m.movementType);
      expect(movementTypes).toContain('AJUSTE');
    });

    it('ajuste positivo incrementa el stock', async () => {
      const list = await authed(
        request(app.getHttpServer())
          .get('/inventory')
          .query({ productId: Number(productId) }),
      ).expect(200);
      const sRojo = (
        list.body as {
          items: (InventoryItemBody & {
            sizeName: string;
            colorName: string;
          })[];
        }
      ).items.find((i) => i.sizeName === 'S' && i.colorName === 'Rojo');
      if (!sRojo) throw new Error('fixture inválido');

      const res = await authed(
        request(app.getHttpServer())
          .patch(`/inventory/${sRojo.id}/adjust`)
          .send({ quantityChange: 5, reason: 'Corrección de inventario' }),
      ).expect(200);
      expect((res.body as InventoryItemBody).quantity).toBe(sRojo.quantity + 5);
    });

    it('rechaza un ajuste que dejaría stock negativo', async () => {
      const list = await authed(
        request(app.getHttpServer())
          .get('/inventory')
          .query({ productId: Number(productId) }),
      ).expect(200);
      const anyItem = (list.body as { items: InventoryItemBody[] }).items[0];

      const res = await authed(
        request(app.getHttpServer())
          .patch(`/inventory/${anyItem.id}/adjust`)
          .send({ quantityChange: -999, reason: 'Prenda perdida' }),
      ).expect(400);
      expect((res.body as ErrorResponseBody).message).toContain('negativo');
    });

    it('exige explicación cuando el motivo es "Otro"', async () => {
      const list = await authed(
        request(app.getHttpServer())
          .get('/inventory')
          .query({ productId: Number(productId) }),
      ).expect(200);
      const anyItem = (list.body as { items: InventoryItemBody[] }).items[0];

      await authed(
        request(app.getHttpServer())
          .patch(`/inventory/${anyItem.id}/adjust`)
          .send({ quantityChange: 1, reason: 'Otro' }),
      ).expect(400);
    });

    it('inventario inexistente responde 404', () => {
      return authed(
        request(app.getHttpServer())
          .patch('/inventory/999999999/adjust')
          .send({ quantityChange: 1, reason: 'Error de conteo' }),
      ).expect(404);
    });
  });
});
