import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { Sale } from '../../types/sale';
import { ReceiptsPage } from './ReceiptsPage';

vi.mock('../../api/sales', () => ({
  listSales: vi.fn(),
  getSale: vi.fn(),
}));
vi.mock('../../api/settings', () => ({
  getGeneralSettings: vi.fn(),
}));
vi.mock('../../lib/receipt', () => ({
  renderReceiptJpgDataUrl: vi.fn().mockResolvedValue('data:image/jpeg;base64,xyz'),
  shareOrDownloadDataUrl: vi.fn(),
}));

import { getSale, listSales } from '../../api/sales';
import { getGeneralSettings } from '../../api/settings';
import { renderReceiptJpgDataUrl, shareOrDownloadDataUrl } from '../../lib/receipt';

const mockedListSales = vi.mocked(listSales);
const mockedGetSale = vi.mocked(getSale);
const mockedGetGeneralSettings = vi.mocked(getGeneralSettings);
const mockedRender = vi.mocked(renderReceiptJpgDataUrl);
const mockedShare = vi.mocked(shareOrDownloadDataUrl);

const SALE: Sale = {
  id: '1',
  saleNumber: '00001',
  saleDate: '2026-01-05T10:30:00.000Z',
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
  items: [],
  createdAt: '2026-01-05T10:30:00.000Z',
};

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <ReceiptsPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedListSales.mockResolvedValue({ items: [SALE], total: 1, page: 1, pageSize: 30 });
  mockedGetSale.mockResolvedValue(SALE);
  mockedGetGeneralSettings.mockResolvedValue({
    businessName: 'MALA MÍA',
    receiptMessage: 'Gracias',
    targetProfitMargin: 35,
    lowStockThreshold: 2,
    defaultShippingFee: 35,
  });
  mockedRender.mockResolvedValue('data:image/jpeg;base64,xyz');
});

describe('ReceiptsPage', () => {
  it('lista las ventas con enlace al detalle', async () => {
    renderPage();

    const link = await screen.findByRole('link', { name: /Venta #00001/ });
    expect(link).toHaveAttribute('href', '/ventas/1');
  });

  it('comparte el comprobante reutilizando la configuración vigente', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Compartir' }));

    expect(mockedGetSale).toHaveBeenCalledWith('1');
    expect(mockedRender).toHaveBeenCalledWith(SALE, {
      businessName: 'MALA MÍA',
      receiptMessage: 'Gracias',
    });
    expect(mockedShare).toHaveBeenCalledWith(
      'data:image/jpeg;base64,xyz',
      'venta-00001.jpg',
      'Venta #00001',
    );
  });

  it('busca por número de venta', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByRole('link', { name: /Venta #00001/ });
    await user.type(screen.getByLabelText('Buscar'), '00001');

    await vi.waitFor(() =>
      expect(mockedListSales).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: '00001' }),
      ),
    );
  });

  it('muestra un estado vacío cuando no hay ventas', async () => {
    mockedListSales.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 30 });
    renderPage();

    expect(await screen.findByText('Todavía no hay comprobantes')).toBeInTheDocument();
  });
});
