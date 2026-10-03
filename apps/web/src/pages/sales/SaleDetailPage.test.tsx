import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { InventoryItem } from '../../types/inventory';
import type { Product } from '../../types/product';
import type { Sale, SaleHistoryEntry } from '../../types/sale';
import { SaleDetailPage } from './SaleDetailPage';

vi.mock('../../api/sales', () => ({
  getSale: vi.fn(),
  getSaleHistory: vi.fn(),
  cancelSale: vi.fn(),
  createReturn: vi.fn(),
  createExchange: vi.fn(),
  createCorrection: vi.fn(),
}));
vi.mock('../../api/catalog', () => ({
  listPaymentMethods: vi.fn(),
}));
vi.mock('../../api/products', () => ({
  listProducts: vi.fn(),
  getProduct: vi.fn(),
}));
vi.mock('../../api/inventory', () => ({
  listInventory: vi.fn(),
}));
vi.mock('../../lib/receipt', () => ({
  renderReceiptJpgDataUrl: vi.fn().mockResolvedValue('data:image/jpeg;base64,xyz'),
  shareOrDownloadDataUrl: vi.fn(),
}));

import { listPaymentMethods } from '../../api/catalog';
import { listInventory } from '../../api/inventory';
import { getProduct, listProducts } from '../../api/products';
import {
  cancelSale,
  createCorrection,
  createExchange,
  createReturn,
  getSale,
  getSaleHistory,
} from '../../api/sales';

const mockedGetSale = vi.mocked(getSale);
const mockedGetSaleHistory = vi.mocked(getSaleHistory);
const mockedCancelSale = vi.mocked(cancelSale);
const mockedCreateReturn = vi.mocked(createReturn);
const mockedCreateExchange = vi.mocked(createExchange);
const mockedCreateCorrection = vi.mocked(createCorrection);
const mockedListPaymentMethods = vi.mocked(listPaymentMethods);
const mockedListProducts = vi.mocked(listProducts);
const mockedGetProduct = vi.mocked(getProduct);
const mockedListInventory = vi.mocked(listInventory);

const BASE_SALE: Sale = {
  id: '1',
  saleNumber: '00001',
  saleDate: '2026-01-01T00:00:00.000Z',
  status: 'COMPLETED',
  paymentMethod: { id: '1', name: 'Efectivo' },
  notes: null,
  itemCount: 1,
  subtotal: '200',
  discountAmount: '0',
  shippingAmount: '0',
  total: '200',
  totalRefunded: '0',
  netTotal: '200',
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
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
};

const HISTORY: SaleHistoryEntry[] = [
  { type: 'CREATED', date: '2026-01-01T00:00:00.000Z', description: 'Venta #00001 creada.', by: null },
];

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/ventas/1']}>
        <Routes>
          <Route path="/ventas/:id" element={<SaleDetailPage />} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetSaleHistory.mockResolvedValue(HISTORY);
  mockedListPaymentMethods.mockResolvedValue([
    {
      id: '1',
      name: 'Efectivo',
      appliesToSales: true,
      appliesToPurchases: true,
      appliesToExpenses: true,
      isActive: true,
    },
  ]);
});

describe('SaleDetailPage — gestión posventa', () => {
  it('muestra el estado de la venta y las 4 acciones disponibles cuando está completada', async () => {
    mockedGetSale.mockResolvedValue(BASE_SALE);
    renderPage();

    expect(await screen.findByText('Completada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Corregir' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Devolver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeInTheDocument();
  });

  it('solo muestra Devolver y Cambiar cuando está parcialmente devuelta', async () => {
    mockedGetSale.mockResolvedValue({ ...BASE_SALE, status: 'PARTIALLY_RETURNED' });
    renderPage();

    await screen.findByText('Parcialmente devuelta');
    expect(screen.getByRole('button', { name: 'Devolver' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cambiar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Corregir' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar' })).not.toBeInTheDocument();
  });

  it('muestra el desglose de total/devuelto/neto cuando hubo una devolución', async () => {
    mockedGetSale.mockResolvedValue({
      ...BASE_SALE,
      status: 'PARTIALLY_RETURNED',
      total: '500',
      totalRefunded: '120',
      netTotal: '380',
    });
    renderPage();

    await screen.findByText('Parcialmente devuelta');
    expect(screen.getByText('Total de la venta')).toBeInTheDocument();
    expect(screen.getByText('Q500')).toBeInTheDocument();
    expect(screen.getByText('Devuelto')).toBeInTheDocument();
    expect(screen.getByText('− Q120')).toBeInTheDocument();
    expect(screen.getByText('Queda')).toBeInTheDocument();
    expect(screen.getByText('Q380')).toBeInTheDocument();
  });

  it('sin devoluciones solo muestra el total simple', async () => {
    mockedGetSale.mockResolvedValue(BASE_SALE);
    renderPage();

    await screen.findByText('Completada');
    expect(screen.getByText(/^Total:/)).toBeInTheDocument();
    expect(screen.queryByText('Devuelto')).not.toBeInTheDocument();
  });

  it('no muestra el panel de gestión cuando la venta ya está cancelada', async () => {
    mockedGetSale.mockResolvedValue({ ...BASE_SALE, status: 'CANCELLED' });
    renderPage();

    await screen.findByText('Cancelada');
    expect(screen.queryByText('Gestionar venta')).not.toBeInTheDocument();
  });

  it('cancela la venta tras confirmar y refresca el detalle', async () => {
    const user = userEvent.setup();
    mockedGetSale.mockResolvedValue(BASE_SALE);
    mockedCancelSale.mockResolvedValue({ ...BASE_SALE, status: 'CANCELLED' });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Cancelar' }));
    expect(
      await screen.findByText(/El inventario vendido será reintegrado/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancelar venta' }));

    expect(await screen.findByText('Venta cancelada correctamente.')).toBeInTheDocument();
    expect(await screen.findByText('Cancelada')).toBeInTheDocument();
    expect(mockedCancelSale).toHaveBeenCalledWith('1');
  });

  it('registra una devolución parcial', async () => {
    const user = userEvent.setup();
    mockedGetSale.mockResolvedValue(BASE_SALE);
    mockedCreateReturn.mockResolvedValue({ ...BASE_SALE, status: 'PARTIALLY_RETURNED' });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Devolver' }));
    const quantityInput = screen.getByLabelText(/Cantidad a devolver/);
    await user.type(quantityInput, '1');
    await user.click(screen.getByRole('button', { name: 'Registrar devolución' }));

    await vi.waitFor(() =>
      expect(mockedCreateReturn).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          items: [{ saleItemId: 1, quantity: 1, conditionStatus: 'SALEABLE' }],
        }),
      ),
    );
    expect(await screen.findByText('Devolución registrada correctamente.')).toBeInTheDocument();
  });

  it('corrige la cantidad de una línea', async () => {
    const user = userEvent.setup();
    mockedGetSale.mockResolvedValue(BASE_SALE);
    mockedGetProduct.mockResolvedValue({
      id: '10',
      code: 'BLU-0012',
      name: 'Blusa Satinada',
      description: null,
      category: { id: '1', name: 'Blusas' },
      cost: '60',
      salePrice: '100',
      recommendedPrice: '100',
      waistMeasurement: null,
      lengthMeasurement: null,
      isAvailableForSale: true,
      variantCount: 1,
      variants: [{ sizeId: '3', sizeName: 'M', colorId: '5', colorName: 'Beige' }],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    } satisfies Product);
    mockedCreateCorrection.mockResolvedValue({
      ...BASE_SALE,
      items: [{ ...BASE_SALE.items[0], quantity: 1, subtotal: '100' }],
      total: '100',
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Corregir' }));
    await user.selectOptions(
      screen.getByLabelText('Línea a corregir'),
      await screen.findByRole('option', { name: /Blusa Satinada/ }),
    );
    const quantityInput = await screen.findByLabelText('Cantidad');
    await user.clear(quantityInput);
    await user.type(quantityInput, '1');
    await user.click(screen.getByRole('button', { name: 'Guardar corrección' }));

    await vi.waitFor(() =>
      expect(mockedCreateCorrection).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ saleItemId: 1, newQuantity: 1, reason: 'Talla equivocada' }),
      ),
    );
    expect(await screen.findByText('Corrección registrada correctamente.')).toBeInTheDocument();
  });

  it('registra un cambio de variante', async () => {
    const user = userEvent.setup();
    mockedGetSale.mockResolvedValue(BASE_SALE);
    mockedListProducts.mockResolvedValue({
      items: [
        {
          id: '20',
          code: 'PAN-0001',
          name: 'Pantalón Negro',
          description: null,
          category: { id: '2', name: 'Pantalones' },
          cost: '60',
          salePrice: '100',
          recommendedPrice: '100',
          waistMeasurement: null,
          lengthMeasurement: null,
          isAvailableForSale: true,
          variantCount: 1,
          variants: [{ sizeId: '4', sizeName: 'L', colorId: '6', colorName: 'Negro' }],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const newVariant: InventoryItem = {
      id: '88',
      product: { id: '20', name: 'Pantalón Negro', code: 'PAN-0001' },
      sizeId: '4',
      sizeName: 'L',
      colorId: '6',
      colorName: 'Negro',
      quantity: 3,
      averageCost: '60',
      status: 'DISPONIBLE',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    mockedListInventory.mockResolvedValue({ items: [newVariant], total: 1, page: 1, pageSize: 20 });
    mockedCreateExchange.mockResolvedValue({ ...BASE_SALE, status: 'PARTIALLY_RETURNED' });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Cambiar' }));
    await user.selectOptions(
      screen.getByLabelText('Producto a cambiar'),
      await screen.findByRole('option', { name: /Blusa Satinada/ }),
    );
    await user.type(screen.getByLabelText('Buscar producto nuevo'), 'pantalon');
    await user.click(await screen.findByRole('button', { name: /Pantalón Negro/ }));
    await user.selectOptions(
      await screen.findByLabelText(/Nueva combinación/),
      await screen.findByRole('option', { name: /L\/Negro/ }),
    );

    await user.click(screen.getByRole('button', { name: 'Confirmar cambio' }));

    await vi.waitFor(() =>
      expect(mockedCreateExchange).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          items: [{ originalSaleItemId: 1, quantity: 1, newInventoryItemId: 88 }],
        }),
      ),
    );
    expect(await screen.findByText('Cambio registrado correctamente.')).toBeInTheDocument();
  });
});
