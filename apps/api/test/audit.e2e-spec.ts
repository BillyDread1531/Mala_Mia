import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_audit_user';
const TEST_PASSWORD = 'e2e-test-password-Gg7!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
const TEST_NAME_PREFIX = 'E2E17A ';

interface ActivityEntryBody {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  userName: string;
  createdAt: string;
}

interface ActivityListBody {
  items: ActivityEntryBody[];
  total: number;
}

describe('Audit / Actividad (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: bigint;
  let supplierId: bigint;

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
        full_name: 'E2E Audit Tester',
        role_id: role.id,
        password_hash: passwordHash,
        is_active: true,
      },
    });
    userId = user.id;

    // Este login ya es, en sí mismo, la primera entrada de actividad a verificar.
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

    const supplier = await prisma.suppliers.create({
      data: { name: `${TEST_NAME_PREFIX}Proveedor` },
    });
    supplierId = supplier.id;
  });

  afterAll(async () => {
    await prisma.audit_logs.deleteMany({ where: { user_id: userId ?? 0n } });
    await prisma.suppliers.deleteMany({ where: { id: supplierId ?? 0n } });
    await prisma.users.deleteMany({ where: { id: userId ?? 0n } });
    await app.close();
  });

  it('sin sesión responde 401', () => {
    return request(app.getHttpServer()).get('/audit').expect(401);
  });

  it('el login queda registrado como actividad', async () => {
    const res = await authed(
      request(app.getHttpServer()).get('/audit').query({ pageSize: 50 }),
    ).expect(200);
    const body = res.body as ActivityListBody;
    const loginEntry = body.items.find(
      (i) => i.action === 'LOGIN' && i.entityId === userId.toString(),
    );
    expect(loginEntry).toBeDefined();
    expect(loginEntry!.description).toContain('inició sesión');
    expect(loginEntry!.userName).toBe('E2E Audit Tester');
  });

  it('editar un proveedor queda registrado y es consultable por acción', async () => {
    await authed(
      request(app.getHttpServer())
        .patch(`/suppliers/${supplierId}`)
        .send({ phone: '55512345' }),
    ).expect(200);

    const res = await authed(
      request(app.getHttpServer())
        .get('/audit')
        .query({ action: 'SUPPLIER_UPDATED', pageSize: 50 }),
    ).expect(200);
    const body = res.body as ActivityListBody;
    const entry = body.items.find((i) => i.entityId === supplierId.toString());
    expect(entry).toBeDefined();
    expect(entry!.action).toBe('SUPPLIER_UPDATED');
    expect(entry!.description).toContain(`${TEST_NAME_PREFIX}Proveedor`);

    // Filtrar por una acción distinta no debe traer esta entrada.
    const otherRes = await authed(
      request(app.getHttpServer())
        .get('/audit')
        .query({ action: 'LOGIN', pageSize: 50 }),
    ).expect(200);
    const otherBody = otherRes.body as ActivityListBody;
    expect(
      otherBody.items.some((i) => i.entityId === supplierId.toString()),
    ).toBe(false);
  });

  it('combina actividad financiera (ventas/compras) con la de auditoría, ordenada por fecha', async () => {
    const res = await authed(
      request(app.getHttpServer()).get('/audit').query({ pageSize: 50 }),
    ).expect(200);
    const body = res.body as ActivityListBody;
    expect(body.items.length).toBeGreaterThan(1);
    const dates = body.items.map((i) => new Date(i.createdAt).getTime());
    const sorted = [...dates].sort((a, b) => b - a);
    expect(dates).toEqual(sorted);
  });

  it('busca por texto en la descripción', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .get('/audit')
        .query({ search: TEST_NAME_PREFIX.trim(), pageSize: 50 }),
    ).expect(200);
    const body = res.body as ActivityListBody;
    expect(body.items.length).toBeGreaterThan(0);
    expect(
      body.items.every((i) => i.description.includes(TEST_NAME_PREFIX.trim())),
    ).toBe(true);
  });
});
