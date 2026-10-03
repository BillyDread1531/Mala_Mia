import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_suppliers_user';
const TEST_PASSWORD = 'e2e-test-password-Ff6!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
const TEST_NAME_PREFIX = 'E2E16S ';

interface SupplierBody {
  id: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  contactPerson: string | null;
  address: string | null;
  social: string | null;
  notes: string | null;
  isActive: boolean;
}

interface SupplierListItemBody extends SupplierBody {
  purchaseCount: number;
  lastPurchaseDate: string | null;
  totalPurchased: string;
}

describe('Suppliers (e2e)', () => {
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
        full_name: 'E2E Suppliers Tester',
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
        code: 'E2E16S-0001',
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
    const suppliers = await prisma.suppliers.findMany({
      where: { name: { startsWith: TEST_NAME_PREFIX } },
      select: { id: true },
    });
    const supplierIds = suppliers.map((s) => s.id);
    const purchases = await prisma.purchases.findMany({
      where: { supplier_id: { in: supplierIds } },
      select: { id: true },
    });
    const purchaseIds = purchases.map((p) => p.id);
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
    await prisma.purchase_items.deleteMany({
      where: { purchase_id: { in: purchaseIds } },
    });
    await prisma.financial_movements.deleteMany({
      where: { created_by: userId ?? 0n },
    });
    await prisma.purchases.deleteMany({ where: { id: { in: purchaseIds } } });
    await prisma.product_variants.deleteMany({
      where: { product_id: productId },
    });
    await prisma.products.deleteMany({ where: { id: productId ?? 0n } });
    await prisma.suppliers.deleteMany({ where: { id: { in: supplierIds } } });
    await prisma.audit_logs.deleteMany({ where: { user_id: userId ?? 0n } });
    await prisma.users.deleteMany({ where: { id: userId ?? 0n } });
    await app.close();
  });

  it('sin sesión responde 401', async () => {
    await request(app.getHttpServer()).get('/suppliers').expect(401);
    await request(app.getHttpServer()).get('/suppliers/all').expect(401);
  });

  it('crea un proveedor con contactos y lo expone en camelCase', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .post('/suppliers')
        .send({
          name: `${TEST_NAME_PREFIX}Textiles`,
          phone: '12345678',
          whatsapp: '12345678',
          contactPerson: 'Juan Pérez',
          address: 'Zona 1',
          social: '@textiles',
          notes: 'Entrega los lunes',
        }),
    ).expect(201);
    const body = res.body as SupplierBody;
    expect(body.contactPerson).toBe('Juan Pérez');
    expect(body.isActive).toBe(true);
  });

  it('GET /suppliers (activos) no incluye snake_case ni proveedores inactivos', async () => {
    const createdRes = await authed(
      request(app.getHttpServer())
        .post('/suppliers')
        .send({ name: `${TEST_NAME_PREFIX}Inactivo` }),
    ).expect(201);
    const created = createdRes.body as SupplierBody;
    await authed(
      request(app.getHttpServer())
        .patch(`/suppliers/${created.id}/active`)
        .send({
          isActive: false,
        }),
    ).expect(200);

    const res = await authed(
      request(app.getHttpServer()).get('/suppliers'),
    ).expect(200);
    const list = res.body as SupplierBody[];
    expect(list.some((s) => s.id === created.id)).toBe(false);
    expect((res.body as Record<string, unknown>[])[0]).not.toHaveProperty(
      'is_active',
    );
  });

  it('GET /suppliers/all incluye inactivos con estadísticas de compra', async () => {
    const supplierRes = await authed(
      request(app.getHttpServer())
        .post('/suppliers')
        .send({ name: `${TEST_NAME_PREFIX}ConCompras` }),
    ).expect(201);
    const supplier = supplierRes.body as SupplierBody;

    await authed(
      request(app.getHttpServer())
        .post('/purchases')
        .send({
          supplierId: Number(supplier.id),
          paymentMethodId: Number(efectivoId),
          items: [
            {
              productId: Number(productId),
              sizeId: Number(sizeM),
              colorId: Number(colorBeige),
              quantity: 5,
              unitCost: 40,
            },
          ],
        }),
    ).expect(201);

    const res = await authed(
      request(app.getHttpServer()).get('/suppliers/all'),
    ).expect(200);
    const list = res.body as SupplierListItemBody[];
    const found = list.find((s) => s.id === supplier.id);
    expect(found).toBeDefined();
    expect(found!.purchaseCount).toBe(1);
    expect(found!.totalPurchased).toBe('200');
    expect(found!.lastPurchaseDate).not.toBeNull();
  });

  it('GET /suppliers/:id devuelve el detalle', async () => {
    const createdRes = await authed(
      request(app.getHttpServer())
        .post('/suppliers')
        .send({ name: `${TEST_NAME_PREFIX}Detalle` }),
    ).expect(201);
    const created = createdRes.body as SupplierBody;

    const res = await authed(
      request(app.getHttpServer()).get(`/suppliers/${created.id}`),
    ).expect(200);
    expect((res.body as SupplierBody).name).toBe(`${TEST_NAME_PREFIX}Detalle`);
  });

  it('GET /suppliers/:id con id inexistente responde 404', async () => {
    await authed(
      request(app.getHttpServer()).get('/suppliers/999999999'),
    ).expect(404);
  });

  it('PATCH /suppliers/:id actualiza solo los campos enviados', async () => {
    const createdRes = await authed(
      request(app.getHttpServer())
        .post('/suppliers')
        .send({ name: `${TEST_NAME_PREFIX}Editable`, phone: '111' }),
    ).expect(201);
    const created = createdRes.body as SupplierBody;

    const res = await authed(
      request(app.getHttpServer())
        .patch(`/suppliers/${created.id}`)
        .send({ whatsapp: '222' }),
    ).expect(200);
    const updated = res.body as SupplierBody;
    expect(updated.phone).toBe('111'); // no enviado, se conserva
    expect(updated.whatsapp).toBe('222');
  });

  it('PATCH /suppliers/:id/active reactiva sin perder identidad ni historial', async () => {
    const createdRes = await authed(
      request(app.getHttpServer())
        .post('/suppliers')
        .send({ name: `${TEST_NAME_PREFIX}Reactivable` }),
    ).expect(201);
    const created = createdRes.body as SupplierBody;

    await authed(
      request(app.getHttpServer())
        .patch(`/suppliers/${created.id}/active`)
        .send({ isActive: false }),
    ).expect(200);
    const reactivated = await authed(
      request(app.getHttpServer())
        .patch(`/suppliers/${created.id}/active`)
        .send({ isActive: true }),
    ).expect(200);
    const body = reactivated.body as SupplierBody;
    expect(body.id).toBe(created.id);
    expect(body.isActive).toBe(true);
  });

  it('GET /purchases?supplierId filtra correctamente', async () => {
    const supplierRes = await authed(
      request(app.getHttpServer())
        .post('/suppliers')
        .send({ name: `${TEST_NAME_PREFIX}Filtro` }),
    ).expect(201);
    const supplier = supplierRes.body as SupplierBody;

    await authed(
      request(app.getHttpServer())
        .post('/purchases')
        .send({
          supplierId: Number(supplier.id),
          paymentMethodId: Number(efectivoId),
          items: [
            {
              productId: Number(productId),
              sizeId: Number(sizeM),
              colorId: Number(colorBeige),
              quantity: 2,
              unitCost: 30,
            },
          ],
        }),
    ).expect(201);

    const res = await authed(
      request(app.getHttpServer())
        .get('/purchases')
        .query({ supplierId: Number(supplier.id) }),
    ).expect(200);
    const body = res.body as {
      items: { supplier: { id: string } }[];
      total: number;
    };
    expect(body.total).toBe(1);
    expect(body.items[0].supplier.id).toBe(supplier.id);
  });
});
