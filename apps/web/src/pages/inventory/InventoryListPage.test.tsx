import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { InventoryGroupedItem } from '../../types/inventory';
import { InventoryListPage } from './InventoryListPage';

vi.mock('../../api/inventory', () => ({
  listGroupedInventory: vi.fn(),
  adjustInventoryVariant: vi.fn(),
}));
vi.mock('../../api/catalog', () => ({
  listSizes: vi.fn(),
  listColors: vi.fn(),
  createSize: vi.fn(),
  createColor: vi.fn(),
}));
vi.mock('../../api/products', () => ({
  addProductVariants: vi.fn(),
}));

import { listColors, listSizes } from '../../api/catalog';
import { adjustInventoryVariant, listGroupedInventory } from '../../api/inventory';
import { addProductVariants } from '../../api/products';

const mockedListGroupedInventory = vi.mocked(listGroupedInventory);
const mockedAdjustInventoryVariant = vi.mocked(adjustInventoryVariant);
const mockedListSizes = vi.mocked(listSizes);
const mockedListColors = vi.mocked(listColors);
const mockedAddProductVariants = vi.mocked(addProductVariants);

const SAMPLE_ITEM: InventoryGroupedItem = {
  inventoryItemId: '1',
  productId: '1',
  productName: 'Blusa Satinada',
  productCode: 'BLU-0001',
  sizeId: '3',
  sizeName: 'M',
  colorId: '5',
  colorName: 'Beige',
  quantity: 3,
  averageCost: '65',
  status: 'DISPONIBLE',
};

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <InventoryListPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedListSizes.mockResolvedValue([
    { id: '3', name: 'M', normalizedName: 'M', isActive: true },
    { id: '4', name: 'L', normalizedName: 'L', isActive: true },
  ]);
  mockedListColors.mockResolvedValue([
    { id: '5', name: 'Beige', normalizedName: 'BEIGE', isActive: true },
    { id: '6', name: 'Rojo', normalizedName: 'ROJO', isActive: true },
  ]);
});

describe('InventoryListPage', () => {
  it('muestra un estado vacío cuando no hay inventario', async () => {
    mockedListGroupedInventory.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Sin productos para mostrar')).toBeInTheDocument();
  });

  it('agrupa por producto y muestra stock y estado (disponible/agotado)', async () => {
    mockedListGroupedInventory.mockResolvedValue([
      SAMPLE_ITEM,
      {
        ...SAMPLE_ITEM,
        inventoryItemId: null,
        sizeId: '4',
        sizeName: 'S',
        colorId: '6',
        colorName: 'Rojo',
        quantity: 0,
        status: 'AGOTADO',
      },
    ]);
    renderPage();

    expect(await screen.findByText('Blusa Satinada')).toBeInTheDocument();
    expect(screen.getByText('BLU-0001')).toBeInTheDocument();
    expect(screen.getByText(/Beige · 3 u\./)).toBeInTheDocument();
    expect(screen.getByText(/Rojo · 0 u\./)).toBeInTheDocument();
    // Solo la combinación con inventory_item existente tiene link de historial.
    expect(screen.getByRole('link', { name: 'Historial →' })).toHaveAttribute(
      'href',
      '/inventario/stock/1',
    );
  });

  it('busca por texto', async () => {
    const user = userEvent.setup();
    mockedListGroupedInventory.mockResolvedValue([]);
    renderPage();

    await screen.findByText('Sin productos para mostrar');
    await user.type(screen.getByLabelText('Buscar'), 'satin');

    await vi.waitFor(() =>
      expect(mockedListGroupedInventory).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'satin' }),
      ),
    );
  });

  it('permite ajustar una combinación sin inventario previo (bug crítico resuelto)', async () => {
    const user = userEvent.setup();
    const withoutStock: InventoryGroupedItem = {
      ...SAMPLE_ITEM,
      inventoryItemId: null,
      quantity: 0,
      status: 'AGOTADO',
    };
    mockedListGroupedInventory.mockResolvedValue([withoutStock]);
    mockedAdjustInventoryVariant.mockResolvedValue({
      id: '1',
      product: { id: '1', name: 'Blusa Satinada', code: 'BLU-0001' },
      sizeId: '3',
      sizeName: 'M',
      colorId: '5',
      colorName: 'Beige',
      quantity: 10,
      averageCost: '0',
      status: 'DISPONIBLE',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: /Beige · 0 u\./ }));
    await user.type(screen.getByLabelText('Ajuste (ej. -2 o 3)'), '10');
    await user.selectOptions(screen.getByLabelText('Motivo'), 'Corrección de inventario');
    await user.click(screen.getByRole('button', { name: 'Confirmar ajuste' }));

    await vi.waitFor(() =>
      expect(mockedAdjustInventoryVariant).toHaveBeenCalledWith({
        productId: 1,
        sizeId: 3,
        colorId: 5,
        quantityChange: 10,
        reason: 'Corrección de inventario',
        notes: undefined,
      }),
    );
  });

  it('permite declarar una combinación nueva con stock inicial, sin pasar por una compra', async () => {
    const user = userEvent.setup();
    mockedListGroupedInventory.mockResolvedValue([SAMPLE_ITEM]);
    mockedAddProductVariants.mockResolvedValue({} as never);
    mockedAdjustInventoryVariant.mockResolvedValue({
      id: '2',
      product: { id: '1', name: 'Blusa Satinada', code: 'BLU-0001' },
      sizeId: '4',
      sizeName: 'L',
      colorId: '6',
      colorName: 'Rojo',
      quantity: 8,
      averageCost: '0',
      status: 'DISPONIBLE',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    renderPage();

    await screen.findByText('Blusa Satinada');
    await user.click(screen.getByRole('button', { name: '+ Agregar talla/color nuevo' }));
    await user.selectOptions(screen.getByLabelText('Talla'), '4');
    await user.selectOptions(screen.getByLabelText('Color'), '6');
    await user.type(screen.getByLabelText('Cantidad inicial (opcional)'), '8');
    await user.click(screen.getByRole('button', { name: 'Agregar combinación' }));

    await vi.waitFor(() =>
      expect(mockedAddProductVariants).toHaveBeenCalledWith('1', [{ sizeId: 4, colorId: 6 }]),
    );
    expect(mockedAdjustInventoryVariant).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 1, sizeId: 4, colorId: 6, quantityChange: 8 }),
    );
  });
});
