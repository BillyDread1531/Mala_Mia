import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { FinanceMovement, FinanceSummary } from '../../types/finance';
import type { DistributionSettings } from '../../types/finance';
import { FinancePage } from './FinancePage';

vi.mock('../../api/finance', () => ({
  getFinanceSummary: vi.fn(),
  listFinanceMovements: vi.fn(),
  getDistributionSettings: vi.fn(),
  updateDistributionSettings: vi.fn(),
}));

import {
  getDistributionSettings,
  getFinanceSummary,
  listFinanceMovements,
  updateDistributionSettings,
} from '../../api/finance';

const mockedGetSummary = vi.mocked(getFinanceSummary);
const mockedListMovements = vi.mocked(listFinanceMovements);
const mockedGetSettings = vi.mocked(getDistributionSettings);
const mockedUpdateSettings = vi.mocked(updateDistributionSettings);

const SUMMARY: FinanceSummary = {
  period: { from: '2026-01-01', to: '2026-01-08', label: 'Esta semana' },
  ingresos: '500',
  salidas: '200',
  disponible: '1000',
  netSales: '500',
  cogs: '200',
  breakdown: {
    ventas: '500',
    devoluciones: '0',
    cancelaciones: '0',
    correcciones: '0',
    cambios: '0',
    compras: '100',
    gastos: '100',
    ingresoManual: '0',
  },
  distribution: {
    hasProfit: true,
    realProfit: '300',
    personalPercentage: '50',
    reinvestmentPercentage: '30',
    reservePercentage: '20',
    personalAmount: '150',
    reinvestmentAmount: '90',
    reserveAmount: '60',
  },
};

const SETTINGS: DistributionSettings = {
  personalPercentage: '50',
  reinvestmentPercentage: '30',
  reservePercentage: '20',
  updatedAt: '2026-01-01T00:00:00.000Z',
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

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <FinancePage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetSummary.mockResolvedValue(SUMMARY);
  mockedListMovements.mockResolvedValue({ items: MOVEMENTS, total: 1, page: 1, pageSize: 5 });
  mockedGetSettings.mockResolvedValue(SETTINGS);
});

describe('FinancePage', () => {
  it('muestra ingresos, salidas y el resultado del período', async () => {
    renderPage();

    expect(await screen.findByText('Q500')).toBeInTheDocument();
    expect(screen.getByText('Q200')).toBeInTheDocument();
    expect(screen.getByText('Q300')).toBeInTheDocument();
    expect(screen.getByText('Resultado del período')).toBeInTheDocument();
  });

  it('cuando el resultado del período es negativo, lo marca visualmente', async () => {
    mockedGetSummary.mockResolvedValue({ ...SUMMARY, ingresos: '200', salidas: '500' });
    renderPage();

    expect(await screen.findByText('-Q300')).toBeInTheDocument();
    expect(screen.getByText('Resultado del período')).toBeInTheDocument();
  });

  it('muestra la distribución mi dinero vs reinversión', async () => {
    renderPage();

    await screen.findByText('Mi dinero vs. reinversión');
    expect(screen.getByText('Q150')).toBeInTheDocument(); // para mí
    expect(screen.getByText('Q90')).toBeInTheDocument(); // reinversión
    expect(screen.getByText('Q60')).toBeInTheDocument(); // reserva
  });

  it('el desglose está oculto por defecto y se puede expandir', async () => {
    renderPage();

    await screen.findByText('Ver desglose ↓');
    expect(screen.queryByText('Ventas')).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(screen.getByText('Ver desglose ↓'));

    expect(screen.getByText('Ventas')).toBeInTheDocument();
    expect(screen.getByText('Compras de mercadería')).toBeInTheDocument();
  });

  it('muestra los movimientos recientes', async () => {
    renderPage();

    expect(await screen.findByText('Venta #00010', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver todos' })).toHaveAttribute(
      'href',
      '/finanzas/movimientos',
    );
  });

  it('cambiar el periodo vuelve a pedir el resumen', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Q500');
    await user.selectOptions(screen.getByLabelText('Periodo'), 'month');

    await vi.waitFor(() =>
      expect(mockedGetSummary).toHaveBeenCalledWith(
        expect.objectContaining({ period: 'month' }),
      ),
    );
  });

  it('permite ajustar la distribución y valida que sume 100%', async () => {
    const user = userEvent.setup();
    mockedUpdateSettings.mockResolvedValue({
      personalPercentage: '60',
      reinvestmentPercentage: '20',
      reservePercentage: '20',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    renderPage();

    await screen.findByText('Mi dinero vs. reinversión');
    await user.click(screen.getByRole('button', { name: 'Ajustar distribución' }));

    const personalInput = await screen.findByLabelText('Para mí (%)');
    await user.clear(personalInput);
    await user.type(personalInput, '60');
    await user.clear(screen.getByLabelText('Reinversión (%)'));
    await user.type(screen.getByLabelText('Reinversión (%)'), '20');

    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    await vi.waitFor(() =>
      expect(mockedUpdateSettings).toHaveBeenCalledWith({
        personalPercentage: 60,
        reinvestmentPercentage: 20,
        reservePercentage: 20,
      }),
    );
  });
});
