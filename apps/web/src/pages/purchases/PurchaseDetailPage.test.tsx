import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { Purchase } from '../../types/purchase';
import { PurchaseDetailPage } from './PurchaseDetailPage';

vi.mock('../../api/purchases', () => ({
  getPurchase: vi.fn(),
}));
vi.mock('../../api/settings', () => ({
  getGeneralSettings: vi.fn(),
}));
vi.mock('../../lib/receipt', () => ({
  renderPurchaseReceiptJpgDataUrl: vi.fn().mockResolvedValue('data:image/jpeg;base64,xyz'),
  shareOrDownloadDataUrl: vi.fn(),
}));

import { getPurchase } from '../../api/purchases';
import { getGeneralSettings } from '../../api/settings';
import { renderPurchaseReceiptJpgDataUrl, shareOrDownloadDataUrl } from '../../lib/receipt';

const mockedGetPurchase = vi.mocked(getPurchase);
const mockedGetGeneralSettings = vi.mocked(getGeneralSettings);
const mockedRender = vi.mocked(renderPurchaseReceiptJpgDataUrl);
const mockedShare = vi.mocked(shareOrDownloadDataUrl);

const BASE_PURCHASE: Purchase = {
  id: '1',
  purchaseNumber: '00001',
  purchaseDate: '2026-01-02T09:00:00.000Z',
  status: 'COMPLETED',
  supplier: { id: '1', name: 'Textiles del Valle' },
  paymentMethod: { id: '1', name: 'Transferencia' },
  notes: null,
  itemCount: 1,
  goodsTotal: '300',
  shippingCost: '0',
  totalCost: '300',
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
      quantity: 5,
      unitCost: '60',
      subtotal: '300',
    },
  ],
  createdAt: '2026-01-02T09:00:00.000Z',
};

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/compras/1']}>
        <Routes>
          <Route path="/compras/:id" element={<PurchaseDetailPage />} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetPurchase.mockResolvedValue(BASE_PURCHASE);
  mockedGetGeneralSettings.mockResolvedValue({
    businessName: 'MALA MÍA',
    receiptMessage: 'Gracias por tu compra. 💗',
    targetProfitMargin: 35,
    lowStockThreshold: 2,
    defaultShippingFee: 35,
  });
  mockedRender.mockResolvedValue('data:image/jpeg;base64,xyz');
});

describe('PurchaseDetailPage', () => {
  it('muestra el detalle de la compra', async () => {
    renderPage();
    expect(await screen.findByText('Textiles del Valle')).toBeInTheDocument();
    expect(screen.getByText(/Total:/).parentElement).toHaveTextContent('Q300');
  });

  it('comparte el comprobante con la configuración de negocio vigente', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole('button', { name: 'Compartir comprobante' }),
    );

    expect(mockedGetGeneralSettings).toHaveBeenCalled();
    expect(mockedRender).toHaveBeenCalledWith(
      BASE_PURCHASE,
      { businessName: 'MALA MÍA', receiptMessage: 'Gracias por tu compra. 💗' },
    );
    expect(mockedShare).toHaveBeenCalledWith(
      'data:image/jpeg;base64,xyz',
      'compra-00001.jpg',
      'Compra #00001',
    );
  });
});
