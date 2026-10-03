import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { Sale } from '../../types/sale';
import { SalesListPage } from './SalesListPage';

vi.mock('../../api/sales', () => ({
  listSales: vi.fn(),
}));

import { listSales } from '../../api/sales';

const mockedListSales = vi.mocked(listSales);

const SAMPLE_SALE: Sale = {
  id: '1',
  saleNumber: '00001',
  saleDate: '2026-01-01T00:00:00.000Z',
  status: 'COMPLETED',
  paymentMethod: { id: '1', name: 'Efectivo' },
  notes: null,
  itemCount: 2,
  subtotal: '250',
  discountAmount: '0',
  shippingAmount: '0',
  total: '250',
  totalRefunded: '0',
  netTotal: '250',
  items: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <SalesListPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('SalesListPage', () => {
  it('muestra un estado vacío cuando no hay ventas', async () => {
    mockedListSales.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('Todavía no hay ventas')).toBeInTheDocument();
  });

  it('lista ventas con su total', async () => {
    mockedListSales.mockResolvedValue({ items: [SAMPLE_SALE], total: 1, page: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('Venta #00001')).toBeInTheDocument();
    expect(screen.getByText('Q250')).toBeInTheDocument();
  });

  it('busca por número de venta', async () => {
    const user = userEvent.setup();
    mockedListSales.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();

    await screen.findByText('Todavía no hay ventas');
    await user.type(screen.getByLabelText('Buscar'), '00001');

    await vi.waitFor(() =>
      expect(mockedListSales).toHaveBeenCalledWith(expect.objectContaining({ search: '00001' })),
    );
  });

  it('"Más filtros" permite filtrar por rango de fechas', async () => {
    const user = userEvent.setup();
    mockedListSales.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();

    await screen.findByText('Todavía no hay ventas');
    await user.click(screen.getByRole('button', { name: 'Más filtros' }));
    await user.type(screen.getByLabelText('Desde'), '2026-01-01');
    await user.type(screen.getByLabelText('Hasta'), '2026-01-31');

    await vi.waitFor(() =>
      expect(mockedListSales).toHaveBeenCalledWith(
        expect.objectContaining({ from: '2026-01-01', to: '2026-01-31' }),
      ),
    );
  });
});
