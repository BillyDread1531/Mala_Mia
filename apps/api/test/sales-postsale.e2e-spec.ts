import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as argon2 from 'argon2';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { BigIntInterceptor } from './../src/common/interceptors/bigint.interceptor';
import { PrismaService } from './../src/prisma/prisma.service';

const TEST_USERNAME = 'e2e_test_postsale_user';
const TEST_PASSWORD = 'e2e-test-password-Dd4!';
const SESSION_COOKIE_NAME = 'mala_mia_session';
const TEST_NAME_PREFIX = 'E2E8 ';

interface SaleBody {
  id: string;
  status: string;
  total: string;
  totalRefunded: string;
  netTotal: string;
  items: { id: string; quantity: number; unitSalePrice: string }[];
}

interface ErrorResponseBody {
  message: string;
}

describe('Sales — correcciones, devoluciones, cambios y cancelación (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let sessionCookie: string;
  let userId: bigint;
  let supplierId: bigint;
  let efectivoId: bigint;

  let productId: bigint;
  let sizeM: bigint;
  let sizeL: bigint;
  let colorBeige: bigint;
  let colorRojo: bigint;
  let invMBeige: bigint;
  let invLBeige: bigint;
  let invMRojo: bigint;
  let invLRojo: bigint;

  let productCaroId: bigint;
  let invCaro: bigint;
  let productBaratoId: bigint;
  let invBarato: bigint;

  function authed(req: request.Test): request.Test {
    return req.set('Cookie', [sessionCookie]);
  }

  async function purchase(
    pId: bigint,
    sId: bigint,
    cId: bigint,
    quantity: number,
    unitCost: number,
  ) {
    await authed(
      request(app.getHttpServer())
        .post('/purchases')
        .send({
          supplierId: Number(supplierId),
          paymentMethodId: Number(efectivoId),
          items: [
            {
              productId: Number(pId),
              sizeId: Number(sId),
              colorId: Number(cId),
              quantity,
              unitCost,
            },
          ],
        }),
    ).expect(201);
  }

  async function inventoryItemId(
    pId: bigint,
    sId: bigint,
    cId: bigint,
  ): Promise<bigint> {
    const item = await prisma.inventory_items.findUniqueOrThrow({
      where: {
        product_id_size_id_color_id: {
          product_id: pId,
          size_id: sId,
          color_id: cId,
        },
      },
    });
    return item.id;
  }

  async function stockQty(id: bigint): Promise<number> {
    const item = await prisma.inventory_items.findUniqueOrThrow({
      where: { id },
    });
    return item.quantity;
  }

  async function createSale(
    items: {
      inventoryItemId: bigint;
      quantity: number;
      unitSalePrice: number;
    }[],
  ): Promise<SaleBody> {
    const res = await authed(
      request(app.getHttpServer())
        .post('/sales')
        .send({
          paymentMethodId: Number(efectivoId),
          items: items.map((i) => ({
            inventoryItemId: Number(i.inventoryItemId),
            quantity: i.quantity,
            unitSalePrice: i.unitSalePrice,
          })),
        }),
    ).expect(201);
    return res.body as SaleBody;
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
        full_name: 'E2E Postsale Tester',
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
    efectivoId = (
      await prisma.payment_methods.findUniqueOrThrow({
        where: { name: 'Efectivo' },
      })
    ).id;

    const supplier = await prisma.suppliers.create({
      data: { name: `${TEST_NAME_PREFIX}Boutique` },
    });
    supplierId = supplier.id;

    const product = await prisma.products.create({
      data: {
        category_id: category.id,
        code: 'E2E8-0001',
        name: `${TEST_NAME_PREFIX}Blusa`,
        sale_price: 100,
      },
    });
    productId = product.id;
    await prisma.product_variants.createMany({
      data: [
        { product_id: productId, size_id: sizeM, color_id: colorBeige },
        { product_id: productId, size_id: sizeL, color_id: colorBeige },
        { product_id: productId, size_id: sizeM, color_id: colorRojo },
        { product_id: productId, size_id: sizeL, color_id: colorRojo },
      ],
    });
    await purchase(productId, sizeM, colorBeige, 20, 60);
    await purchase(productId, sizeL, colorBeige, 10, 60);
    await purchase(productId, sizeM, colorRojo, 10, 60);
    await purchase(productId, sizeL, colorRojo, 2, 60);

    invMBeige = await inventoryItemId(productId, sizeM, colorBeige);
    invLBeige = await inventoryItemId(productId, sizeL, colorBeige);
    invMRojo = await inventoryItemId(productId, sizeM, colorRojo);
    invLRojo = await inventoryItemId(productId, sizeL, colorRojo);

    const productCaro = await prisma.products.create({
      data: {
        category_id: category.id,
        code: 'E2E8-0002',
        name: `${TEST_NAME_PREFIX}Producto Caro`,
        sale_price: 150,
      },
    });
    productCaroId = productCaro.id;
    await prisma.product_variants.create({
      data: { product_id: productCaroId, size_id: sizeM, color_id: colorBeige },
    });
    await purchase(productCaroId, sizeM, colorBeige, 5, 90);
    invCaro = await inventoryItemId(productCaroId, sizeM, colorBeige);

    const productBarato = await prisma.products.create({
      data: {
        category_id: category.id,
        code: 'E2E8-0003',
        name: `${TEST_NAME_PREFIX}Producto Barato`,
        sale_price: 80,
      },
    });
    productBaratoId = productBarato.id;
    await prisma.product_variants.create({
      data: {
        product_id: productBaratoId,
        size_id: sizeM,
        color_id: colorBeige,
      },
    });
    await purchase(productBaratoId, sizeM, colorBeige, 5, 40);
    invBarato = await inventoryItemId(productBaratoId, sizeM, colorBeige);
  });

  afterAll(async () => {
    const products = await prisma.products.findMany({
      where: { name: { startsWith: TEST_NAME_PREFIX } },
      select: { id: true },
    });
    const productIds = products.map((p) => p.id);
    const inventoryItems = await prisma.inventory_items.findMany({
      where: { product_id: { in: productIds } },
      select: { id: true },
    });
    const inventoryIds = inventoryItems.map((i) => i.id);
    const saleItems = await prisma.sale_items.findMany({
      where: { inventory_item_id: { in: inventoryIds } },
      select: { id: true, sale_id: true },
    });
    const saleIds = [...new Set(saleItems.map((s) => s.sale_id))];
    const saleItemIds = saleItems.map((s) => s.id);

    await prisma.sale_corrections.deleteMany({
      where: { sale_item_id: { in: saleItemIds } },
    });
    await prisma.return_items.deleteMany({
      where: { sale_item_id: { in: saleItemIds } },
    });
    await prisma.returns.deleteMany({ where: { sale_id: { in: saleIds } } });
    await prisma.exchange_items.deleteMany({
      where: { inventory_item_id: { in: inventoryIds } },
    });
    await prisma.exchanges.deleteMany({
      where: { original_sale_id: { in: saleIds } },
    });
    await prisma.inventory_movements.deleteMany({
      where: { inventory_item_id: { in: inventoryIds } },
    });
    await prisma.receipts.deleteMany({ where: { sale_id: { in: saleIds } } });
    await prisma.sale_items.deleteMany({ where: { sale_id: { in: saleIds } } });
    await prisma.sales.deleteMany({ where: { id: { in: saleIds } } });
    await prisma.inventory_items.deleteMany({
      where: { id: { in: inventoryIds } },
    });

    const purchases = await prisma.purchases.findMany({
      where: { suppliers: { name: { startsWith: TEST_NAME_PREFIX } } },
      select: { id: true },
    });
    const purchaseIds = purchases.map((p) => p.id);
    await prisma.purchase_items.deleteMany({
      where: { purchase_id: { in: purchaseIds } },
    });
    await prisma.purchases.deleteMany({ where: { id: { in: purchaseIds } } });

    await prisma.product_variants.deleteMany({
      where: { product_id: { in: productIds } },
    });
    await prisma.products.deleteMany({ where: { id: { in: productIds } } });
    await prisma.suppliers.deleteMany({
      where: { name: { startsWith: TEST_NAME_PREFIX } },
    });
    await prisma.financial_movements.deleteMany({
      where: { created_by: userId ?? 0n },
    });
    await prisma.audit_logs.deleteMany({ where: { user_id: userId ?? 0n } });
    await prisma.users.deleteMany({ where: { id: userId ?? 0n } });
    await app.close();
  });

  describe('Cancelación', () => {
    it('cancela una venta completa y reintegra el inventario', async () => {
      const before = await stockQty(invMBeige);
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 2, unitSalePrice: 100 },
      ]);

      const res = await authed(
        request(app.getHttpServer()).post(`/sales/${sale.id}/cancel`).send({}),
      ).expect(201);
      expect((res.body as SaleBody).status).toBe('CANCELLED');

      const after = await stockQty(invMBeige);
      expect(after).toBe(before); // salió 2 y volvieron 2: neto sin cambio

      const movements = await prisma.inventory_movements.findMany({
        where: {
          reference_type: 'cancellation',
          reference_id: BigInt(sale.id),
        },
      });
      expect(movements).toHaveLength(1);
      expect(movements[0].movement_type).toBe('ENTRADA');
      expect(movements[0].quantity).toBe(2);
    });

    it('no permite cancelar una venta ya cancelada', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 1, unitSalePrice: 100 },
      ]);
      await authed(
        request(app.getHttpServer()).post(`/sales/${sale.id}/cancel`).send({}),
      ).expect(201);

      const res = await authed(
        request(app.getHttpServer()).post(`/sales/${sale.id}/cancel`).send({}),
      ).expect(400);
      expect((res.body as ErrorResponseBody).message).toContain('completada');
    });

    it('404 al cancelar una venta inexistente', () => {
      return authed(
        request(app.getHttpServer()).post('/sales/999999999/cancel').send({}),
      ).expect(404);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .post('/sales/1/cancel')
        .send({})
        .expect(401);
    });
  });

  describe('Devoluciones', () => {
    it('devuelve una unidad y disminuye el saldo vendido', async () => {
      const before = await stockQty(invMBeige);
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 3, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      const res = await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/returns`)
          .send({
            reason: 'Talla incorrecta',
            items: [
              {
                saleItemId: Number(saleItemId),
                quantity: 1,
                conditionStatus: 'SALEABLE',
              },
            ],
          }),
      ).expect(201);
      expect((res.body as SaleBody).status).toBe('PARTIALLY_RETURNED');

      const after = await stockQty(invMBeige);
      expect(after).toBe(before - 3 + 1);
    });

    it('el detalle de la venta refleja el total neto después de una devolución parcial', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 3, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/returns`)
          .send({
            reason: 'Talla incorrecta',
            items: [
              {
                saleItemId: Number(saleItemId),
                quantity: 1,
                conditionStatus: 'SALEABLE',
              },
            ],
          }),
      ).expect(201);

      const detail = await authed(
        request(app.getHttpServer()).get(`/sales/${sale.id}`),
      ).expect(200);
      const body = detail.body as SaleBody;

      expect(body.total).toBe('300');
      expect(body.totalRefunded).toBe('100');
      expect(body.netTotal).toBe('200');
    });

    it('devuelve completamente una venta y queda en estado DEVUELTA', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 2, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      const res = await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/returns`)
          .send({
            reason: 'Producto defectuoso',
            items: [
              {
                saleItemId: Number(saleItemId),
                quantity: 2,
                conditionStatus: 'DAMAGED',
              },
            ],
          }),
      ).expect(201);
      expect((res.body as SaleBody).status).toBe('RETURNED');
    });

    it('calcula el reembolso con el precio realmente vendido, no el de catálogo', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 2, unitSalePrice: 90 },
      ]); // regateo: 100 -> 90
      const saleItemId = sale.items[0].id;

      await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/returns`)
          .send({
            reason: 'Cambio de opinión',
            items: [
              {
                saleItemId: Number(saleItemId),
                quantity: 1,
                conditionStatus: 'SALEABLE',
              },
            ],
          }),
      ).expect(201);

      const ret = await prisma.returns.findFirst({
        where: { sale_id: BigInt(sale.id) },
        orderBy: { id: 'desc' },
      });
      expect(Number(ret?.refund_amount)).toBe(90); // 1 unidad x Q90, nunca Q100
    });

    it('no permite devolver más de lo vendido (acumulado)', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 3, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/returns`)
          .send({
            reason: 'Talla incorrecta',
            items: [
              {
                saleItemId: Number(saleItemId),
                quantity: 2,
                conditionStatus: 'SALEABLE',
              },
            ],
          }),
      ).expect(201);

      const res = await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/returns`)
          .send({
            reason: 'Talla incorrecta',
            items: [
              {
                saleItemId: Number(saleItemId),
                quantity: 2,
                conditionStatus: 'SALEABLE',
              },
            ],
          }),
      ).expect(400);
      expect((res.body as ErrorResponseBody).message).toContain(
        'disponible: 1',
      );
    });

    it('404 para venta inexistente', () => {
      return authed(
        request(app.getHttpServer())
          .post('/sales/999999999/returns')
          .send({
            reason: 'Otro',
            items: [
              { saleItemId: 1, quantity: 1, conditionStatus: 'SALEABLE' },
            ],
          }),
      ).expect(404);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .post('/sales/1/returns')
        .send({
          reason: 'Otro',
          items: [{ saleItemId: 1, quantity: 1, conditionStatus: 'SALEABLE' }],
        })
        .expect(401);
    });
  });

  describe('Cambios', () => {
    it('cambio de talla: reintegra la original y descuenta la nueva', async () => {
      const beforeM = await stockQty(invMBeige);
      const beforeL = await stockQty(invLBeige);
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 1, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/exchanges`)
          .send({
            items: [
              {
                originalSaleItemId: Number(saleItemId),
                quantity: 1,
                newInventoryItemId: Number(invLBeige),
              },
            ],
          }),
      ).expect(201);

      expect(await stockQty(invMBeige)).toBe(beforeM - 1 + 1);
      expect(await stockQty(invLBeige)).toBe(beforeL - 1);
    });

    it('cambio de color: reintegra la original y descuenta la nueva', async () => {
      const beforeBeige = await stockQty(invMBeige);
      const beforeRojo = await stockQty(invMRojo);
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 1, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/exchanges`)
          .send({
            items: [
              {
                originalSaleItemId: Number(saleItemId),
                quantity: 1,
                newInventoryItemId: Number(invMRojo),
              },
            ],
          }),
      ).expect(201);

      expect(await stockQty(invMBeige)).toBe(beforeBeige);
      expect(await stockQty(invMRojo)).toBe(beforeRojo - 1);
    });

    it('cambio a otra combinación (talla y color a la vez)', async () => {
      const beforeMBeige = await stockQty(invMBeige);
      const beforeLRojo = await stockQty(invLRojo);
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 1, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/exchanges`)
          .send({
            items: [
              {
                originalSaleItemId: Number(saleItemId),
                quantity: 1,
                newInventoryItemId: Number(invLRojo),
              },
            ],
          }),
      ).expect(201);

      expect(await stockQty(invMBeige)).toBe(beforeMBeige);
      expect(await stockQty(invLRojo)).toBe(beforeLRojo - 1);
    });

    it('rechaza el cambio cuando no hay stock suficiente de la variante nueva', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 1, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;
      const stockLRojo = await stockQty(invLRojo);

      const res = await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/exchanges`)
          .send({
            items: [
              {
                originalSaleItemId: Number(saleItemId),
                quantity: stockLRojo + 1,
                newInventoryItemId: Number(invLRojo),
              },
            ],
          }),
      ).expect(400);
      expect((res.body as ErrorResponseBody).message).toMatch(
        /disponible|suficiente/,
      );
    });

    it('cambio con diferencia a pagar (producto nuevo más caro)', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 1, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      const res = await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/exchanges`)
          .send({
            paymentMethodId: Number(efectivoId),
            items: [
              {
                originalSaleItemId: Number(saleItemId),
                quantity: 1,
                newInventoryItemId: Number(invCaro),
              },
            ],
          }),
      ).expect(201);

      const exchange = await prisma.exchanges.findFirst({
        where: { original_sale_id: BigInt((res.body as SaleBody).id) },
        orderBy: { id: 'desc' },
      });
      expect(exchange?.difference_direction).toBe('CUSTOMER_PAYS');
      expect(Number(exchange?.difference_amount)).toBe(50); // 150 - 100
    });

    it('cambio con diferencia a favor del cliente (producto nuevo más barato)', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 1, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      const res = await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/exchanges`)
          .send({
            items: [
              {
                originalSaleItemId: Number(saleItemId),
                quantity: 1,
                newInventoryItemId: Number(invBarato),
              },
            ],
          }),
      ).expect(201);

      const exchange = await prisma.exchanges.findFirst({
        where: { original_sale_id: BigInt((res.body as SaleBody).id) },
        orderBy: { id: 'desc' },
      });
      expect(exchange?.difference_direction).toBe('BUSINESS_REFUNDS');
      expect(Number(exchange?.difference_amount)).toBe(20); // 100 - 80
    });

    it('exige forma de pago cuando el cliente debe pagar una diferencia', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 1, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      const res = await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/exchanges`)
          .send({
            items: [
              {
                originalSaleItemId: Number(saleItemId),
                quantity: 1,
                newInventoryItemId: Number(invCaro),
              },
            ],
          }),
      ).expect(400);
      expect((res.body as ErrorResponseBody).message).toContain(
        'Selecciona cómo pagará',
      );
    });

    it('404 para venta inexistente', () => {
      return authed(
        request(app.getHttpServer())
          .post('/sales/999999999/exchanges')
          .send({
            items: [
              { originalSaleItemId: 1, quantity: 1, newInventoryItemId: 1 },
            ],
          }),
      ).expect(404);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .post('/sales/1/exchanges')
        .send({
          items: [
            { originalSaleItemId: 1, quantity: 1, newInventoryItemId: 1 },
          ],
        })
        .expect(401);
    });
  });

  describe('Correcciones', () => {
    it('corrige la cantidad de una línea', async () => {
      const before = await stockQty(invMBeige);
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 2, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      const res = await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/corrections`)
          .send({
            saleItemId: Number(saleItemId),
            newQuantity: 1,
            reason: 'Cantidad equivocada',
          }),
      ).expect(201);
      const body = res.body as SaleBody;
      expect(body.items[0].quantity).toBe(1);
      expect(body.total).toBe('100');

      expect(await stockQty(invMBeige)).toBe(before - 1);
    });

    it('corrige la variante de una línea', async () => {
      const beforeM = await stockQty(invMBeige);
      const beforeL = await stockQty(invLBeige);
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 1, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      const res = await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/corrections`)
          .send({
            saleItemId: Number(saleItemId),
            newSizeId: Number(sizeL),
            reason: 'Talla equivocada',
          }),
      ).expect(201);
      expect((res.body as SaleBody).items[0]).toBeDefined();

      expect(await stockQty(invMBeige)).toBe(beforeM);
      expect(await stockQty(invLBeige)).toBe(beforeL - 1);
    });

    it('corrige el precio sin tocar el catálogo ni mover inventario', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 1, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;
      const before = await stockQty(invMBeige); // después de la venta, antes de la corrección

      const res = await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/corrections`)
          .send({
            saleItemId: Number(saleItemId),
            newUnitPrice: 85,
            reason: 'Precio mal ingresado',
          }),
      ).expect(201);
      expect((res.body as SaleBody).items[0].unitSalePrice).toBe('85');
      expect((res.body as SaleBody).total).toBe('85');

      expect(await stockQty(invMBeige)).toBe(before); // sin movimiento de inventario

      const product = await prisma.products.findUniqueOrThrow({
        where: { id: productId },
      });
      expect(Number(product.sale_price)).toBe(100); // catálogo intacto
    });

    it('rechaza corregir una venta que ya tuvo una devolución (ya no está COMPLETADA)', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 2, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;
      await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/returns`)
          .send({
            reason: 'Otro',
            items: [
              {
                saleItemId: Number(saleItemId),
                quantity: 1,
                conditionStatus: 'SALEABLE',
              },
            ],
          }),
      ).expect(201);

      const res = await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/corrections`)
          .send({
            saleItemId: Number(saleItemId),
            newQuantity: 1,
            reason: 'Cantidad equivocada',
          }),
      ).expect(400);
      expect((res.body as ErrorResponseBody).message).toContain('completada');
    });

    it('rechaza una corrección sin ningún cambio real', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 1, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/corrections`)
          .send({ saleItemId: Number(saleItemId), reason: 'Otro' }),
      ).expect(400);
    });

    it('404 para venta inexistente', () => {
      return authed(
        request(app.getHttpServer())
          .post('/sales/999999999/corrections')
          .send({ saleItemId: 1, newQuantity: 1, reason: 'Otro' }),
      ).expect(404);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer())
        .post('/sales/1/corrections')
        .send({ saleItemId: 1, newQuantity: 1, reason: 'Otro' })
        .expect(401);
    });
  });

  describe('Historial e integridad', () => {
    it('mantiene el movimiento SALIDA original intacto después de una devolución', async () => {
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 2, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      const originalMovement =
        await prisma.inventory_movements.findFirstOrThrow({
          where: { reference_type: 'sale', reference_id: BigInt(sale.id) },
        });

      await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/returns`)
          .send({
            reason: 'Otro',
            items: [
              {
                saleItemId: Number(saleItemId),
                quantity: 1,
                conditionStatus: 'SALEABLE',
              },
            ],
          }),
      ).expect(201);

      const stillThere = await prisma.inventory_movements.findUniqueOrThrow({
        where: { id: originalMovement.id },
      });
      expect(stillThere.movement_type).toBe('SALIDA');
      expect(stillThere.quantity).toBe(-2); // nunca se edita

      const history = await authed(
        request(app.getHttpServer()).get(`/sales/${sale.id}/history`),
      ).expect(200);
      const entries = history.body as { type: string }[];
      expect(entries.some((e) => e.type === 'CREATED')).toBe(true);
      expect(entries.some((e) => e.type === 'RETURN')).toBe(true);
    });

    it('operación transaccional: un cambio a una variante inexistente no deja nada a medias', async () => {
      const before = await stockQty(invMBeige);
      const sale = await createSale([
        { inventoryItemId: invMBeige, quantity: 1, unitSalePrice: 100 },
      ]);
      const saleItemId = sale.items[0].id;

      await authed(
        request(app.getHttpServer())
          .post(`/sales/${sale.id}/exchanges`)
          .send({
            items: [
              {
                originalSaleItemId: Number(saleItemId),
                quantity: 1,
                newInventoryItemId: 999999999,
              },
            ],
          }),
      ).expect(400);

      expect(await stockQty(invMBeige)).toBe(before - 1); // no se tocó nada más
      const exchangeCount = await prisma.exchanges.count({
        where: { original_sale_id: BigInt(sale.id) },
      });
      expect(exchangeCount).toBe(0);
    });

    it('404 al pedir el historial de una venta inexistente', () => {
      return authed(
        request(app.getHttpServer()).get('/sales/999999999/history'),
      ).expect(404);
    });

    it('sin sesión responde 401', () => {
      return request(app.getHttpServer()).get('/sales/1/history').expect(401);
    });
  });
});
