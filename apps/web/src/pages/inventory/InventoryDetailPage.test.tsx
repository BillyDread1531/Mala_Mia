import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { InventoryItem, InventoryMovement } from '../../types/inventory';
import { InventoryDetailPage } from './InventoryDetailPage';

vi.mock('../../api/inventory', () => ({
  getInventoryItem: vi.fn(),
  adjustInventory: vi.fn(),
}));

import { adjustInventory, getInventoryItem } from '../../api/inventory';

const mockedGetInventoryItem = vi.mocked(getInventoryItem);
const mockedAdjustInventory = vi.mocked(adjustInventory);

const ITEM: InventoryItem = {
  id: '1',
  product: { id: '1', name: 'Blusa Satinada', code: 'BLU-0001' },
  sizeId: '3',
  sizeName: 'M',
  colorId: '5',
  colorName: 'Beige',
  quantity: 3,
  averageCost: '65',
  status: 'DISPONIBLE',
  updatedAt: '2026-09-30T00:00:00.000Z',
};

const MOVEMENTS: InventoryMovement[] = [
  {
    id: '1',
    movementType: 'ENTRADA',
    quantity: 3,
    quantityBefore: 0,
    quantityAfter: 3,
    unitCost: '65',
    referenceType: 'purchase',
    referenceId: '15',
    reason: null,
    notes: null,
    createdByName: 'Andrea',
    createdAt: '2026-09-30T00:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/inventario/stock/1']}>
        <Routes>
          <Route path="/inventario/stock/:id" element={<InventoryDetailPage />} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetInventoryItem.mockResolvedValue({ item: ITEM, movements: MOVEMENTS });
});

describe('InventoryDetailPage', () => {
  it('muestra el stock actual y el historial de movimientos', async () => {
    renderPage();

    expect(await screen.findByText('3 unidades')).toBeInTheDocument();
    expect(screen.getByText('Compra #15')).toBeInTheDocument();
    expect(screen.getByText('Entrada')).toBeInTheDocument();
  });

  it('permite ajustar el inventario y refresca el stock', async () => {
    const user = userEvent.setup();
    mockedAdjustInventory.mockResolvedValue({ ...ITEM, quantity: 2 });
    renderPage();

    await screen.findByText('3 unidades');
    await user.click(screen.getByRole('button', { name: 'Ajustar inventario' }));
    await user.type(screen.getByLabelText('Ajuste (ej. -2 o 3)'), '-1');
    await user.selectOptions(screen.getByLabelText('Motivo'), 'Error de conteo');

    expect(screen.getByText(/Nuevo stock:/)).toBeInTheDocument();

    mockedGetInventoryItem.mockResolvedValue({
      item: { ...ITEM, quantity: 2 },
      movements: MOVEMENTS,
    });
    await user.click(screen.getByRole('button', { name: 'Confirmar ajuste' }));

    await vi.waitFor(() =>
      expect(mockedAdjustInventory).toHaveBeenCalledWith('1', {
        quantityChange: -1,
        reason: 'Error de conteo',
        notes: undefined,
      }),
    );
    expect(await screen.findByText('2 unidades')).toBeInTheDocument();
  });
});
