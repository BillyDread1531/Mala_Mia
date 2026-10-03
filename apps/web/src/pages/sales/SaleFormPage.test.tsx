import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { PaymentMethod } from '../../types/catalog';
import type { InventoryItem } from '../../types/inventory';
import type { Product } from '../../types/product';
import type { Sale } from '../../types/sale';
import { SaleFormPage } from './SaleFormPage';

vi.mock('../../api/catalog', () => ({
  listPaymentMethods: vi.fn(),
}));
vi.mock('../../api/products', () => ({
  listProducts: vi.fn(),
}));
vi.mock('../../api/inventory', () => ({
  listInventory: vi.fn(),
}));
vi.mock('../../api/sales', () => ({
  createSale: vi.fn(),
}));
vi.mock('../../api/settings', () => ({
  getGeneralSettings: vi.fn(),
}));
vi.mock('../../lib/receipt', () => ({
  renderReceiptJpgDataUrl: vi.fn(),
  shareOrDownloadDataUrl: vi.fn(),
}));

import { listPaymentMethods } from '../../api/catalog';
import { listInventory } from '../../api/inventory';
import { listProducts } from '../../api/products';
import { createSale } from '../../api/sales';
import { getGeneralSettings } from '../../api/settings';
import { renderReceiptJpgDataUrl } from '../../lib/receipt';

const mockedListPaymentMethods = vi.mocked(listPaymentMethods);
const mockedListProducts = vi.mocked(listProducts);
const mockedListInventory = vi.mocked(listInventory);
const mockedCreateSale = vi.mocked(createSale);
const mockedGetGeneralSettings = vi.mocked(getGeneralSettings);
const mockedRenderReceipt = vi.mocked(renderReceiptJpgDataUrl);

const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: '1',
    name: 'Efectivo',
    appliesToSales: true,
    appliesToPurchases: true,
    appliesToExpenses: true,
    isActive: true,
  },
  {
    id: '2',
    name: 'Transferencia',
    appliesToSales: true,
    appliesToPurchases: true,
    appliesToExpenses: true,
    isActive: true,
  },
];

const PRODUCT: Product = {
  id: '10',
  code: 'BLU-0012',
  name: 'Blusa Satinada',
  description: null,
  category: { id: '1', name: 'Blusas' },
  cost: '65',
  salePrice: '125',
  recommendedPrice: '100',
  waistMeasurement: null,
  lengthMeasurement: null,
  isAvailableForSale: true,
  variantCount: 1,
  variants: [{ sizeId: '3', sizeName: 'M', colorId: '5', colorName: 'Beige' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const STOCK_ITEM: InventoryItem = {
  id: '77',
  product: { id: '10', name: 'Blusa Satinada', code: 'BLU-0012' },
  sizeId: '3',
  sizeName: 'M',
  colorId: '5',
  colorName: 'Beige',
  quantity: 5,
  averageCost: '65',
  status: 'DISPONIBLE',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const CREATED_SALE: Sale = {
  id: '99',
  saleNumber: '00001',
  saleDate: '2026-01-01T00:00:00.000Z',
  status: 'COMPLETED',
  paymentMethod: { id: '1', name: 'Efectivo' },
  notes: null,
  itemCount: 1,
  subtotal: '125',
  discountAmount: '0',
  shippingAmount: '0',
  total: '125',
  totalRefunded: '0',
  netTotal: '125',
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
      quantity: 1,
      unitSalePrice: '125',
      unitCost: '65',
      discountAmount: '0',
      subtotal: '125',
      returnableQuantity: 1,
    },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/ventas/nueva']}>
        <Routes>
          <Route path="/ventas/nueva" element={<SaleFormPage />} />
          <Route path="/ventas/:id" element={<div>Detalle de venta</div>} />
          <Route path="/ventas" element={<div>Lista de ventas</div>} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedListPaymentMethods.mockResolvedValue(PAYMENT_METHODS);
  mockedRenderReceipt.mockResolvedValue('data:image/jpeg;base64,xyz');
  mockedGetGeneralSettings.mockResolvedValue({
    businessName: 'MALA MÍA',
    receiptMessage: 'Gracias',
    targetProfitMargin: 35,
    lowStockThreshold: 2,
    defaultShippingFee: 35,
  });
});

describe('SaleFormPage', () => {
  it('busca un producto y muestra tallas primero, luego colores con stock', async () => {
    const user = userEvent.setup();
    mockedListProducts.mockResolvedValue({ items: [PRODUCT], total: 1, page: 1, pageSize: 20 });
    mockedListInventory.mockResolvedValue({ items: [STOCK_ITEM], total: 1, page: 1, pageSize: 20 });
    renderPage();

    await user.type(await screen.findByLabelText('Producto'), 'blusa satin');
    await user.click(await screen.findByRole('button', { name: /Blusa Satinada/ }));

    expect(await screen.findByRole('button', { name: 'M' })).toBeInTheDocument();
    expect(
      screen.getByText('Elige una talla para ver sus colores disponibles.'),
    ).toBeInTheDocument();
    expect(mockedListInventory).toHaveBeenCalledWith({ productId: 10, available: 'true' });

    await user.click(screen.getByRole('button', { name: 'M' }));
    expect(await screen.findByRole('button', { name: 'Beige · 5' })).toBeInTheDocument();
  });

  it('agrega una combinación al carrito con precio editable y calcula el total', async () => {
    const user = userEvent.setup();
    mockedListProducts.mockResolvedValue({ items: [PRODUCT], total: 1, page: 1, pageSize: 20 });
    mockedListInventory.mockResolvedValue({ items: [STOCK_ITEM], total: 1, page: 1, pageSize: 20 });
    renderPage();

    await user.type(await screen.findByLabelText('Producto'), 'blusa satin');
    await user.click(await screen.findByRole('button', { name: /Blusa Satinada/ }));
    await user.click(await screen.findByRole('button', { name: 'M' }));
    await user.click(await screen.findByRole('button', { name: 'Beige · 5' }));

    const rows = screen.getAllByRole('row');
    const inputs = within(rows[1]).getAllByRole('spinbutton');
    await user.type(inputs[0], '2');
    // El precio ya viene precargado con el precio de catálogo (125); lo cambiamos por regateo.
    await user.clear(inputs[1]);
    await user.type(inputs[1], '115');

    await user.click(screen.getByRole('button', { name: 'Agregar a la venta' }));

    expect(await screen.findAllByText('Q230')).toHaveLength(2); // línea y total coinciden (1 producto)
    expect(screen.getByText('Precio con descuento')).toBeInTheDocument();
  });

  it('no permite agregar más unidades de las disponibles en stock', async () => {
    const user = userEvent.setup();
    mockedListProducts.mockResolvedValue({ items: [PRODUCT], total: 1, page: 1, pageSize: 20 });
    mockedListInventory.mockResolvedValue({ items: [STOCK_ITEM], total: 1, page: 1, pageSize: 20 });
    renderPage();

    await user.type(await screen.findByLabelText('Producto'), 'blusa satin');
    await user.click(await screen.findByRole('button', { name: /Blusa Satinada/ }));
    await user.click(await screen.findByRole('button', { name: 'M' }));
    await user.click(await screen.findByRole('button', { name: 'Beige · 5' }));

    const rows = screen.getAllByRole('row');
    const inputs = within(rows[1]).getAllByRole('spinbutton');
    await user.type(inputs[0], '999');

    await user.click(screen.getByRole('button', { name: 'Agregar a la venta' }));

    // No debe agregarse al carrito: no aparece la sección de resumen.
    expect(screen.queryByText('Resumen de la venta')).not.toBeInTheDocument();
  });

  it('confirma la venta, descuenta el flujo y muestra el comprobante generado', async () => {
    const user = userEvent.setup();
    mockedListProducts.mockResolvedValue({ items: [PRODUCT], total: 1, page: 1, pageSize: 20 });
    mockedListInventory.mockResolvedValue({ items: [STOCK_ITEM], total: 1, page: 1, pageSize: 20 });
    mockedCreateSale.mockResolvedValue(CREATED_SALE);
    renderPage();

    await user.selectOptions(await screen.findByLabelText('Forma de pago'), '1');

    await user.type(screen.getByLabelText('Producto'), 'blusa satin');
    await user.click(await screen.findByRole('button', { name: /Blusa Satinada/ }));
    await user.click(await screen.findByRole('button', { name: 'M' }));
    await user.click(await screen.findByRole('button', { name: 'Beige · 5' }));
    const rows = screen.getAllByRole('row');
    const inputs = within(rows[1]).getAllByRole('spinbutton');
    await user.type(inputs[0], '1');
    await user.click(screen.getByRole('button', { name: 'Agregar a la venta' }));

    await user.click(await screen.findByRole('button', { name: 'Confirmar venta' }));

    await vi.waitFor(() => expect(mockedCreateSale).toHaveBeenCalledTimes(1));
    expect(mockedCreateSale).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentMethodId: 1,
        items: [{ inventoryItemId: 77, quantity: 1, unitSalePrice: 125 }],
      }),
    );

    expect(await screen.findByText('¡Venta #00001 registrada!')).toBeInTheDocument();
    expect(await screen.findByAltText('Comprobante de la venta 00001')).toBeInTheDocument();
  });

  it('"Cobrar envío" suma el monto al total y lo envía en la venta', async () => {
    const user = userEvent.setup();
    mockedListProducts.mockResolvedValue({ items: [PRODUCT], total: 1, page: 1, pageSize: 20 });
    mockedListInventory.mockResolvedValue({ items: [STOCK_ITEM], total: 1, page: 1, pageSize: 20 });
    mockedCreateSale.mockResolvedValue(CREATED_SALE);
    renderPage();

    await user.selectOptions(await screen.findByLabelText('Forma de pago'), '1');
    await user.type(screen.getByLabelText('Producto'), 'blusa satin');
    await user.click(await screen.findByRole('button', { name: /Blusa Satinada/ }));
    await user.click(await screen.findByRole('button', { name: 'M' }));
    await user.click(await screen.findByRole('button', { name: 'Beige · 5' }));
    const rows = screen.getAllByRole('row');
    const inputs = within(rows[1]).getAllByRole('spinbutton');
    await user.type(inputs[0], '1');
    await user.click(screen.getByRole('button', { name: 'Agregar a la venta' }));

    await user.click(await screen.findByRole('checkbox', { name: /Cobrar envío/ }));

    expect(await screen.findByLabelText('Monto del envío')).toHaveValue(35);
    expect(screen.getByText(/Subtotal Q125 \+ envío Q35/)).toBeInTheDocument();
    expect(screen.getByText(/^Total:/)).toHaveTextContent('Q160');

    await user.click(screen.getByRole('button', { name: 'Confirmar venta' }));

    await vi.waitFor(() =>
      expect(mockedCreateSale).toHaveBeenCalledWith(
        expect.objectContaining({ shippingAmount: 35 }),
      ),
    );
  });

  it('con muchas combinaciones, solo muestra los colores de la talla elegida y no pierde lo ya marcado en otra talla', async () => {
    const user = userEvent.setup();
    // 2 tallas × 3 colores: suficiente para probar que no se mezclan, sin
    // necesidad de simular las 50 combinaciones reales del caso reportado.
    const manyVariants: InventoryItem[] = [
      { ...STOCK_ITEM, id: '1', sizeId: '3', sizeName: 'M', colorId: '5', colorName: 'Verde Menta' },
      { ...STOCK_ITEM, id: '2', sizeId: '3', sizeName: 'M', colorId: '6', colorName: 'Verde Musgo' },
      { ...STOCK_ITEM, id: '3', sizeId: '3', sizeName: 'M', colorId: '7', colorName: 'Verde Olivo' },
      { ...STOCK_ITEM, id: '4', sizeId: '4', sizeName: 'L', colorId: '5', colorName: 'Verde Menta' },
      { ...STOCK_ITEM, id: '5', sizeId: '4', sizeName: 'L', colorId: '6', colorName: 'Verde Musgo' },
      { ...STOCK_ITEM, id: '6', sizeId: '4', sizeName: 'L', colorId: '7', colorName: 'Verde Olivo' },
    ];
    mockedListProducts.mockResolvedValue({ items: [PRODUCT], total: 1, page: 1, pageSize: 20 });
    mockedListInventory.mockResolvedValue({ items: manyVariants, total: 6, page: 1, pageSize: 20 });
    renderPage();

    await user.type(await screen.findByLabelText('Producto'), 'blusa satin');
    await user.click(await screen.findByRole('button', { name: /Blusa Satinada/ }));

    // Antes de elegir talla, no hay ninguna fila de cantidad/precio flotando.
    expect(screen.queryByRole('row')).not.toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: 'M' }));
    expect(screen.getByRole('button', { name: 'Verde Menta · 5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'L' })).toBeInTheDocument(); // chip de talla sigue ahí

    await user.click(screen.getByRole('button', { name: 'Verde Musgo · 5' }));
    expect(screen.getAllByRole('row')).toHaveLength(2); // encabezado + 1 elegida

    // Cambiar de talla no debe perder lo ya marcado en M.
    await user.click(screen.getByRole('button', { name: 'L' }));
    expect(screen.getByRole('button', { name: 'Verde Olivo · 5' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Verde Olivo · 5' }));
    expect(screen.getAllByRole('row')).toHaveLength(3); // encabezado + M/Verde Musgo + L/Verde Olivo
  });
});
