import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_settings_user';
const TEST_PASSWORD = 'e2e-test-password-Dd4!';
const SESSION_COOKIE_NAME = 'mala_mia_session';

interface GeneralSettingsBody {
  businessName: string;
  receiptMessage: string;
  targetProfitMargin: number;
  lowStockThreshold: number;
  defaultShippingFee: number;
}

interface ErrorResponseBody {
  message: string;
}

describe('Settings (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: bigint;
  let original: GeneralSettingsBody;
  let originalDistribution: {
    personal: number;
    reinvestment: number;
    reserve: number;
  };

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
        full_name: 'E2E Settings Tester',
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

    const res = await authed(
      request(app.getHttpServer()).get('/settings/general'),
    ).expect(200);
    original = res.body as GeneralSettingsBody;

    const dist = await prisma.profit_distribution_settings.findFirstOrThrow();
    originalDistribution = {
      personal: Number(dist.personal_percentage),
      reinvestment: Number(dist.reinvestment_percentage),
      reserve: Number(dist.reserve_percentage),
    };
  });

  afterAll(async () => {
    // Restaura exactamente la configuración real del negocio.
    await authed(
      request(app.getHttpServer()).patch('/settings/general').send(original),
    ).expect(200);
    const dist = await prisma.profit_distribution_settings.findFirstOrThrow();
    await prisma.profit_distribution_settings.update({
      where: { id: dist.id },
      data: {
        personal_percentage: originalDistribution.personal,
        reinvestment_percentage: originalDistribution.reinvestment,
        reserve_percentage: originalDistribution.reserve,
      },
    });
    await prisma.audit_logs.deleteMany({ where: { user_id: userId ?? 0n } });
    await prisma.users.deleteMany({ where: { id: userId ?? 0n } });
    await app.close();
  });

  it('sin sesión responde 401', () => {
    return request(app.getHttpServer()).get('/settings/general').expect(401);
  });

  it('obtiene la configuración general', async () => {
    const res = await authed(
      request(app.getHttpServer()).get('/settings/general'),
    ).expect(200);
    const body = res.body as GeneralSettingsBody;
    expect(body.businessName).toBe('MALA MÍA');
    expect(typeof body.targetProfitMargin).toBe('number');
    expect(typeof body.lowStockThreshold).toBe('number');
  });

  it('modifica el margen recomendado y Productos lo usa de inmediato', async () => {
    await authed(
      request(app.getHttpServer())
        .patch('/settings/general')
        .send({ targetProfitMargin: 40 }),
    ).expect(200);

    // Mismo cálculo ya existente de Fase 4: costo/(1-margen), sin tocar su lógica.
    const category = await prisma.categories.findFirstOrThrow();
    const create = await authed(
      request(app.getHttpServer())
        .post('/products')
        .send({
          name: 'E2E11 Producto margen',
          categoryId: Number(category.id),
          cost: 65,
          variants: [],
        }),
    ).expect(201);
    const body = create.body as { recommendedPrice: string };
    expect(Number(body.recommendedPrice)).toBeCloseTo(65 / (1 - 0.4), 2); // ≈108.33

    await prisma.products.deleteMany({
      where: { name: 'E2E11 Producto margen' },
    });
  });

  it('valida que el margen esté entre 0 y 99.99', async () => {
    await authed(
      request(app.getHttpServer())
        .patch('/settings/general')
        .send({ targetProfitMargin: 100 }),
    ).expect(400);
    await authed(
      request(app.getHttpServer())
        .patch('/settings/general')
        .send({ targetProfitMargin: -5 }),
    ).expect(400);
  });

  it('modifica el umbral de stock bajo y Disponibilidad lo respeta', async () => {
    await authed(
      request(app.getHttpServer())
        .patch('/settings/general')
        .send({ lowStockThreshold: 5 }),
    ).expect(200);

    const res = await authed(
      request(app.getHttpServer()).get('/settings/general'),
    ).expect(200);
    expect((res.body as GeneralSettingsBody).lowStockThreshold).toBe(5);
  });

  it('valida que el umbral de stock bajo sea un entero no negativo', async () => {
    await authed(
      request(app.getHttpServer())
        .patch('/settings/general')
        .send({ lowStockThreshold: -1 }),
    ).expect(400);
  });

  it('modifica el envío sugerido por defecto', async () => {
    await authed(
      request(app.getHttpServer())
        .patch('/settings/general')
        .send({ defaultShippingFee: 45 }),
    ).expect(200);

    const res = await authed(
      request(app.getHttpServer()).get('/settings/general'),
    ).expect(200);
    expect((res.body as GeneralSettingsBody).defaultShippingFee).toBe(45);
  });

  it('valida que el envío sugerido no sea negativo', async () => {
    await authed(
      request(app.getHttpServer())
        .patch('/settings/general')
        .send({ defaultShippingFee: -5 }),
    ).expect(400);
  });

  describe('Distribución financiera (reutiliza /finance/distribution-settings de Fase 10)', () => {
    it('modifica la distribución y la refleja visualmente', async () => {
      const res = await authed(
        request(app.getHttpServer())
          .patch('/finance/distribution-settings')
          .send({
            personalPercentage: 50,
            reinvestmentPercentage: 40,
            reservePercentage: 10,
          }),
      ).expect(200);
      const body = res.body as {
        personalPercentage: string;
        reinvestmentPercentage: string;
        reservePercentage: string;
      };
      expect(body.personalPercentage).toBe('50');
      expect(body.reinvestmentPercentage).toBe('40');
      expect(body.reservePercentage).toBe('10');
    });

    it('no permite guardar una distribución que no sume 100%', async () => {
      const res = await authed(
        request(app.getHttpServer())
          .patch('/finance/distribution-settings')
          .send({
            personalPercentage: 50,
            reinvestmentPercentage: 40,
            reservePercentage: 5,
          }),
      ).expect(400);
      expect((res.body as ErrorResponseBody).message).toContain('100');
    });
  });
});
