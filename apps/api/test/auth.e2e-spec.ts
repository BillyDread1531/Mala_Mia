import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_auth_user';
const TEST_PASSWORD = 'e2e-test-password-Aa1!';
const TEST_FULL_NAME = 'E2E Test User';
const SESSION_COOKIE_NAME = 'mala_mia_session';

interface AuthUserBody {
  id: string;
  username: string;
  fullName: string;
  role: string;
}

interface LoginResponseBody {
  user: AuthUserBody;
}

interface ErrorResponseBody {
  message: string;
}

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let testUserId: bigint;

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
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    const adminRole = await prisma.roles.findUniqueOrThrow({
      where: { name: 'ADMIN' },
    });
    const passwordHash = await argon2.hash(TEST_PASSWORD, {
      type: argon2.argon2id,
    });

    const testUser = await prisma.users.create({
      data: {
        username: TEST_USERNAME,
        full_name: TEST_FULL_NAME,
        role_id: adminRole.id,
        password_hash: passwordHash,
        is_active: true,
      },
    });
    testUserId = testUser.id;
  });

  afterAll(async () => {
    // onDelete: Cascade en user_sessions elimina también sus sesiones.
    await prisma.audit_logs.deleteMany({
      where: { user_id: testUserId ?? 0n },
    });
    await prisma.users
      .delete({ where: { id: testUserId } })
      .catch(() => undefined);
    await app.close();
  });

  function extractSessionCookie(res: request.Response): string {
    const rawCookies = res.get('set-cookie') as unknown as string[] | undefined;
    const cookie = rawCookies?.find((c) =>
      c.startsWith(`${SESSION_COOKIE_NAME}=`),
    );
    if (!cookie) {
      throw new Error('No se recibió la cookie de sesión');
    }
    return cookie.split(';')[0];
  }

  describe('POST /auth/login', () => {
    it('login válido devuelve el usuario y una cookie de sesión HttpOnly', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
        .expect(200);

      expect((res.body as LoginResponseBody).user).toEqual({
        id: testUserId.toString(),
        username: TEST_USERNAME,
        fullName: TEST_FULL_NAME,
        role: 'ADMIN',
      });

      const rawCookies = res.get('set-cookie') as unknown as
        string[] | undefined;
      const sessionCookie = rawCookies?.find((c) =>
        c.startsWith(`${SESSION_COOKIE_NAME}=`),
      );
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/HttpOnly/i);
    });

    it('password no aparece en la respuesta', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
        .expect(200);

      const bodyText = JSON.stringify(res.body);
      expect(bodyText).not.toContain(TEST_PASSWORD);
      expect(bodyText.toLowerCase()).not.toContain('password');
    });

    it('rechaza password incorrecta con mensaje genérico', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: TEST_USERNAME, password: 'password-incorrecta' })
        .expect(401);

      expect((res.body as ErrorResponseBody).message).toBe(
        'Usuario o contraseña incorrectos.',
      );
    });

    it('rechaza usuario inexistente con el mismo mensaje genérico', async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: 'usuario_que_no_existe', password: 'cualquier-cosa' })
        .expect(401);

      expect((res.body as ErrorResponseBody).message).toBe(
        'Usuario o contraseña incorrectos.',
      );
    });

    it('rechaza body inválido (username/password faltantes)', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({})
        .expect(400);
    });
  });

  describe('GET /auth/me', () => {
    it('sin sesión responde 401', () => {
      return request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('con una cookie inventada (no asociada a ninguna sesión real) responde 401', () => {
      return request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [`${SESSION_COOKIE_NAME}=token-que-nunca-existio`])
        .expect(401);
    });

    it('con sesión válida devuelve el usuario autenticado sin password_hash', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
        .expect(200);
      const cookie = extractSessionCookie(loginRes);

      const meRes = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [cookie])
        .expect(200);

      expect((meRes.body as LoginResponseBody).user).toEqual({
        id: testUserId.toString(),
        username: TEST_USERNAME,
        fullName: TEST_FULL_NAME,
        role: 'ADMIN',
      });
      const bodyText = JSON.stringify(meRes.body);
      expect(bodyText.toLowerCase()).not.toContain('password');
    });
  });

  describe('POST /auth/logout', () => {
    it('revoca la sesión: tras logout, /auth/me con la misma cookie responde 401', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: TEST_USERNAME, password: TEST_PASSWORD })
        .expect(200);
      const cookie = extractSessionCookie(loginRes);

      await request(app.getHttpServer())
        .post('/auth/logout')
        .set('Cookie', [cookie])
        .expect(200);

      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', [cookie])
        .expect(401);
    });

    it('sin sesión responde 401 (logout también está protegido)', () => {
      return request(app.getHttpServer()).post('/auth/logout').expect(401);
    });
  });
});
