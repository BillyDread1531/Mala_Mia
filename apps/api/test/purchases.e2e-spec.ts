import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_purchases_user';
const TEST_PASSWORD = 'e2e-test-password-Cc3!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
// Prefijo propio (distinto del "E2E " que usa products.e2e-spec.ts) para
// que el cleanup de un archivo de tests nunca borre datos del otro.
const TEST_NAME_PREFIX = 'E2E5 ';

interface PurchaseItemBody {
  productId: string;
  sizeId: string;
  colorId: string;
  quantity: number;
  unitCost: string;
  subtotal: string;
}

interface PurchaseBody {
  id: string;
  purchaseNumber: string;
  status: string;
  supplier: { id: string; name: string };
  paymentMethod: { id: string; name: string };
  itemCount: number;
  goodsTotal: string;
  totalCost: string;
  items: PurchaseItemBody[];
}

interface ListResponseBody {
  items: PurchaseBody[];
  total: number;
}

interface ErrorResponseBody {
  message: string;
}

describe('Purchases (e2e)', () => {
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
        full_name: 'E2E Purchases Tester',
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
      data: { name: `${TEST_NAME_PREFIX}Boutique XX` },
    });
    supplierId = supplier.id;

    const product = await prisma.products.create({
      data: {
        category_id: category.id,
        code: 'E2E-PUR-0001',
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
    // purchase_items -> purchases no tienen onDelete: Cascade a propósito
    // (no se deben borrar compras historicas silenciosamente), asi que el
    // orden de borrado aqui importa.
    const testPurchases = await prisma.purchases.findMany({
      where: { suppliers: { name: { startsWith: TEST_NAME_PREFIX } } },
      select: { id: true },
    });
    const purchaseIds = testPurchases.map((p) => p.id);
    // Fase 6: estas compras ahora también generan inventory_items/movements.
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

  describe('POST /purchases', () => {
    it('crea una compra con múltiples líneas y calcula subtotales y total', async () => {
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

      const body = res.body as PurchaseBody;
      expect(body.itemCount).toBe(3);
      expect(body.items.map((i) => i.subtotal).sort()).toEqual(
        ['130', '195', '65'].sort(),
      );
      expect(body.goodsTotal).toBe('390');
      expect(body.totalCost).toBe('390');
      expect(body.supplier).toEqual({
        id: supplierId.toString(),
        name: `${TEST_NAME_PREFIX}Boutique XX`,
      });
      expect(body.purchaseNumber).toMatch(/^\d{5}$/);
    });

    it('rechaza una variante que no pertenece al producto', async () => {
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
                colorId: Number(colorRojo),
                quantity: 1,
                unitCost: 65,
              },
            ],
          }),
      ).expect(400);

      expect((res.body as ErrorResponseBody).message).toContain(
        'no pertenece al producto',
      );
    });

    it('rechaza un proveedor inexistente', () => {
      return authed(
        request(app.getHttpServer())
          .post('/purchases')
          .send({
            supplierId: 999999,
            paymentMethodId: Number(paymentMethodId),
            items: [
              {
                productId: Number(productId),
                sizeId: Number(sizeS),
                colorId: Number(colorBeige),
                quantity: 1,
                unitCost: 65,
              },
            ],
          }),
      ).expect(400);
    });

    it('rechaza datos inválidos (cantidad 0, sin líneas)', async () => {
      await authed(
        request(app.getHttpServer())
          .post('/purchases')
          .send({
            supplierId: Number(supplierId),
            paymentMethodId: Number(paymentMethodId),
            items: [
              {
                productId: Number(productId),
                sizeId: Number(sizeS),
                colorId: Number(colorBeige),
                quantity: 0,
                unitCost: 65,
              },
            ],
          }),
      ).expect(400);

      await authed(
        request(app.getHttpServer())
          .post('/purchases')
          .send({
            supplierId: Number(supplierId),
            paymentMethodId: Number(paymentMethodId),
            items: [],
          }),
      ).expect(400);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .post('/purchases')
        .send({
          supplierId: Number(supplierId),
          paymentMethodId: Number(paymentMethodId),
          items: [
            {
              productId: Number(productId),
              sizeId: Number(sizeS),
              colorId: Number(colorBeige),
              quantity: 1,
              unitCost: 65,
            },
          ],
        })
        .expect(401);
    });

    it('no crea ninguna compra si una línea falla (transacción/rollback)', async () => {
      const before = await prisma.purchases.count({
        where: { supplier_id: supplierId },
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
                sizeId: Number(sizeS),
                colorId: Number(colorBeige),
                quantity: 1,
                unitCost: 65,
              },
              // Esta combinacion no pertenece al producto: toda la compra debe fallar.
              {
                productId: Number(productId),
                sizeId: Number(sizeM),
                colorId: Number(colorRojo),
                quantity: 1,
                unitCost: 65,
              },
            ],
          }),
      ).expect(400);

      const after = await prisma.purchases.count({
        where: { supplier_id: supplierId },
      });
      expect(after).toBe(before);
    });
  });

  describe('GET /purchases', () => {
    it('lista y busca compras por proveedor', async () => {
      await authed(
        request(app.getHttpServer())
          .post('/purchases')
          .send({
            supplierId: Number(supplierId),
            paymentMethodId: Number(paymentMethodId),
            items: [
              {
                productId: Number(productId),
                sizeId: Number(sizeS),
                colorId: Number(colorBeige),
                quantity: 1,
                unitCost: 65,
              },
            ],
          }),
      ).expect(201);

      const res = await authed(
        request(app.getHttpServer())
          .get('/purchases')
          .query({ search: 'Boutique XX' }),
      ).expect(200);

      const body = res.body as ListResponseBody;
      expect(
        body.items.some(
          (p) => p.supplier.name === `${TEST_NAME_PREFIX}Boutique XX`,
        ),
      ).toBe(true);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer()).get('/purchases').expect(401);
    });
  });

  describe('GET /purchases/:id', () => {
    it('consulta el detalle con productos, variantes y costos', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/purchases')
          .send({
            supplierId: Number(supplierId),
            paymentMethodId: Number(paymentMethodId),
            items: [
              {
                productId: Number(productId),
                sizeId: Number(sizeL),
                colorId: Number(colorBeige),
                quantity: 4,
                unitCost: 70,
              },
            ],
          }),
      ).expect(201);
      const id = (create.body as PurchaseBody).id;

      const res = await authed(
        request(app.getHttpServer()).get(`/purchases/${id}`),
      ).expect(200);
      const body = res.body as PurchaseBody;
      expect(body.items[0].quantity).toBe(4);
      expect(body.items[0].unitCost).toBe('70');
      expect(body.items[0].subtotal).toBe('280');
    });

    it('compra inexistente responde 404', () => {
      return authed(
        request(app.getHttpServer()).get('/purchases/999999999'),
      ).expect(404);
    });
  });
});
