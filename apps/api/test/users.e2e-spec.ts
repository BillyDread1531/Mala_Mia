import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_users_admin';
const TEST_PASSWORD = 'e2e-test-password-Dd4!';
const OTHER_USERNAME = 'e2e_test_users_other';
const OTHER_PASSWORD = 'e2e-test-password-Ee5!';
const SESSION_COOKIE_NAME = 'mala_mia_session';

interface UserBody {
  id: string;
  username: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

interface ErrorResponseBody {
  message: string;
}

describe('Users (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: bigint;
  let otherUserId: bigint;

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
        full_name: 'E2E Users Tester',
        role_id: role.id,
        password_hash: passwordHash,
        is_active: true,
      },
    });
    userId = user.id;

    const otherHash = await argon2.hash(OTHER_PASSWORD, {
      type: argon2.argon2id,
    });
    const other = await prisma.users.create({
      data: {
        username: OTHER_USERNAME,
        full_name: 'E2E Users Other',
        role_id: role.id,
        password_hash: otherHash,
        is_active: true,
      },
    });
    otherUserId = other.id;

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
    const ids = [userId, otherUserId].filter(
      (id): id is bigint => id !== undefined,
    );
    await prisma.audit_logs.deleteMany({ where: { user_id: { in: ids } } });
    await prisma.users.deleteMany({ where: { id: { in: ids } } });
    await app.close();
  });

  it('sin sesión responde 401', () => {
    return request(app.getHttpServer()).get('/users').expect(401);
  });

  it('lista los usuarios sin exponer el hash de contraseña', async () => {
    const res = await authed(request(app.getHttpServer()).get('/users')).expect(
      200,
    );
    const users = res.body as UserBody[];
    expect(users.some((u) => u.username === TEST_USERNAME)).toBe(true);
    expect(JSON.stringify(users)).not.toContain('password_hash');
    expect(JSON.stringify(users)).not.toContain('argon2');
  });

  it('desactiva y reactiva a otro usuario', async () => {
    const deactivated = await authed(
      request(app.getHttpServer())
        .patch(`/users/${otherUserId}`)
        .send({ isActive: false }),
    ).expect(200);
    expect((deactivated.body as UserBody).isActive).toBe(false);

    // Un usuario desactivado no puede iniciar sesión (reutiliza la lógica de Auth ya existente).
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: OTHER_USERNAME, password: OTHER_PASSWORD })
      .expect(401);

    const reactivated = await authed(
      request(app.getHttpServer())
        .patch(`/users/${otherUserId}`)
        .send({ isActive: true }),
    ).expect(200);
    expect((reactivated.body as UserBody).isActive).toBe(true);
  });

  it('no permite que un usuario se desactive a sí mismo', async () => {
    const res = await authed(
      request(app.getHttpServer())
        .patch(`/users/${userId}`)
        .send({ isActive: false }),
    ).expect(400);
    expect((res.body as ErrorResponseBody).message).toContain('propia cuenta');
  });

  it('404 para un usuario inexistente', () => {
    return authed(
      request(app.getHttpServer())
        .patch('/users/999999999')
        .send({ isActive: false }),
    ).expect(404);
  });

  describe('PATCH /auth/password', () => {
    it('cambia la contraseña del usuario autenticado', async () => {
      await authed(
        request(app.getHttpServer()).patch('/auth/password').send({
          currentPassword: TEST_PASSWORD,
          newPassword: 'nueva-password-Ff6!',
        }),
      ).expect(200);

      // La sesión anterior puede seguir vigente, pero la contraseña real cambió.
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ username: TEST_USERNAME, password: 'nueva-password-Ff6!' })
        .expect(200);

      // Revertir para no afectar corridas futuras de este mismo archivo.
      await authed(
        request(app.getHttpServer()).patch('/auth/password').send({
          currentPassword: 'nueva-password-Ff6!',
          newPassword: TEST_PASSWORD,
        }),
      ).expect(200);
    });

    it('rechaza la contraseña actual incorrecta', async () => {
      const res = await authed(
        request(app.getHttpServer()).patch('/auth/password').send({
          currentPassword: 'incorrecta',
          newPassword: 'otra-password-Gg7!',
        }),
      ).expect(400);
      expect((res.body as ErrorResponseBody).message).toContain('actual');
    });

    it('valida la longitud mínima de la nueva contraseña', async () => {
      await authed(
        request(app.getHttpServer())
          .patch('/auth/password')
          .send({ currentPassword: TEST_PASSWORD, newPassword: '123' }),
      ).expect(400);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .patch('/auth/password')
        .send({ currentPassword: 'x', newPassword: 'y12345678' })
        .expect(401);
    });
  });
});
