import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { InventoryItem } from '../../types/inventory';
import { InventoryListPage } from './InventoryListPage';

vi.mock('../../api/inventory', () => ({
  listInventory: vi.fn(),
}));

import { listInventory } from '../../api/inventory';

const mockedListInventory = vi.mocked(listInventory);

const SAMPLE_ITEM: InventoryItem = {
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
});

describe('InventoryListPage', () => {
  it('muestra un estado vacío cuando no hay inventario', async () => {
    mockedListInventory.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('Sin existencias registradas')).toBeInTheDocument();
  });

  it('lista variantes con su stock y estado (disponible/agotado)', async () => {
    mockedListInventory.mockResolvedValue({
      items: [
        SAMPLE_ITEM,
        { ...SAMPLE_ITEM, id: '2', sizeName: 'S', colorName: 'Rojo', quantity: 0, status: 'AGOTADO' },
      ],
      total: 2,
      page: 1,
      pageSize: 20,
    });
    renderPage();

    expect(await screen.findByText('3 u.')).toBeInTheDocument();
    expect(screen.getByText('Disponible')).toBeInTheDocument();
    expect(screen.getByText('Agotado')).toBeInTheDocument();
  });

  it('busca por texto', async () => {
    const user = userEvent.setup();
    mockedListInventory.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();

    await screen.findByText('Sin existencias registradas');
    await user.type(screen.getByLabelText('Buscar'), 'satin');

    await vi.waitFor(() =>
      expect(mockedListInventory).toHaveBeenCalledWith(expect.objectContaining({ search: 'satin' })),
    );
  });
});
