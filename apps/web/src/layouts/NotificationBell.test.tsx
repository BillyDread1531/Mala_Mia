import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InventoryReport } from '../types/reports';
import { NotificationBell } from './NotificationBell';

vi.mock('../api/reports', () => ({
  getInventoryReport: vi.fn(),
}));

import { getInventoryReport } from '../api/reports';

const mockedGetInventoryReport = vi.mocked(getInventoryReport);

const EMPTY_REPORT: InventoryReport = {
  totalUnits: 0,
  productsCount: 0,
  availableCount: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  approxValue: '0',
  lowStockItems: [],
  lowStockConsumables: [],
};

function renderBell() {
  return render(
    <MemoryRouter>
      <NotificationBell />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
  mockedGetInventoryReport.mockResolvedValue(EMPTY_REPORT);
});

describe('NotificationBell', () => {
  it('sin alertas no muestra insignia', async () => {
    renderBell();

    await vi.waitFor(() => expect(mockedGetInventoryReport).toHaveBeenCalled());
    expect(screen.queryByText(/^\d+$/)).not.toBeInTheDocument();
  });

  it('muestra la insignia y las alertas de stock bajo/agotado', async () => {
    const user = userEvent.setup();
    mockedGetInventoryReport.mockResolvedValue({
      ...EMPTY_REPORT,
      lowStockItems: [
        {
          productId: '1',
          productName: 'Blusa Satinada',
          sizeName: 'M',
          colorName: 'Beige',
          quantity: 1,
          status: 'STOCK_BAJO',
        },
        {
          productId: '2',
          productName: 'Falda Plisada',
          sizeName: 'S',
          colorName: 'Negro',
          quantity: 0,
          status: 'AGOTADO',
        },
      ],
    });
    renderBell();

    expect(await screen.findByText('2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(await screen.findByText(/Blusa Satinada/)).toBeInTheDocument();
    expect(screen.getByText('1 u.')).toBeInTheDocument();
    expect(screen.getByText(/Falda Plisada/)).toBeInTheDocument();
    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Blusa Satinada/ })).toHaveAttribute(
      'href',
      '/disponibilidad/1',
    );
  });

  it('muestra alertas de insumos (bolsas/empaque) junto a las de productos', async () => {
    const user = userEvent.setup();
    mockedGetInventoryReport.mockResolvedValue({
      ...EMPTY_REPORT,
      lowStockConsumables: [{ id: '5', name: 'Bolsas', quantity: 0, status: 'AGOTADO' }],
    });
    renderBell();

    expect(await screen.findByText('1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(await screen.findByText(/Insumo: Bolsas/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Insumo: Bolsas/ })).toHaveAttribute(
      'href',
      '/insumos',
    );
  });

  it('sin alertas, el panel dice que no hay nada', async () => {
    const user = userEvent.setup();
    renderBell();

    await user.click(screen.getByRole('button', { name: 'Notificaciones' }));

    expect(await screen.findByText('No tienes alertas por ahora.')).toBeInTheDocument();
  });

  it('"Marcar todas como leídas" las oculta hasta que cambien', async () => {
    const user = userEvent.setup();
    const item = {
      productId: '1',
      productName: 'Blusa Satinada',
      sizeName: 'M',
      colorName: 'Beige',
      quantity: 1,
      status: 'STOCK_BAJO' as const,
    };
    mockedGetInventoryReport.mockResolvedValue({ ...EMPTY_REPORT, lowStockItems: [item] });
    renderBell();

    expect(await screen.findByText('1')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Notificaciones' }));
    await user.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));

    expect(screen.getByText('No tienes alertas por ahora.')).toBeInTheDocument();
    expect(screen.queryByText('1')).not.toBeInTheDocument();

    // Persiste entre renders (localStorage): sigue leída al recargar.
    mockedGetInventoryReport.mockResolvedValue({ ...EMPTY_REPORT, lowStockItems: [item] });
    renderBell();
    await vi.waitFor(() => expect(mockedGetInventoryReport).toHaveBeenCalled());
    expect(screen.queryByText('1')).not.toBeInTheDocument();
  });

  it('una alerta leída reaparece si su cantidad cambia', async () => {
    const user = userEvent.setup();
    const item = {
      productId: '1',
      productName: 'Blusa Satinada',
      sizeName: 'M',
      colorName: 'Beige',
      quantity: 1,
      status: 'STOCK_BAJO' as const,
    };
    mockedGetInventoryReport.mockResolvedValue({ ...EMPTY_REPORT, lowStockItems: [item] });
    renderBell();

    await screen.findByText('1');
    await user.click(screen.getByRole('button', { name: 'Notificaciones' }));
    await user.click(screen.getByRole('button', { name: 'Marcar todas como leídas' }));
    expect(screen.getByText('No tienes alertas por ahora.')).toBeInTheDocument();

    // La misma combinación, pero con cantidad distinta: ya no es "lo mismo visto".
    mockedGetInventoryReport.mockResolvedValue({
      ...EMPTY_REPORT,
      lowStockItems: [{ ...item, quantity: 0, status: 'AGOTADO' }],
    });
    renderBell();

    expect(await screen.findByText('1')).toBeInTheDocument();
  });
});
