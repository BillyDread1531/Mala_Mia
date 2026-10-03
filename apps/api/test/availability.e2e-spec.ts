import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_availability_user';
const TEST_PASSWORD = 'e2e-test-password-Dd4!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
const TEST_NAME_PREFIX = 'E2E9 ';

interface AvailabilityItemBody {
  productId: string;
  productName: string;
  sizeName: string;
  colorName: string;
  quantity: number;
  status: string;
  categoryName: string;
}

interface AvailabilityResponseBody {
  items: AvailabilityItemBody[];
  total: number;
  summary: {
    products: number;
    available: number;
    lowStock: number;
    outOfStock: number;
  };
}

describe('Availability (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: bigint;
  let blusasId: bigint;
  let pantalonesId: bigint;
  let productId: bigint;
  let inactiveProductId: bigint;
  let sizeS: bigint;
  let sizeM: bigint;
  let sizeL: bigint;
  let colorBeige: bigint;
  let colorRojo: bigint;
  let colorNegro: bigint;

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
        full_name: 'E2E Availability Tester',
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

    blusasId = (
      await prisma.categories.findUniqueOrThrow({ where: { name: 'Blusas' } })
    ).id;
    pantalonesId = (
      await prisma.categories.findUniqueOrThrow({
        where: { name: 'Pantalones' },
      })
    ).id;
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
    colorNegro = (
      await prisma.colors.findUniqueOrThrow({
        where: { normalized_name: 'NEGRO' },
      })
    ).id;

    // Blusa: M/Beige con stock, M/Rojo DECLARADO pero nunca comprado (0 real),
    // L/Negro con poco stock, S/Beige declarada y luego DESACTIVADA (no debe
    // aparecer nunca, ni siquiera como agotada).
    const product = await prisma.products.create({
      data: {
        category_id: blusasId,
        code: 'E2E9-0001',
        name: `${TEST_NAME_PREFIX}Blusa Disponible`,
        sale_price: 120,
        waist_measurement: 76,
        length_measurement: 102,
      },
    });
    productId = product.id;
    await prisma.product_variants.createMany({
      data: [
        { product_id: productId, size_id: sizeM, color_id: colorBeige },
        { product_id: productId, size_id: sizeM, color_id: colorRojo },
        { product_id: productId, size_id: sizeL, color_id: colorNegro },
        {
          product_id: productId,
          size_id: sizeS,
          color_id: colorBeige,
          is_active: false,
        },
      ],
    });
    await prisma.inventory_items.create({
      data: {
        product_id: productId,
        size_id: sizeM,
        color_id: colorBeige,
        quantity: 3,
        average_cost: 60,
      },
    });
    await prisma.inventory_items.create({
      data: {
        product_id: productId,
        size_id: sizeL,
        color_id: colorNegro,
        quantity: 1,
        average_cost: 60,
      },
    });
    // M/Rojo nunca compró: a propósito, no se crea inventory_items para él.

    // Producto inactivo: nunca debe aparecer en disponibilidad.
    const inactiveProduct = await prisma.products.create({
      data: {
        category_id: pantalonesId,
        code: 'E2E9-0002',
        name: `${TEST_NAME_PREFIX}Pantalón Descontinuado`,
        sale_price: 90,
        is_available_for_sale: false,
      },
    });
    inactiveProductId = inactiveProduct.id;
    await prisma.product_variants.create({
      data: {
        product_id: inactiveProductId,
        size_id: sizeM,
        color_id: colorNegro,
      },
    });
  });

  afterAll(async () => {
    const products = await prisma.products.findMany({
      where: { name: { startsWith: TEST_NAME_PREFIX } },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);
    await prisma.inventory_movements.deleteMany({
      where: { inventory_items: { product_id: { in: productIds } } },
    });
    await prisma.inventory_items.deleteMany({
      where: { product_id: { in: productIds } },
    });
    await prisma.product_variants.deleteMany({
      where: { product_id: { in: productIds } },
    });
    await prisma.products.deleteMany({ where: { id: { in: productIds } } });
    await prisma.audit_logs.deleteMany({ where: { user_id: userId ?? 0n } });
    await prisma.users.deleteMany({ where: { id: userId ?? 0n } });
    await app.close();
  });

  it('sin sesión responde 401', () => {
    return request(app.getHttpServer()).get('/availability').expect(401);
  });

  it('obtiene disponibilidad e incluye variantes con stock 0 (nunca compradas)', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'E2E9 Blusa' }),
    ).expect(200);
    const body = res.body as AvailabilityResponseBody;

    const mBeige = body.items.find(
      (i) => i.sizeName === 'M' && i.colorName === 'Beige',
    );
    const mRojo = body.items.find(
      (i) => i.sizeName === 'M' && i.colorName === 'Rojo',
    );
    const lNegro = body.items.find(
      (i) => i.sizeName === 'L' && i.colorName === 'Negro',
    );

    expect(mBeige?.quantity).toBe(3);
    expect(mBeige?.status).toBe('DISPONIBLE');
    expect(mRojo?.quantity).toBe(0); // nunca tuvo inventory_items, igual aparece
    expect(mRojo?.status).toBe('AGOTADO');
    expect(lNegro?.quantity).toBe(1);
    expect(lNegro?.status).toBe('STOCK_BAJO'); // umbral=2: 1<=2 y >0

    // La combinación desactivada (S/Beige) nunca debe aparecer.
    expect(
      body.items.some((i) => i.sizeName === 'S' && i.colorName === 'Beige'),
    ).toBe(false);
  });

  it('busca por nombre de producto', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'Disponible' }),
    ).expect(200);
    const body = res.body as AvailabilityResponseBody;
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((i) => i.productName.includes('Disponible'))).toBe(
      true,
    );
  });

  it('busca por código/SKU', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'E2E9-0001' }),
    ).expect(200);
    const body = res.body as AvailabilityResponseBody;
    expect(body.items.length).toBe(3); // 3 combos activos de ese producto
  });

  it('busca por color', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'E2E9 Blusa Rojo' }),
    ).expect(200);
    const body = res.body as AvailabilityResponseBody;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].colorName).toBe('Rojo');
  });

  it('busca por talla', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'E2E9 Blusa L' }),
    ).expect(200);
    const body = res.body as AvailabilityResponseBody;
    expect(body.items.some((i) => i.sizeName === 'L')).toBe(true);
  });

  it('filtra por categoría', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'E2E9', categoryId: Number(blusasId) }),
    ).expect(200);
    const body = res.body as AvailabilityResponseBody;
    expect(body.items).toHaveLength(3); // los 3 combos activos de la Blusa
    expect(body.items.every((i) => i.categoryName === 'Blusas')).toBe(true);

    const noneInPantalones = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'E2E9', categoryId: Number(pantalonesId) }),
    ).expect(200);
    // El único producto de Pantalones está inactivo (is_available_for_sale=false).
    expect(
      (noneInPantalones.body as AvailabilityResponseBody).items,
    ).toHaveLength(0);
  });

  it('filtra por estado disponible', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'E2E9 Blusa', status: 'DISPONIBLE' }),
    ).expect(200);
    const body = res.body as AvailabilityResponseBody;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].sizeName).toBe('M');
    expect(body.items[0].colorName).toBe('Beige');
  });

  it('filtra por estado pocas unidades', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'E2E9 Blusa', status: 'STOCK_BAJO' }),
    ).expect(200);
    const body = res.body as AvailabilityResponseBody;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].colorName).toBe('Negro');
  });

  it('filtra por estado agotado', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'E2E9 Blusa', status: 'AGOTADO' }),
    ).expect(200);
    const body = res.body as AvailabilityResponseBody;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].colorName).toBe('Rojo');
  });

  it('combina filtros (categoría + talla + color)', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({
          search: 'E2E9',
          categoryId: Number(blusasId),
          sizeId: Number(sizeM),
          colorId: Number(colorBeige),
        }),
    ).expect(200);
    const body = res.body as AvailabilityResponseBody;
    expect(body.items).toHaveLength(1);
    expect(body.items[0].sizeName).toBe('M');
    expect(body.items[0].colorName).toBe('Beige');
  });

  it('respeta productos inactivos (is_available_for_sale=false)', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'E2E9 Pantalón Descontinuado' }),
    ).expect(200);
    const body = res.body as AvailabilityResponseBody;
    expect(body.items).toHaveLength(0);
  });

  it('el resumen refleja la búsqueda/categoría pero no el filtro de estado', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'E2E9 Blusa', status: 'AGOTADO' }),
    ).expect(200);
    const body = res.body as AvailabilityResponseBody;
    expect(body.items).toHaveLength(1); // solo agotados en la lista
    expect(body.summary.available).toBe(1);
    expect(body.summary.lowStock).toBe(1);
    expect(body.summary.outOfStock).toBe(1);
    expect(body.summary.products).toBe(1);
  });

  it('no expone información innecesaria (sin costos ni ids de inventario internos)', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/availability')
        .query({ search: 'E2E9 Blusa' }),
    ).expect(200);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('averageCost');
    expect(raw).not.toContain('unitCost');
  });

  describe('GET /availability/:productId', () => {
    it('devuelve el detalle de consulta con stock por variante', async () => {
      const res = await authed(
        request(app.getHttpServer()).get(`/availability/${productId}`),
      ).expect(200);
      const body = res.body as {
        name: string;
        code: string;
        salePrice: string;
        waistMeasurement: string | null;
        lengthMeasurement: string | null;
        variants: {
          sizeName: string;
          colorName: string;
          quantity: number;
          status: string;
        }[];
      };
      expect(body.code).toBe('E2E9-0001');
      expect(body.salePrice).toBe('120');
      expect(body.waistMeasurement).toBe('76');
      expect(body.lengthMeasurement).toBe('102');
      expect(body.variants).toHaveLength(3); // sin la desactivada
    });

    it('producto inexistente responde 404', () => {
      return authed(
        request(app.getHttpServer()).get('/availability/999999999'),
      ).expect(404);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .get(`/availability/${productId}`)
        .expect(401);
    });
  });
});
