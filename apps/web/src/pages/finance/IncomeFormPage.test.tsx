import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import { IncomeFormPage } from './IncomeFormPage';

vi.mock('../../api/catalog', () => ({
  listPaymentMethods: vi.fn(),
}));
vi.mock('../../api/finance', () => ({
  createManualIncome: vi.fn(),
}));

import { listPaymentMethods } from '../../api/catalog';
import { createManualIncome } from '../../api/finance';

const mockedListPaymentMethods = vi.mocked(listPaymentMethods);
const mockedCreateManualIncome = vi.mocked(createManualIncome);

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/finanzas/ingresos/nuevo']}>
        <Routes>
          <Route path="/finanzas/ingresos/nuevo" element={<IncomeFormPage />} />
          <Route path="/finanzas" element={<div>Pantalla de Finanzas</div>} />
        </Routes>
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

describe('IncomeFormPage', () => {
  it('valida los campos requeridos antes de enviar', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByLabelText('Forma de pago');
    await user.click(screen.getByRole('button', { name: 'Registrar ingreso' }));

    expect(mockedCreateManualIncome).not.toHaveBeenCalled();
  });

  it('registra el ingreso y navega a Finanzas', async () => {
    const user = userEvent.setup();
    mockedCreateManualIncome.mockResolvedValue({
      id: '1',
      movementType: 'MANUAL_INCOME',
      direction: 'IN',
      amount: '1000',
      paymentMethod: { id: '1', name: 'Efectivo' },
      referenceType: null,
      referenceId: null,
      description: 'Inyección de capital',
      movementDate: '2026-01-01T00:00:00.000Z',
      createdByName: 'Andrea',
    });
    renderPage();

    await user.type(await screen.findByLabelText('Monto (Q)'), '1000');
    await user.selectOptions(screen.getByLabelText('Forma de pago'), '1');
    await user.type(
      screen.getByLabelText('¿De dónde viene el dinero?'),
      'Inyección de capital',
    );

    await user.click(screen.getByRole('button', { name: 'Registrar ingreso' }));

    await vi.waitFor(() =>
      expect(mockedCreateManualIncome).toHaveBeenCalledWith({
        description: 'Inyección de capital',
        amount: 1000,
        paymentMethodId: 1,
      }),
    );
    expect(await screen.findByText('Pantalla de Finanzas')).toBeInTheDocument();
  });
});
