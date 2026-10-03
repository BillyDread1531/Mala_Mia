import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { FinanceMovement } from '../../types/finance';
import { FinanceMovementsPage } from './FinanceMovementsPage';

vi.mock('../../api/finance', () => ({
  listFinanceMovements: vi.fn(),
}));
vi.mock('../../api/catalog', () => ({
  listPaymentMethods: vi.fn(),
}));

import { listPaymentMethods } from '../../api/catalog';
import { listFinanceMovements } from '../../api/finance';

const mockedListMovements = vi.mocked(listFinanceMovements);
const mockedListPaymentMethods = vi.mocked(listPaymentMethods);

const MOVEMENT: FinanceMovement = {
  id: '1',
  movementType: 'EXPENSE',
  direction: 'OUT',
  amount: '50',
  paymentMethod: { id: '1', name: 'Efectivo' },
  referenceType: 'expense',
  referenceId: '3',
  description: 'Gasto: Bolsas',
  movementDate: '2026-01-02T00:00:00.000Z',
  createdByName: 'Andrea',
};

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <FinanceMovementsPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
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

describe('FinanceMovementsPage', () => {
  it('lista los movimientos', async () => {
    mockedListMovements.mockResolvedValue({ items: [MOVEMENT], total: 1, page: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('Gasto: Bolsas', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Q50', { exact: false })).toBeInTheDocument();
  });

  it('muestra un estado vacío', async () => {
    mockedListMovements.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('Sin movimientos')).toBeInTheDocument();
  });

  it('filtra por búsqueda', async () => {
    const user = userEvent.setup();
    mockedListMovements.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();

    await screen.findByText('Sin movimientos');
    await user.type(screen.getByLabelText('Buscar'), 'bolsas');

    await vi.waitFor(() =>
      expect(mockedListMovements).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'bolsas' }),
      ),
    );
  });

  it('filtra por tipo de movimiento', async () => {
    const user = userEvent.setup();
    mockedListMovements.mockResolvedValue({ items: [MOVEMENT], total: 1, page: 1, pageSize: 20 });
    renderPage();

    await screen.findByText('Gasto: Bolsas', { exact: false });
    await user.selectOptions(screen.getByLabelText('Tipo'), 'EXPENSE');

    await vi.waitFor(() =>
      expect(mockedListMovements).toHaveBeenLastCalledWith(
        expect.objectContaining({ movementType: 'EXPENSE' }),
      ),
    );
  });
});
