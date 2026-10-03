import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_expenses_user';
const TEST_PASSWORD = 'e2e-test-password-Dd4!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
const TEST_DESC_PREFIX = 'E2E10X ';

interface ExpenseBody {
  id: string;
  category: { id: string; name: string };
  description: string;
  amount: string;
  paymentMethod: { id: string; name: string };
  status: string;
  notes: string | null;
}

interface ErrorResponseBody {
  message: string | string[];
}

describe('Expenses (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: bigint;
  let categoryId: bigint;
  let inactiveCategoryId: bigint;
  let efectivoId: bigint;
  let tarjetaVentaOnlyId: bigint | null;

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
        full_name: 'E2E Expenses Tester',
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

    efectivoId = (
      await prisma.payment_methods.findUniqueOrThrow({
        where: { name: 'Efectivo' },
      })
    ).id;

    const category = await prisma.expense_categories.findFirstOrThrow({
      where: { is_active: true },
    });
    categoryId = category.id;

    const inactiveCategory = await prisma.expense_categories.create({
      data: { name: `${TEST_DESC_PREFIX}Categoría inactiva`, is_active: false },
    });
    inactiveCategoryId = inactiveCategory.id;

    const cardOnly = await prisma.payment_methods.findFirst({
      where: { applies_to_expenses: false },
    });
    tarjetaVentaOnlyId = cardOnly?.id ?? null;
  });

  afterAll(async () => {
    const expenses = await prisma.expenses.findMany({
      where: { description: { startsWith: TEST_DESC_PREFIX } },
      select: { id: true },
    });
    const expenseIds = expenses.map((e) => e.id);
    await prisma.financial_movements.deleteMany({
      where: { reference_type: 'expense', reference_id: { in: expenseIds } },
    });
    await prisma.expenses.deleteMany({ where: { id: { in: expenseIds } } });
    await prisma.expense_categories.deleteMany({
      where: { id: inactiveCategoryId ?? 0n },
    });
    await prisma.audit_logs.deleteMany({ where: { user_id: userId ?? 0n } });
    await prisma.users.deleteMany({ where: { id: userId ?? 0n } });
    await app.close();
  });

  describe('POST /expenses', () => {
    it('crea un gasto y registra su movimiento financiero', async () => {
      const res = await authed(
        request(app.getHttpServer())
          .post('/expenses')
          .send({
            categoryId: Number(categoryId),
            description: `${TEST_DESC_PREFIX}Bolsas de papel`,
            amount: 50,
            paymentMethodId: Number(efectivoId),
          }),
      ).expect(201);
      const body = res.body as ExpenseBody;
      expect(body.amount).toBe('50');
      expect(body.status).toBe('COMPLETED');

      const movement = await prisma.financial_movements.findFirst({
        where: { reference_type: 'expense', reference_id: BigInt(body.id) },
      });
      expect(movement).not.toBeNull();
      expect(movement?.direction).toBe('OUT');
      expect(movement?.movement_type).toBe('EXPENSE');
      expect(Number(movement?.amount)).toBe(50);
    });

    it('valida que el monto sea positivo', async () => {
      await authed(
        request(app.getHttpServer())
          .post('/expenses')
          .send({
            categoryId: Number(categoryId),
            description: `${TEST_DESC_PREFIX}Monto inválido`,
            amount: 0,
            paymentMethodId: Number(efectivoId),
          }),
      ).expect(400);
    });

    it('valida que la categoría exista y esté activa', async () => {
      const resInactive = await authed(
        request(app.getHttpServer())
          .post('/expenses')
          .send({
            categoryId: Number(inactiveCategoryId),
            description: `${TEST_DESC_PREFIX}Categoría inactiva`,
            amount: 20,
            paymentMethodId: Number(efectivoId),
          }),
      ).expect(400);
      expect((resInactive.body as ErrorResponseBody).message).toContain(
        'categoría',
      );

      await authed(
        request(app.getHttpServer())
          .post('/expenses')
          .send({
            categoryId: 999999999,
            description: `${TEST_DESC_PREFIX}Categoría inexistente`,
            amount: 20,
            paymentMethodId: Number(efectivoId),
          }),
      ).expect(400);
    });

    it('valida que la forma de pago sea válida para gastos', async () => {
      if (!tarjetaVentaOnlyId) return; // no hay un método no-aplicable en este seed
      await authed(
        request(app.getHttpServer())
          .post('/expenses')
          .send({
            categoryId: Number(categoryId),
            description: `${TEST_DESC_PREFIX}Forma de pago inválida`,
            amount: 20,
            paymentMethodId: Number(tarjetaVentaOnlyId),
          }),
      ).expect(400);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .post('/expenses')
        .send({
          categoryId: 1,
          description: 'x',
          amount: 10,
          paymentMethodId: 1,
        })
        .expect(401);
    });
  });

  describe('PATCH /expenses/:id/void', () => {
    it('anula un gasto sin borrarlo y registra la reversión', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/expenses')
          .send({
            categoryId: Number(categoryId),
            description: `${TEST_DESC_PREFIX}Gasto a anular`,
            amount: 75,
            paymentMethodId: Number(efectivoId),
          }),
      ).expect(201);
      const id = (create.body as ExpenseBody).id;

      const voided = await authed(
        request(app.getHttpServer())
          .patch(`/expenses/${id}/void`)
          .send({ reason: 'Registrado por error' }),
      ).expect(200);
      expect((voided.body as ExpenseBody).status).toBe('VOIDED');

      // Mantiene trazabilidad: el gasto original sigue existiendo (no se borra).
      const stillThere = await prisma.expenses.findUniqueOrThrow({
        where: { id: BigInt(id) },
      });
      expect(stillThere.status).toBe('VOIDED');
      expect(Number(stillThere.amount)).toBe(75);

      const movements = await prisma.financial_movements.findMany({
        where: { reference_type: 'expense', reference_id: BigInt(id) },
        orderBy: { id: 'asc' },
      });
      expect(movements).toHaveLength(2); // EXPENSE original + EXPENSE_VOID
      expect(movements[0].movement_type).toBe('EXPENSE');
      expect(movements[0].direction).toBe('OUT');
      expect(movements[1].movement_type).toBe('EXPENSE_VOID');
      expect(movements[1].direction).toBe('IN');
      expect(Number(movements[1].amount)).toBe(75);
    });

    it('no permite anular un gasto ya anulado', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/expenses')
          .send({
            categoryId: Number(categoryId),
            description: `${TEST_DESC_PREFIX}Doble anulación`,
            amount: 10,
            paymentMethodId: Number(efectivoId),
          }),
      ).expect(201);
      const id = (create.body as ExpenseBody).id;

      await authed(
        request(app.getHttpServer()).patch(`/expenses/${id}/void`).send({}),
      ).expect(200);
      const res = await authed(
        request(app.getHttpServer()).patch(`/expenses/${id}/void`).send({}),
      ).expect(400);
      expect((res.body as ErrorResponseBody).message).toContain('anulado');
    });

    it('404 para un gasto inexistente', () => {
      return authed(
        request(app.getHttpServer()).patch('/expenses/999999999/void').send({}),
      ).expect(404);
    });
  });

  describe('GET /expenses', () => {
    it('lista y filtra por categoría', async () => {
      const res = await authed(
        request(app.getHttpServer())
          .get('/expenses')
          .query({ search: TEST_DESC_PREFIX, categoryId: Number(categoryId) }),
      ).expect(200);
      const body = res.body as { items: ExpenseBody[]; total: number };
      expect(body.items.length).toBeGreaterThan(0);
      expect(
        body.items.every((e) => e.category.id === String(categoryId)),
      ).toBe(true);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer()).get('/expenses').expect(401);
    });
  });
});
