import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_catalogadmin_user';
const TEST_PASSWORD = 'e2e-test-password-Dd4!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
const TEST_PREFIX = 'E2E11 ';

interface ErrorResponseBody {
  message: string;
}

describe('Catalog admin (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: bigint;

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
        full_name: 'E2E Catalog Admin Tester',
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
  });

  afterAll(async () => {
    await prisma.categories.deleteMany({
      where: { name: { startsWith: TEST_PREFIX } },
    });
    await prisma.sizes.deleteMany({
      where: { name: { startsWith: TEST_PREFIX } },
    });
    await prisma.colors.deleteMany({
      where: { name: { startsWith: TEST_PREFIX } },
    });
    await prisma.expense_categories.deleteMany({
      where: { name: { startsWith: TEST_PREFIX } },
    });
    await prisma.audit_logs.deleteMany({ where: { user_id: userId ?? 0n } });
    await prisma.users.deleteMany({ where: { id: userId ?? 0n } });
    await app.close();
  });

  describe('Categorías', () => {
    it('crea, lista (incl. inactivas) y desactiva/activa una categoría', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/categories')
          .send({ name: `${TEST_PREFIX}Accesorios` }),
      ).expect(201);
      const id = (create.body as { id: string }).id;

      const deactivated = await authed(
        request(app.getHttpServer())
          .patch(`/categories/${id}`)
          .send({ isActive: false }),
      ).expect(200);
      expect((deactivated.body as { isActive: boolean }).isActive).toBe(false);

      const activeList = await authed(
        request(app.getHttpServer()).get('/categories'),
      ).expect(200);
      expect(
        (activeList.body as { id: string }[]).some((c) => c.id === id),
      ).toBe(false); // ya no aparece en la lista "activas"

      const allList = await authed(
        request(app.getHttpServer()).get('/categories/all'),
      ).expect(200);
      expect((allList.body as { id: string }[]).some((c) => c.id === id)).toBe(
        true,
      ); // pero sigue existiendo

      await authed(
        request(app.getHttpServer())
          .patch(`/categories/${id}`)
          .send({ isActive: true }),
      ).expect(200);
    });

    it('rechaza una categoría duplicada', async () => {
      await authed(
        request(app.getHttpServer())
          .post('/categories')
          .send({ name: `${TEST_PREFIX}Duplicada` }),
      ).expect(201);
      const res = await authed(
        request(app.getHttpServer())
          .post('/categories')
          .send({ name: `${TEST_PREFIX}Duplicada` }),
      ).expect(409);
      expect((res.body as ErrorResponseBody).message).toContain('ya existe');
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer()).get('/categories/all').expect(401);
    });
  });

  describe('Tallas', () => {
    it('crea una talla y normaliza su nombre igual que los datos existentes', async () => {
      const res = await authed(
        request(app.getHttpServer())
          .post('/sizes')
          .send({ name: `${TEST_PREFIX}2XL` }),
      ).expect(201);
      const body = res.body as { id: string; normalizedName: string };
      expect(body.normalizedName).toBe(
        `${TEST_PREFIX}2XL`.trim().toUpperCase(),
      );

      await authed(
        request(app.getHttpServer())
          .patch(`/sizes/${body.id}`)
          .send({ isActive: false }),
      ).expect(200);
    });

    it('rechaza una talla duplicada por nombre normalizado (minúsculas/mayúsculas)', async () => {
      await authed(
        request(app.getHttpServer())
          .post('/sizes')
          .send({ name: `${TEST_PREFIX}3XL` }),
      ).expect(201);
      const res = await authed(
        request(app.getHttpServer())
          .post('/sizes')
          .send({ name: `${TEST_PREFIX}3xl`.toLowerCase() }),
      ).expect(409);
      expect((res.body as ErrorResponseBody).message).toContain('ya existe');
    });
  });

  describe('Colores', () => {
    it('crea un color y lo normaliza sin acentos (coherente con "Café" → "CAFE")', async () => {
      const res = await authed(
        request(app.getHttpServer())
          .post('/colors')
          .send({ name: `${TEST_PREFIX}Turquésa` }),
      ).expect(201);
      const body = res.body as { normalizedName: string };
      expect(body.normalizedName).not.toMatch(/[ÁÉÍÓÚáéíóú]/);
      expect(body.normalizedName).toContain('TURQUESA');
    });
  });

  describe('Métodos de pago', () => {
    it('lista todos (incl. inactivos) y puede activar/desactivar', async () => {
      const all = await authed(
        request(app.getHttpServer()).get('/payment-methods/all'),
      ).expect(200);
      const tarjeta = (
        all.body as { id: string; name: string; isActive: boolean }[]
      ).find((m) => m.name === 'Tarjeta');
      expect(tarjeta).toBeDefined();

      // Vuelve a dejarlo exactamente como estaba, por si ya estaba inactivo.
      const original = tarjeta!.isActive;
      const toggled = await authed(
        request(app.getHttpServer())
          .patch(`/payment-methods/${tarjeta!.id}`)
          .send({ isActive: !original }),
      ).expect(200);
      expect((toggled.body as { isActive: boolean }).isActive).toBe(!original);

      await authed(
        request(app.getHttpServer())
          .patch(`/payment-methods/${tarjeta!.id}`)
          .send({ isActive: original }),
      ).expect(200);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .get('/payment-methods/all')
        .expect(401);
    });
  });

  describe('Categorías de gastos', () => {
    it('crea, lista todas y desactiva una categoría de gasto', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/expense-categories')
          .send({ name: `${TEST_PREFIX}Capacitación` }),
      ).expect(201);
      const id = (create.body as { id: string }).id;

      await authed(
        request(app.getHttpServer())
          .patch(`/expense-categories/${id}`)
          .send({ isActive: false }),
      ).expect(200);

      const activeList = await authed(
        request(app.getHttpServer()).get('/expense-categories'),
      ).expect(200);
      expect(
        (activeList.body as { id: string }[]).some((c) => c.id === id),
      ).toBe(false);

      const allList = await authed(
        request(app.getHttpServer()).get('/expense-categories/all'),
      ).expect(200);
      expect((allList.body as { id: string }[]).some((c) => c.id === id)).toBe(
        true,
      );
    });
  });
});
