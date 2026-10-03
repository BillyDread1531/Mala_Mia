import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/auth-context';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { FinanceMovement, FinanceSummary } from '../../types/finance';
import type { InventoryReport, SalesReport } from '../../types/reports';
import { DashboardPage } from './DashboardPage';

vi.mock('../../api/finance', () => ({
  getFinanceSummary: vi.fn(),
  listFinanceMovements: vi.fn(),
}));
vi.mock('../../api/reports', () => ({
  getSalesReport: vi.fn(),
  getInventoryReport: vi.fn(),
}));

import { getFinanceSummary, listFinanceMovements } from '../../api/finance';
import { getInventoryReport, getSalesReport } from '../../api/reports';

const mockedGetFinanceSummary = vi.mocked(getFinanceSummary);
const mockedGetSalesReport = vi.mocked(getSalesReport);
const mockedGetInventoryReport = vi.mocked(getInventoryReport);
const mockedListFinanceMovements = vi.mocked(listFinanceMovements);

function financeSummary(realProfit: string): FinanceSummary {
  return {
    period: { from: '2026-01-01', to: '2026-01-02', label: 'Hoy' },
    ingresos: '0',
    salidas: '0',
    disponible: '0',
    netSales: '0',
    cogs: '0',
    breakdown: {
      ventas: '0',
      devoluciones: '0',
      cancelaciones: '0',
      correcciones: '0',
      cambios: '0',
      compras: '0',
      gastos: '0',
      ingresoManual: '0',
    },
    distribution: {
      hasProfit: Number(realProfit) > 0,
      realProfit,
      personalPercentage: '50',
      reinvestmentPercentage: '30',
      reservePercentage: '20',
      personalAmount: '0',
      reinvestmentAmount: '0',
      reserveAmount: '0',
    },
  };
}

function salesReport(count: number, gross: string, cancellations: string): SalesReport {
  return {
    period: { from: '2026-01-01', to: '2026-01-02', label: 'Hoy' },
    salesCount: count,
    unitsSold: count,
    grossTotal: gross,
    discountsTotal: '0',
    cancellationsCount: 0,
    cancellationsTotal: cancellations,
    returnsTotal: '0',
    byDay: [],
    byPaymentMethod: [],
    topProducts: [],
    topProductsByProfit: [],
  };
}

const INVENTORY: InventoryReport = {
  totalUnits: 40,
  productsCount: 5,
  availableCount: 10,
  lowStockCount: 3,
  outOfStockCount: 2,
  approxValue: '1000',
  lowStockItems: [],
  lowStockConsumables: [],
};

const MOVEMENTS: FinanceMovement[] = [
  {
    id: '1',
    movementType: 'SALE',
    direction: 'IN',
    amount: '150',
    paymentMethod: { id: '1', name: 'Efectivo' },
    referenceType: 'sale',
    referenceId: '10',
    description: 'Venta #00010',
    movementDate: '2026-01-02T00:00:00.000Z',
    createdByName: 'Andrea',
  },
];

function renderDashboard() {
  return render(
    <AuthContext.Provider
      value={{
        status: 'authenticated',
        user: { id: '1', username: 'andrea', fullName: 'Andrea', role: 'ADMIN' },
        login: vi.fn(),
        logout: vi.fn(),
      }}
    >
      <NotificationProvider>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </NotificationProvider>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetFinanceSummary.mockImplementation((params) =>
    Promise.resolve(financeSummary(params.period === 'month' ? '800' : '120')),
  );
  mockedGetSalesReport.mockImplementation((params) =>
    Promise.resolve(
      params.period === 'month' ? salesReport(20, '2000', '0') : salesReport(3, '300', '50'),
    ),
  );
  mockedGetInventoryReport.mockResolvedValue(INVENTORY);
  mockedListFinanceMovements.mockResolvedValue({
    items: MOVEMENTS,
    total: 10,
    page: 1,
    pageSize: 5,
  });
});

describe('DashboardPage', () => {
  it('muestra el estado de carga antes de recibir los datos', () => {
    renderDashboard();
    expect(document.querySelectorAll('.stat-card__skeleton').length).toBeGreaterThan(0);
  });

  it('con actividad real: no muestra el estado vacío y sí la actividad reciente', async () => {
    renderDashboard();

    expect(await screen.findByText('Actividad reciente')).toBeInTheDocument();
    expect(screen.queryByText('Todavía no hay actividad registrada')).not.toBeInTheDocument();
    expect(screen.getByText('Venta #00010', { exact: false })).toBeInTheDocument();
  });

  it('sin actividad: muestra el estado vacío real, no un placeholder falso', async () => {
    mockedListFinanceMovements.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 5 });
    renderDashboard();

    expect(await screen.findByText('Todavía no hay actividad registrada')).toBeInTheDocument();
    expect(screen.queryByText('Actividad reciente')).not.toBeInTheDocument();
  });

  it('muestra las métricas de ventas de hoy (cantidad y total activo, sin las canceladas)', async () => {
    renderDashboard();

    expect(await screen.findByText('Ventas de hoy')).toBeInTheDocument();
    // grossTotal 300 - cancellationsTotal 50 = 250 realmente vendidos
    expect(await screen.findByText('Q250 vendidos hoy')).toBeInTheDocument();
  });

  it('muestra la ganancia real de hoy y del mes usando la utilidad real de Finanzas', async () => {
    renderDashboard();

    await screen.findByText('Ganancia de hoy');
    expect(screen.getByText('Q120')).toBeInTheDocument();
    expect(screen.getByText('Q800')).toBeInTheDocument();
  });

  it('muestra el inventario (productos y unidades)', async () => {
    renderDashboard();

    await screen.findByText('Productos en inventario');
    const section = screen.getByText('Productos en inventario').closest('.stat-card') as HTMLElement;
    expect(section.textContent).toContain('5');
    expect(section.textContent).toContain('40 unidades');
  });

  it('muestra stock bajo y agotados reutilizando disponibilidad', async () => {
    renderDashboard();

    await screen.findByText('Alertas de stock bajo');
    const section = screen
      .getByText('Alertas de stock bajo')
      .closest('.stat-card') as HTMLElement;
    expect(section.textContent).toContain('3');
    expect(section.textContent).toContain('2 agotados');
  });

  it('las acciones rápidas siguen siendo accesibles y navegables', async () => {
    renderDashboard();

    await screen.findByText('Acciones rápidas');
    expect(screen.getByRole('link', { name: /Nueva venta/ })).toHaveAttribute(
      'href',
      '/ventas/nueva',
    );
  });

  it('si una fuente falla, el resto del dashboard sigue mostrando datos reales', async () => {
    mockedGetInventoryReport.mockRejectedValue(new Error('network error'));
    renderDashboard();

    // Las métricas de ventas (otra fuente) siguen cargando con normalidad.
    expect(await screen.findByText('Q250 vendidos hoy')).toBeInTheDocument();
    // El inventario, cuya fuente falló, no queda en blanco ni rompe la pantalla.
    const inventoryCard = screen
      .getByText('Productos en inventario')
      .closest('.stat-card') as HTMLElement;
    expect(inventoryCard.textContent).toContain('—');
  });

  it('el enlace de actividad reciente navega a los movimientos completos', async () => {
    renderDashboard();

    const link = await screen.findByRole('link', { name: 'Ver todos' });
    expect(link).toHaveAttribute('href', '/finanzas/movimientos');
  });
});
