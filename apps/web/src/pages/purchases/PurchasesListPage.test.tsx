import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { Purchase } from '../../types/purchase';
import { PurchasesListPage } from './PurchasesListPage';

vi.mock('../../api/purchases', () => ({
  listPurchases: vi.fn(),
}));

import { listPurchases } from '../../api/purchases';

const mockedListPurchases = vi.mocked(listPurchases);

const SAMPLE_PURCHASE: Purchase = {
  id: '1',
  purchaseNumber: '00001',
  purchaseDate: '2026-09-30T00:00:00.000Z',
  status: 'COMPLETED',
  supplier: { id: '1', name: 'Boutique XX' },
  paymentMethod: { id: '1', name: 'Efectivo' },
  notes: null,
  itemCount: 3,
  goodsTotal: '390',
  shippingCost: '0',
  totalCost: '390',
  items: [],
  createdAt: '2026-09-30T00:00:00.000Z',
};

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <PurchasesListPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('PurchasesListPage', () => {
  it('muestra un estado vacío cuando no hay compras', async () => {
    mockedListPurchases.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('Todavía no hay compras')).toBeInTheDocument();
  });

  it('lista las compras con proveedor y total', async () => {
    mockedListPurchases.mockResolvedValue({
      items: [SAMPLE_PURCHASE],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    renderPage();

    expect(await screen.findByText('Compra #00001')).toBeInTheDocument();
    expect(screen.getByText('Boutique XX')).toBeInTheDocument();
    expect(screen.getByText('Q390')).toBeInTheDocument();
  });
});
