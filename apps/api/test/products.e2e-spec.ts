import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_products_user';
const TEST_PASSWORD = 'e2e-test-password-Bb2!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
/** Todo producto creado por este archivo debe usar este prefijo: es lo que
 * usa afterAll para limpiar, incluso si una aserción falla a medio test. */
const TEST_NAME_PREFIX = 'E2E ';

interface ProductViewBody {
  id: string;
  code: string;
  name: string;
  category: { id: string; name: string };
  cost: string | null;
  salePrice: string | null;
  recommendedPrice: string | null;
  waistMeasurement: string | null;
  lengthMeasurement: string | null;
  isAvailableForSale: boolean;
  variantCount: number;
  variants: {
    sizeId: string;
    sizeName: string;
    colorId: string;
    colorName: string;
  }[];
}

interface ListResponseBody {
  items: ProductViewBody[];
  total: number;
}

interface ErrorResponseBody {
  message: string;
}

describe('Products (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let blusasId: bigint;
  let sizeS: bigint;
  let sizeM: bigint;
  let sizeL: bigint;
  let colorBeige: bigint;
  let colorRojo: bigint;

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
    await prisma.users.create({
      data: {
        username: TEST_USERNAME,
        full_name: 'E2E Products Tester',
        role_id: role.id,
        password_hash: passwordHash,
        is_active: true,
      },
    });

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
    blusasId = category.id;
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
  });

  afterAll(async () => {
    // Barrido por prefijo (no por id): así queda limpio incluso si una
    // aserción falla antes de registrar el id creado, o si la respuesta
    // falla después de que la transacción ya escribió en la base.
    await prisma.products.deleteMany({
      where: { name: { startsWith: TEST_NAME_PREFIX } },
    });
    const testUser = await prisma.users.findUnique({
      where: { username: TEST_USERNAME },
    });
    if (testUser) {
      await prisma.audit_logs.deleteMany({ where: { user_id: testUser.id } });
    }
    await prisma.users.deleteMany({ where: { username: TEST_USERNAME } });
    await app.close();
  });

  function authed(req: request.Test): request.Test {
    return req.set('Cookie', [sessionCookie]);
  }

  describe('POST /products', () => {
    it('crea un producto con combinaciones talla+color y calcula el precio recomendado', async () => {
      const res = await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Blusa Satinada',
            categoryId: Number(blusasId),
            cost: 65,
            salePrice: 125,
            variants: [
              { sizeId: Number(sizeS), colorId: Number(colorBeige) },
              { sizeId: Number(sizeM), colorId: Number(colorBeige) },
              { sizeId: Number(sizeL), colorId: Number(colorBeige) },
              { sizeId: Number(sizeS), colorId: Number(colorRojo) },
            ],
          }),
      ).expect(201);

      const body = res.body as ProductViewBody;

      expect(body.code).toMatch(/^BLU-\d{4}$/);
      expect(body.cost).toBe('65');
      expect(body.salePrice).toBe('125');
      expect(body.recommendedPrice).toBe('100'); // 65 / (1 - 0.35)
      expect(body.variantCount).toBe(4);
      expect(body.category).toEqual({
        id: blusasId.toString(),
        name: 'Blusas',
      });
    });

    it('crear un producto NO crea filas en inventory_items', async () => {
      const beforeCount = await prisma.inventory_items.count();

      await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Producto Sin Inventario',
            categoryId: Number(blusasId),
            variants: [{ sizeId: Number(sizeS), colorId: Number(colorBeige) }],
          }),
      ).expect(201);

      const afterCount = await prisma.inventory_items.count();
      expect(afterCount).toBe(beforeCount);
    });

    it('rechaza un código duplicado', async () => {
      const first = await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Producto Uno',
            categoryId: Number(blusasId),
            variants: [],
          }),
      ).expect(201);

      const res = await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Producto Dos',
            categoryId: Number(blusasId),
            code: (first.body as ProductViewBody).code,
            variants: [],
          }),
      ).expect(409);

      expect((res.body as ErrorResponseBody).message).toContain(
        'ya está en uso',
      );
    });

    it('rechaza datos inválidos (sin nombre, categoría inexistente)', async () => {
      await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({ categoryId: Number(blusasId), variants: [] }),
      ).expect(400);

      await authed(
        request(app.getHttpServer()).post('/products').send({
          name: 'Producto Categoria Falsa',
          categoryId: 999999,
          variants: [],
        }),
      ).expect(400);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .post('/products')
        .send({
          name: 'No Autenticado',
          categoryId: Number(blusasId),
          variants: [],
        })
        .expect(401);
    });
  });

  describe('GET /products', () => {
    it('lista y busca productos por nombre parcial', async () => {
      await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Vestido Floreado',
            categoryId: Number(blusasId),
            variants: [],
          }),
      ).expect(201);

      const res = await authed(
        request(app.getHttpServer())
          .get('/products')
          .query({ search: 'Floreado' }),
      ).expect(200);

      const body = res.body as ListResponseBody;
      expect(body.items.some((p) => p.name === 'E2E Vestido Floreado')).toBe(
        true,
      );
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer()).get('/products').expect(401);
    });

    it('por defecto excluye productos inactivos; includeInactive=true los incluye', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Producto Inactivo',
            categoryId: Number(blusasId),
            variants: [],
          }),
      ).expect(201);
      const id = (create.body as ProductViewBody).id;

      await authed(
        request(app.getHttpServer())
          .patch(`/products/${id}/active`)
          .send({ isActive: false }),
      ).expect(200);

      const defaultList = await authed(
        request(app.getHttpServer())
          .get('/products')
          .query({ search: 'E2E Producto Inactivo' }),
      ).expect(200);
      expect(
        (defaultList.body as ListResponseBody).items.some((p) => p.id === id),
      ).toBe(false);

      const fullList = await authed(
        request(app.getHttpServer())
          .get('/products')
          .query({ search: 'E2E Producto Inactivo', includeInactive: 'true' }),
      ).expect(200);
      const found = (fullList.body as ListResponseBody).items.find(
        (p) => p.id === id,
      );
      expect(found).toBeDefined();
      expect(found?.isAvailableForSale).toBe(false);
    });
  });

  describe('PATCH /products/:id/active', () => {
    it('desactiva y reactiva un producto', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Producto Activable',
            categoryId: Number(blusasId),
            variants: [],
          }),
      ).expect(201);
      const id = (create.body as ProductViewBody).id;

      const deactivated = await authed(
        request(app.getHttpServer())
          .patch(`/products/${id}/active`)
          .send({ isActive: false }),
      ).expect(200);
      expect((deactivated.body as ProductViewBody).isAvailableForSale).toBe(
        false,
      );

      const reactivated = await authed(
        request(app.getHttpServer())
          .patch(`/products/${id}/active`)
          .send({ isActive: true }),
      ).expect(200);
      expect((reactivated.body as ProductViewBody).isAvailableForSale).toBe(
        true,
      );
    });

    it('producto inexistente responde 404', () => {
      return authed(
        request(app.getHttpServer())
          .patch('/products/999999999/active')
          .send({ isActive: false }),
      ).expect(404);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .patch('/products/1/active')
        .send({ isActive: false })
        .expect(401);
    });
  });

  describe('GET /products/:id', () => {
    it('consulta el detalle de un producto existente', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Detalle Producto',
            categoryId: Number(blusasId),
            variants: [],
          }),
      ).expect(201);
      const id = (create.body as ProductViewBody).id;

      const res = await authed(
        request(app.getHttpServer()).get(`/products/${id}`),
      ).expect(200);
      expect((res.body as ProductViewBody).name).toBe('E2E Detalle Producto');
    });

    it('producto inexistente responde 404', () => {
      return authed(
        request(app.getHttpServer()).get('/products/999999999'),
      ).expect(404);
    });
  });

  describe('PATCH /products/:id', () => {
    it('edita nombre, costo y combinaciones sin perder el producto', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Producto Editable',
            categoryId: Number(blusasId),
            cost: 50,
            variants: [{ sizeId: Number(sizeS), colorId: Number(colorBeige) }],
          }),
      ).expect(201);
      const id = (create.body as ProductViewBody).id;

      const res = await authed(
        request(app.getHttpServer())
          .patch(`/products/${id}`)
          .send({
            name: 'E2E Producto Editado',
            cost: 80,
            variants: [
              { sizeId: Number(sizeS), colorId: Number(colorBeige) },
              { sizeId: Number(sizeM), colorId: Number(colorRojo) },
            ],
          }),
      ).expect(200);

      const body = res.body as ProductViewBody;
      expect(body.name).toBe('E2E Producto Editado');
      expect(body.cost).toBe('80');
      expect(body.variantCount).toBe(2);
    });

    it('guarda y luego borra medidas de cintura/largo (pantalones)', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Pantalón con Medidas',
            categoryId: Number(blusasId),
            waistMeasurement: 76,
            lengthMeasurement: 102,
            variants: [],
          }),
      ).expect(201);
      const created = create.body as ProductViewBody;
      expect(created.waistMeasurement).toBe('76');
      expect(created.lengthMeasurement).toBe('102');

      const updated = await authed(
        request(app.getHttpServer())
          .patch(`/products/${created.id}`)
          .send({ waistMeasurement: 80 }),
      ).expect(200);
      const updatedBody = updated.body as ProductViewBody;
      expect(updatedBody.waistMeasurement).toBe('80');
      expect(updatedBody.lengthMeasurement).toBe('102'); // sin cambios

      const cleared = await authed(
        request(app.getHttpServer())
          .patch(`/products/${created.id}`)
          .send({ waistMeasurement: null, lengthMeasurement: null }),
      ).expect(200);
      const clearedBody = cleared.body as ProductViewBody;
      expect(clearedBody.waistMeasurement).toBeNull();
      expect(clearedBody.lengthMeasurement).toBeNull();
    });

    it('al desmarcar una combinación, la desactiva en vez de borrarla (preserva historial)', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Producto Combo Historial',
            categoryId: Number(blusasId),
            variants: [
              { sizeId: Number(sizeS), colorId: Number(colorBeige) },
              { sizeId: Number(sizeM), colorId: Number(colorRojo) },
            ],
          }),
      ).expect(201);
      const id = (create.body as ProductViewBody).id;
      const beforeRow = await prisma.product_variants.findFirstOrThrow({
        where: {
          product_id: BigInt(id),
          size_id: sizeM,
          color_id: colorRojo,
        },
      });

      // Desmarca M/Rojo (solo deja S/Beige).
      const afterDisable = await authed(
        request(app.getHttpServer())
          .patch(`/products/${id}`)
          .send({
            variants: [{ sizeId: Number(sizeS), colorId: Number(colorBeige) }],
          }),
      ).expect(200);

      const bodyDisabled = afterDisable.body as ProductViewBody;
      expect(bodyDisabled.variantCount).toBe(1);
      expect(
        bodyDisabled.variants.some(
          (v) => v.sizeId === String(sizeM) && v.colorId === String(colorRojo),
        ),
      ).toBe(false); // desaparece como combinación activa

      const disabledRow = await prisma.product_variants.findUnique({
        where: { id: beforeRow.id },
      });
      expect(disabledRow).not.toBeNull(); // nunca se borra
      expect(disabledRow?.is_active).toBe(false);

      // Vuelve a marcarla: debe reactivar la MISMA fila, no crear una nueva.
      const afterReenable = await authed(
        request(app.getHttpServer())
          .patch(`/products/${id}`)
          .send({
            variants: [
              { sizeId: Number(sizeS), colorId: Number(colorBeige) },
              { sizeId: Number(sizeM), colorId: Number(colorRojo) },
            ],
          }),
      ).expect(200);

      const bodyReenabled = afterReenable.body as ProductViewBody;
      expect(bodyReenabled.variantCount).toBe(2);
      const reenabledRow = await prisma.product_variants.findUnique({
        where: { id: beforeRow.id },
      });
      expect(reenabledRow?.is_active).toBe(true);
      expect(reenabledRow?.id).toBe(beforeRow.id); // misma fila reutilizada
    });
  });

  describe('PATCH /products/:id/variants', () => {
    it('agrega una combinación nueva sin tocar las que ya existían', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Producto Agregar Variantes',
            categoryId: Number(blusasId),
            variants: [{ sizeId: Number(sizeS), colorId: Number(colorBeige) }],
          }),
      ).expect(201);
      const id = (create.body as ProductViewBody).id;

      const res = await authed(
        request(app.getHttpServer())
          .patch(`/products/${id}/variants`)
          .send({
            variants: [{ sizeId: Number(sizeM), colorId: Number(colorRojo) }],
          }),
      ).expect(200);

      const body = res.body as ProductViewBody;
      expect(body.variantCount).toBe(2);
      expect(
        body.variants.some(
          (v) => v.sizeId === String(sizeS) && v.colorId === String(colorBeige),
        ),
      ).toBe(true);
      expect(
        body.variants.some(
          (v) => v.sizeId === String(sizeM) && v.colorId === String(colorRojo),
        ),
      ).toBe(true);
    });

    it('funciona en un producto creado sin ninguna combinación', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Producto Sin Variantes',
            categoryId: Number(blusasId),
            variants: [],
          }),
      ).expect(201);
      const id = (create.body as ProductViewBody).id;
      expect((create.body as ProductViewBody).variantCount).toBe(0);

      const res = await authed(
        request(app.getHttpServer())
          .patch(`/products/${id}/variants`)
          .send({
            variants: [{ sizeId: Number(sizeS), colorId: Number(colorBeige) }],
          }),
      ).expect(200);

      expect((res.body as ProductViewBody).variantCount).toBe(1);
    });

    it('reactiva una combinación previamente desactivada en vez de duplicarla', async () => {
      const create = await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Producto Reactivar Variante',
            categoryId: Number(blusasId),
            variants: [{ sizeId: Number(sizeS), colorId: Number(colorBeige) }],
          }),
      ).expect(201);
      const id = (create.body as ProductViewBody).id;

      await authed(
        request(app.getHttpServer())
          .patch(`/products/${id}`)
          .send({ variants: [] }),
      ).expect(200);
      const deactivated = await prisma.product_variants.findFirstOrThrow({
        where: { product_id: BigInt(id) },
      });
      expect(deactivated.is_active).toBe(false);

      await authed(
        request(app.getHttpServer())
          .patch(`/products/${id}/variants`)
          .send({
            variants: [{ sizeId: Number(sizeS), colorId: Number(colorBeige) }],
          }),
      ).expect(200);

      const reactivated = await prisma.product_variants.findUnique({
        where: { id: deactivated.id },
      });
      expect(reactivated?.is_active).toBe(true);
      expect(reactivated?.id).toBe(deactivated.id);
    });

    it('producto inexistente responde 404', () => {
      return authed(
        request(app.getHttpServer())
          .patch('/products/999999999/variants')
          .send({ variants: [{ sizeId: 1, colorId: 1 }] }),
      ).expect(404);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .patch('/products/1/variants')
        .send({ variants: [{ sizeId: 1, colorId: 1 }] })
        .expect(401);
    });
  });

  describe('GET /products/check-duplicates', () => {
    it('encuentra coincidencias por nombre parcial/tokenizado', async () => {
      await authed(
        request(app.getHttpServer())
          .post('/products')
          .send({
            name: 'E2E Blusa Satinada Especial',
            categoryId: Number(blusasId),
            variants: [],
          }),
      ).expect(201);

      const res = await authed(
        request(app.getHttpServer())
          .get('/products/check-duplicates')
          .query({ q: 'blusa satinada' }),
      ).expect(200);

      const body = res.body as ProductViewBody[];
      expect(body.some((p) => p.name === 'E2E Blusa Satinada Especial')).toBe(
        true,
      );
    });
  });

  describe('GET /products/generate-code', () => {
    it('genera un código con el prefijo de la categoría', async () => {
      const res = await authed(
        request(app.getHttpServer())
          .get('/products/generate-code')
          .query({ categoryId: Number(blusasId) }),
      ).expect(200);

      expect((res.body as { code: string }).code).toMatch(/^BLU-\d{4}$/);
    });
  });

  describe('GET /products/recommended-price', () => {
    it('calcula el precio recomendado con el margen configurado (35%)', async () => {
      const res = await authed(
        request(app.getHttpServer())
          .get('/products/recommended-price')
          .query({ cost: 65 }),
      ).expect(200);

      expect((res.body as { recommendedPrice: string }).recommendedPrice).toBe(
        '100',
      );
    });
  });
});
