import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Purchase } from '../types/purchase';
import type { Sale } from '../types/sale';
import {
  DEFAULT_RECEIPT_BUSINESS,
  downloadDataUrl,
  renderPurchaseReceiptCanvas,
  renderReceiptCanvas,
} from './receipt';

let fillTextCalls: string[];
let drawImageCalls: string[];

/** jsdom no carga imágenes de verdad (sin red): sin este stub, `new Image()`
 * con un `src` nunca dispara `onload` y el comprobante se queda esperando
 * para siempre. Dispara el "load" en un microtask, como lo haría un
 * navegador real, para no ocultar bugs de orden async. */
function installFakeImage() {
  class FakeImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    naturalWidth = 640;
    naturalHeight = 140;
    set src(value: string) {
      drawImageCalls.push(`load:${value}`);
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('Image', FakeImage);
}

function installFakeCanvasContext() {
  // jsdom no implementa Path2D; el canvas falso no necesita trazar la ruta real.
  if (typeof globalThis.Path2D === 'undefined') {
    (globalThis as { Path2D?: unknown }).Path2D = class {
      constructor(_path?: string) {}
    };
  }
  fillTextCalls = [];
  drawImageCalls = [];
  installFakeImage();
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    fill: vi.fn(),
    drawImage: vi.fn(() => {
      drawImageCalls.push('draw');
    }),
    fillText: vi.fn((text: string) => {
      fillTextCalls.push(text);
    }),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    set fillStyle(_v: string) {},
    set strokeStyle(_v: string) {},
    set font(_v: string) {},
    set textAlign(_v: string) {},
    set textBaseline(_v: string) {},
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    ctx as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/jpeg;base64,fake');
}

const BASE_SALE: Sale = {
  id: '1',
  saleNumber: '00001',
  saleDate: '2026-01-01T10:30:00.000Z',
  status: 'COMPLETED',
  paymentMethod: { id: '1', name: 'Efectivo' },
  notes: null,
  itemCount: 2,
  subtotal: '280',
  discountAmount: '20',
  shippingAmount: '0',
  total: '280',
  totalRefunded: '0',
  netTotal: '280',
  items: [
    {
      id: '1',
      productId: '10',
      productName: 'Blusa Satinada',
      productCode: 'BLU-0012',
      sizeId: '3',
      sizeName: 'M',
      colorId: '5',
      colorName: 'Beige',
      quantity: 2,
      unitSalePrice: '100',
      unitCost: '60',
      discountAmount: '0',
      subtotal: '200',
      returnableQuantity: 2,
    },
    {
      id: '2',
      productId: '11',
      productName: 'Pantalón Negro',
      productCode: 'PAN-0001',
      sizeId: '4',
      sizeName: 'L',
      colorId: '6',
      colorName: 'Negro',
      quantity: 1,
      unitSalePrice: '80',
      unitCost: '50',
      discountAmount: '20',
      subtotal: '80',
      returnableQuantity: 1,
    },
  ],
  createdAt: '2026-01-01T10:30:00.000Z',
};

const BASE_PURCHASE: Purchase = {
  id: '1',
  purchaseNumber: '00001',
  purchaseDate: '2026-01-02T09:00:00.000Z',
  status: 'COMPLETED',
  supplier: { id: '1', name: 'Textiles del Valle' },
  paymentMethod: { id: '1', name: 'Transferencia' },
  notes: null,
  itemCount: 1,
  goodsTotal: '300',
  shippingCost: '0',
  totalCost: '300',
  items: [
    {
      id: '1',
      productId: '10',
      productName: 'Blusa Satinada',
      productCode: 'BLU-0012',
      sizeId: '3',
      sizeName: 'M',
      colorId: '5',
      colorName: 'Beige',
      quantity: 5,
      unitCost: '60',
      subtotal: '300',
    },
  ],
  createdAt: '2026-01-02T09:00:00.000Z',
};

beforeEach(() => {
  installFakeCanvasContext();
});

describe('renderReceiptCanvas (comprobante de venta)', () => {
  it('usa el mensaje de agradecimiento dinámico cuando se provee', async () => {
    await renderReceiptCanvas(BASE_SALE, {
      businessName: 'Mi Tiendita',
      receiptMessage: 'Vuelve pronto 💕',
    });

    expect(fillTextCalls).toContain('Vuelve pronto 💕');
  });

  it('usa el mensaje por defecto si no hay configuración disponible', async () => {
    await renderReceiptCanvas(BASE_SALE);

    expect(fillTextCalls).toContain(DEFAULT_RECEIPT_BUSINESS.receiptMessage);
  });

  it('muestra el precio realmente vendido de cada línea, no uno recalculado', async () => {
    await renderReceiptCanvas(BASE_SALE);

    expect(fillTextCalls.some((t) => t.includes('Q100.00'))).toBe(true);
    expect(fillTextCalls.some((t) => t.includes('Q80.00'))).toBe(true);
  });

  it('muestra el indicador de descuento solo en la línea con regateo', async () => {
    await renderReceiptCanvas(BASE_SALE);

    const discountLines = fillTextCalls.filter((t) => t.includes('descuento'));
    expect(discountLines).toHaveLength(1);
  });

  it('no muestra ningún indicador de descuento si ninguna línea tuvo regateo', async () => {
    const saleWithoutDiscount: Sale = {
      ...BASE_SALE,
      items: BASE_SALE.items.map((item) => ({ ...item, discountAmount: '0' })),
    };
    await renderReceiptCanvas(saleWithoutDiscount);

    expect(fillTextCalls.some((t) => t.includes('descuento'))).toBe(false);
  });

  it('muestra el total exacto almacenado en la venta', async () => {
    await renderReceiptCanvas(BASE_SALE);
    expect(fillTextCalls).toContain('Q280.00');
  });

  it('muestra la forma de pago', async () => {
    await renderReceiptCanvas(BASE_SALE);
    expect(fillTextCalls.some((t) => t.includes('Efectivo'))).toBe(true);
  });

  it('muestra el estado cuando la venta no está completada', async () => {
    await renderReceiptCanvas({ ...BASE_SALE, status: 'RETURNED' });
    expect(fillTextCalls.some((t) => t === 'DEVUELTA')).toBe(true);
  });

  it('no muestra ninguna etiqueta de estado cuando la venta está completada', async () => {
    await renderReceiptCanvas(BASE_SALE);
    expect(fillTextCalls.some((t) => t === 'COMPLETADA')).toBe(false);
  });

  it('dibuja el logo "Mala♡Mía" como banner superior', async () => {
    await renderReceiptCanvas(BASE_SALE);
    expect(drawImageCalls).toContain('draw');
  });
});

describe('renderPurchaseReceiptCanvas (comprobante de compra)', () => {
  it('muestra proveedor, costo unitario histórico y total de compra', async () => {
    await renderPurchaseReceiptCanvas(BASE_PURCHASE, {
      businessName: 'Mi Tiendita',
      receiptMessage: 'Gracias',
    });

    expect(fillTextCalls.some((t) => t.includes('Textiles del Valle'))).toBe(true);
    expect(fillTextCalls.some((t) => t.includes('Q60.00'))).toBe(true);
    expect(fillTextCalls).toContain('Q300.00');
    expect(fillTextCalls.some((t) => t.includes('Transferencia'))).toBe(true);
  });

  it('omite la línea de notas cuando la compra no tiene notas', async () => {
    await renderPurchaseReceiptCanvas(BASE_PURCHASE);
    expect(fillTextCalls.some((t) => t.includes('Notas'))).toBe(false);
  });

  it('muestra las notas cuando sí existen', async () => {
    await renderPurchaseReceiptCanvas({ ...BASE_PURCHASE, notes: 'Entrega parcial' });
    expect(fillTextCalls.some((t) => t.includes('Entrega parcial'))).toBe(true);
  });

  it('dibuja el logo "Mala♡Mía" como banner superior', async () => {
    await renderPurchaseReceiptCanvas(BASE_PURCHASE);
    expect(drawImageCalls).toContain('draw');
  });
});

describe('downloadDataUrl', () => {
  it('crea un enlace temporal y dispara la descarga', () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    downloadDataUrl('data:image/jpeg;base64,abc', 'venta-00001.jpg');
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});
