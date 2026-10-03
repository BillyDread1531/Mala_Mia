import type { Purchase } from '../types/purchase';
import type { Sale } from '../types/sale';

export interface ReceiptBusinessInfo {
  businessName: string;
  receiptMessage: string;
}

export const DEFAULT_RECEIPT_BUSINESS: ReceiptBusinessInfo = {
  businessName: 'MALA MÍA',
  receiptMessage: '¡Gracias por tu compra!',
};

const WIDTH = 640;
const PADDING = 40;
const ROW_HEIGHT = 46;
// Banner superior centrado: el corazón ("MALA MIA APP", el mismo del ícono).
const HEART_LOGO_SRC = '/mala-mia-heart.png';
const HEART_LOGO_ASPECT = 300 / 390;
const HEART_LOGO_DRAW_HEIGHT = 56;
const HEART_LOGO_DRAW_Y = 10;
// Línea izquierda, donde antes iba el corazón chico + "MALA MÍA": el
// letrero "Mala♡Mía" ("MALA MIA FONDO 2").
const WORDMARK_SRC = '/mala-mia-wordmark.png';
const WORDMARK_ASPECT = 640 / 140;
const WORDMARK_DRAW_HEIGHT = 32;
const WORDMARK_DRAW_Y = 16;
const HEADER_BANNER_HEIGHT = 80;
const COLOR_TEXT = '#241f1f';
const COLOR_MUTED = '#8a7f78';
const COLOR_BORDER = '#ece3dd';
const COLOR_ACCENT = '#e0447b';
const COLOR_ACCENT_STRONG = '#b4285c';
const COLOR_BG = '#fffdfc';
const COLOR_WARNING = '#b8790b';
const COLOR_DANGER = '#c23b3b';
const FONT = 'Poppins, system-ui, sans-serif';

const STATUS_LABELS: Record<string, string> = {
  PARTIALLY_RETURNED: 'Parcialmente devuelta',
  RETURNED: 'Devuelta',
  CANCELLED: 'Cancelada',
};

function formatMoney(value: string): string {
  return `Q${Number(value).toFixed(2)}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const imagePromiseCache = new Map<string, Promise<HTMLImageElement>>();

/** Carga una imagen de marca una sola vez por sesión y origen (se reutiliza
 * la misma promesa en cada comprobante generado después). */
function loadBrandImage(src: string): Promise<HTMLImageElement> {
  let promise = imagePromiseCache.get(src);
  if (!promise) {
    promise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar el logo.'));
      img.src = src;
    });
    imagePromiseCache.set(src, promise);
  }
  return promise;
}

function loadHeartLogo(): Promise<HTMLImageElement> {
  return loadBrandImage(HEART_LOGO_SRC);
}

function loadWordmarkImage(): Promise<HTMLImageElement> {
  return loadBrandImage(WORDMARK_SRC);
}

/** Banner superior centrado con el corazón de marca. */
function drawHeartBanner(ctx: CanvasRenderingContext2D, heartLogo: HTMLImageElement): void {
  const drawWidth = HEART_LOGO_DRAW_HEIGHT * HEART_LOGO_ASPECT;
  ctx.drawImage(
    heartLogo,
    (WIDTH - drawWidth) / 2,
    HEART_LOGO_DRAW_Y,
    drawWidth,
    HEART_LOGO_DRAW_HEIGHT,
  );
}

/** Letrero "Mala♡Mía" alineado a la izquierda, en el lugar donde antes iba
 * el corazón chico + el nombre del negocio en texto plano. */
function drawWordmark(ctx: CanvasRenderingContext2D, wordmark: HTMLImageElement): void {
  const drawWidth = WORDMARK_DRAW_HEIGHT * WORDMARK_ASPECT;
  ctx.drawImage(wordmark, PADDING, WORDMARK_DRAW_Y, drawWidth, WORDMARK_DRAW_HEIGHT);
}

function divider(ctx: CanvasRenderingContext2D, y: number) {
  ctx.strokeStyle = COLOR_BORDER;
  ctx.beginPath();
  ctx.moveTo(PADDING, y);
  ctx.lineTo(WIDTH - PADDING, y);
  ctx.stroke();
}

/** Genera el comprobante visual de una venta como <canvas>, listo para
 * exportarse a JPG. Dibujado a mano con Canvas 2D (sin dependencias nuevas):
 * es la opción más ligera para un documento de una sola página como este. */
export async function renderReceiptCanvas(
  sale: Sale,
  business: ReceiptBusinessInfo = DEFAULT_RECEIPT_BUSINESS,
): Promise<HTMLCanvasElement> {
  const [heartLogo, wordmark] = await Promise.all([
    loadHeartLogo(),
    loadWordmarkImage(),
    document.fonts?.ready?.catch(() => undefined),
  ]);

  const statusLabel = STATUS_LABELS[sale.status];
  const discountCount = sale.items.filter((item) => Number(item.discountAmount) > 0).length;
  const hasShipping = Number(sale.shippingAmount) > 0;
  const height =
    HEADER_BANNER_HEIGHT +
    148 +
    sale.items.length * ROW_HEIGHT +
    discountCount * 14 +
    200 +
    (statusLabel ? 22 : 0) +
    (hasShipping ? 24 : 0);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo generar el comprobante.');

  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = 'alphabetic';

  drawHeartBanner(ctx, heartLogo);
  ctx.translate(0, HEADER_BANNER_HEIGHT);

  drawWordmark(ctx, wordmark);
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText('Comprobante de venta', PADDING, 80);

  ctx.textAlign = 'right';
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText(`Venta #${sale.saleNumber}`, WIDTH - PADDING, 52);
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText(formatDateTime(sale.saleDate), WIDTH - PADDING, 72);
  ctx.textAlign = 'left';

  let headerBottom = 104;
  if (statusLabel) {
    ctx.textAlign = 'right';
    ctx.font = `700 12px ${FONT}`;
    ctx.fillStyle = sale.status === 'CANCELLED' ? COLOR_DANGER : COLOR_WARNING;
    ctx.fillText(statusLabel.toUpperCase(), WIDTH - PADDING, 90);
    ctx.textAlign = 'left';
    headerBottom += 22;
  }

  divider(ctx, headerBottom);

  let y = headerBottom + 30;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText('PRODUCTO', PADDING, y);
  ctx.textAlign = 'right';
  ctx.fillText('SUBTOTAL', WIDTH - PADDING, y);
  ctx.textAlign = 'left';

  y += 14;
  divider(ctx, y);

  for (const item of sale.items) {
    y += ROW_HEIGHT - 14;
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(item.productName, PADDING, y);

    ctx.font = `400 12px ${FONT}`;
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText(
      `${item.sizeName} / ${item.colorName} · ${item.quantity} × ${formatMoney(item.unitSalePrice)}`,
      PADDING,
      y + 17,
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(formatMoney(item.subtotal), WIDTH - PADDING, y);
    ctx.textAlign = 'left';

    const hasDiscount = Number(item.discountAmount) > 0;
    if (hasDiscount) {
      ctx.font = `400 11px ${FONT}`;
      ctx.fillStyle = COLOR_ACCENT;
      ctx.fillText('Precio con descuento (regateo)', PADDING, y + 31);
    }

    y += 14;
    if (hasDiscount) y += 14;
    divider(ctx, y + 14);
    y += 14;
  }

  y += 32;
  if (hasShipping) {
    ctx.textAlign = 'right';
    ctx.font = `400 13px ${FONT}`;
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText('Envío', WIDTH - PADDING - 110, y);
    ctx.font = `600 14px ${FONT}`;
    ctx.fillStyle = COLOR_TEXT;
    ctx.fillText(formatMoney(sale.shippingAmount), WIDTH - PADDING, y);
    ctx.textAlign = 'left';
    y += 24;
  }

  ctx.textAlign = 'right';
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText('Total', WIDTH - PADDING - 110, y);
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = COLOR_ACCENT_STRONG;
  ctx.fillText(formatMoney(sale.total), WIDTH - PADDING, y);
  ctx.textAlign = 'left';

  y += 30;
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText(`Forma de pago: ${sale.paymentMethod.name}`, PADDING, y);

  y += 36;
  divider(ctx, y);

  y += 30;
  ctx.textAlign = 'center';
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText(business.receiptMessage, WIDTH / 2, y);
  ctx.textAlign = 'left';

  return canvas;
}

export async function renderReceiptJpgDataUrl(
  sale: Sale,
  business: ReceiptBusinessInfo = DEFAULT_RECEIPT_BUSINESS,
): Promise<string> {
  const canvas = await renderReceiptCanvas(sale, business);
  return canvas.toDataURL('image/jpeg', 0.92);
}

/** Comprobante visual de una compra, mismo trazo que el de venta (helpers de
 * dibujo y colores compartidos) para no duplicar la solución visual. */
export async function renderPurchaseReceiptCanvas(
  purchase: Purchase,
  business: ReceiptBusinessInfo = DEFAULT_RECEIPT_BUSINESS,
): Promise<HTMLCanvasElement> {
  const [heartLogo, wordmark] = await Promise.all([
    loadHeartLogo(),
    loadWordmarkImage(),
    document.fonts?.ready?.catch(() => undefined),
  ]);

  const height = HEADER_BANNER_HEIGHT + 346 + (purchase.notes ? 20 : 0) + purchase.items.length * 60;
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo generar el comprobante.');

  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, WIDTH, height);
  ctx.textBaseline = 'alphabetic';

  drawHeartBanner(ctx, heartLogo);
  ctx.translate(0, HEADER_BANNER_HEIGHT);

  drawWordmark(ctx, wordmark);
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText('Comprobante de compra', PADDING, 80);

  ctx.textAlign = 'right';
  ctx.fillStyle = COLOR_TEXT;
  ctx.font = `600 14px ${FONT}`;
  ctx.fillText(`Compra #${purchase.purchaseNumber}`, WIDTH - PADDING, 52);
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText(formatDateTime(purchase.purchaseDate), WIDTH - PADDING, 72);
  ctx.textAlign = 'left';

  divider(ctx, 104);

  let y = 130;
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText(`Proveedor: ${purchase.supplier.name}`, PADDING, y);
  if (purchase.notes) {
    y += 20;
    ctx.fillText(`Notas: ${purchase.notes}`, PADDING, y);
  }

  y += 24;
  divider(ctx, y);

  y += 30;
  ctx.font = `600 12px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText('PRODUCTO', PADDING, y);
  ctx.textAlign = 'right';
  ctx.fillText('SUBTOTAL', WIDTH - PADDING, y);
  ctx.textAlign = 'left';

  y += 14;
  divider(ctx, y);

  for (const item of purchase.items) {
    y += ROW_HEIGHT - 14;
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(item.productName, PADDING, y);

    ctx.font = `400 12px ${FONT}`;
    ctx.fillStyle = COLOR_MUTED;
    ctx.fillText(
      `${item.sizeName} / ${item.colorName} · ${item.quantity} × ${formatMoney(item.unitCost)}`,
      PADDING,
      y + 17,
    );

    ctx.textAlign = 'right';
    ctx.fillStyle = COLOR_TEXT;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText(formatMoney(item.subtotal), WIDTH - PADDING, y);
    ctx.textAlign = 'left';

    y += 14;
    divider(ctx, y + 14);
    y += 14;
  }

  y += 32;
  ctx.textAlign = 'right';
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText('Total de compra', WIDTH - PADDING - 150, y);
  ctx.font = `700 20px ${FONT}`;
  ctx.fillStyle = COLOR_ACCENT_STRONG;
  ctx.fillText(formatMoney(purchase.totalCost), WIDTH - PADDING, y);
  ctx.textAlign = 'left';

  y += 30;
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText(`Forma de pago: ${purchase.paymentMethod.name}`, PADDING, y);

  y += 36;
  divider(ctx, y);

  y += 30;
  ctx.textAlign = 'center';
  ctx.font = `400 13px ${FONT}`;
  ctx.fillStyle = COLOR_MUTED;
  ctx.fillText(business.receiptMessage, WIDTH / 2, y);
  ctx.textAlign = 'left';

  return canvas;
}

export async function renderPurchaseReceiptJpgDataUrl(
  purchase: Purchase,
  business: ReceiptBusinessInfo = DEFAULT_RECEIPT_BUSINESS,
): Promise<string> {
  const canvas = await renderPurchaseReceiptCanvas(purchase, business);
  return canvas.toDataURL('image/jpeg', 0.92);
}

export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function dataUrlToFile(dataUrl: string, filename: string): Promise<File> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  return new File([blob], filename, { type: blob.type });
}

/** Comparte el comprobante con el selector nativo (WhatsApp, etc.) cuando el
 * navegador lo soporta (Web Share API con archivos, principalmente Android
 * Chrome y Safari/iOS); en escritorio o sin soporte, simplemente lo descarga
 * como antes. Un error que no sea "la persona cerró el selector" también cae
 * a la descarga, para no dejarla sin comprobante. */
export async function shareOrDownloadDataUrl(
  dataUrl: string,
  filename: string,
  shareTitle: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.share && nav.canShare) {
    try {
      const file = await dataUrlToFile(dataUrl, filename);
      if (nav.canShare({ files: [file] })) {
        await nav.share({ files: [file], title: shareTitle });
        return 'shared';
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  downloadDataUrl(dataUrl, filename);
  return 'downloaded';
}
