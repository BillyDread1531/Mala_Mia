import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { PurchaseListResponse } from '../../types/purchase';
import type { SupplierListItem } from '../../types/supplier';
import { SupplierDetailPage } from './SupplierDetailPage';

vi.mock('../../api/suppliers', () => ({
  getSupplier: vi.fn(),
  updateSupplier: vi.fn(),
  setSupplierActive: vi.fn(),
}));
vi.mock('../../api/purchases', () => ({
  listPurchases: vi.fn(),
}));

import { listPurchases } from '../../api/purchases';
import { getSupplier, setSupplierActive, updateSupplier } from '../../api/suppliers';

const mockedGetSupplier = vi.mocked(getSupplier);
const mockedUpdateSupplier = vi.mocked(updateSupplier);
const mockedSetSupplierActive = vi.mocked(setSupplierActive);
const mockedListPurchases = vi.mocked(listPurchases);

const SUPPLIER: SupplierListItem = {
  id: '1',
  name: 'Boutique XY',
  phone: '12345678',
  whatsapp: null,
  contactPerson: null,
  address: null,
  social: null,
  notes: null,
  isActive: true,
  purchaseCount: 2,
  lastPurchaseDate: '2026-01-05T00:00:00.000Z',
  totalPurchased: '500',
};

const PURCHASES: PurchaseListResponse = {
  items: [
    {
      id: '10',
      purchaseNumber: '00010',
      purchaseDate: '2026-01-05T00:00:00.000Z',
      status: 'COMPLETED',
      supplier: { id: '1', name: 'Boutique XY' },
      paymentMethod: { id: '1', name: 'Efectivo' },
      notes: null,
      itemCount: 2,
      goodsTotal: '500',
      shippingCost: '0',
      totalCost: '500',
      items: [],
      createdAt: '2026-01-05T00:00:00.000Z',
    },
  ],
  total: 1,
  page: 1,
  pageSize: 50,
};

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/proveedores/1']}>
        <Routes>
          <Route path="/proveedores/:id" element={<SupplierDetailPage />} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetSupplier.mockResolvedValue(SUPPLIER);
  mockedListPurchases.mockResolvedValue(PURCHASES);
});

describe('SupplierDetailPage', () => {
  it('muestra los datos de contacto y las estadísticas de compra', async () => {
    renderPage();

    expect(await screen.findByDisplayValue('Boutique XY')).toBeInTheDocument();
    expect(screen.getByDisplayValue('12345678')).toBeInTheDocument();
    const stats = screen.getByText('Total comprado').closest('div') as HTMLElement;
    expect(stats.textContent).toContain('Q500');
    expect(screen.getByText('Compras').closest('div')?.textContent).toContain('2');
  });

  it('muestra el historial de compras con enlace a cada una', async () => {
    renderPage();

    const link = await screen.findByRole('link', { name: /Compra #00010/ });
    expect(link).toHaveAttribute('href', '/compras/10');
  });

  it('guarda los cambios de contacto', async () => {
    const user = userEvent.setup();
    mockedUpdateSupplier.mockResolvedValue({ ...SUPPLIER, whatsapp: '87654321' });
    renderPage();

    await screen.findByDisplayValue('Boutique XY');
    await user.type(screen.getByLabelText('WhatsApp'), '87654321');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await vi.waitFor(() =>
      expect(mockedUpdateSupplier).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ whatsapp: '87654321' }),
      ),
    );
  });

  it('pide confirmación antes de desactivar y conserva la identidad del proveedor', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockedSetSupplierActive.mockResolvedValue({ ...SUPPLIER, isActive: false });
    renderPage();

    await screen.findByDisplayValue('Boutique XY');
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));

    expect(confirmSpy).toHaveBeenCalled();
    await vi.waitFor(() => expect(mockedSetSupplierActive).toHaveBeenCalledWith('1', false));
    expect(await screen.findByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('muestra un estado vacío cuando el proveedor no tiene compras', async () => {
    mockedListPurchases.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 50 });
    renderPage();

    expect(await screen.findByText('Sin compras todavía')).toBeInTheDocument();
  });
});
