import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import { ExpenseFormPage } from './ExpenseFormPage';

vi.mock('../../api/catalog', () => ({
  listExpenseCategories: vi.fn(),
  listPaymentMethods: vi.fn(),
}));
vi.mock('../../api/expenses', () => ({
  createExpense: vi.fn(),
}));

import { listExpenseCategories, listPaymentMethods } from '../../api/catalog';
import { createExpense } from '../../api/expenses';

const mockedListExpenseCategories = vi.mocked(listExpenseCategories);
const mockedListPaymentMethods = vi.mocked(listPaymentMethods);
const mockedCreateExpense = vi.mocked(createExpense);

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/finanzas/gastos/nuevo']}>
        <Routes>
          <Route path="/finanzas/gastos/nuevo" element={<ExpenseFormPage />} />
          <Route path="/finanzas" element={<div>Pantalla de Finanzas</div>} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedListExpenseCategories.mockResolvedValue([
    { id: '1', name: 'Empaque', isActive: true },
  ]);
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

describe('ExpenseFormPage', () => {
  it('valida los campos requeridos antes de enviar', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Empaque');
    await user.click(screen.getByRole('button', { name: 'Registrar gasto' }));

    expect(mockedCreateExpense).not.toHaveBeenCalled();
  });

  it('registra el gasto y navega a Finanzas', async () => {
    const user = userEvent.setup();
    mockedCreateExpense.mockResolvedValue({
      id: '1',
      category: { id: '1', name: 'Empaque' },
      description: 'Bolsas de papel',
      amount: '50',
      expenseDate: '2026-01-01T00:00:00.000Z',
      paymentMethod: { id: '1', name: 'Efectivo' },
      notes: null,
      status: 'COMPLETED',
      createdByName: 'Andrea',
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    renderPage();

    await user.selectOptions(await screen.findByLabelText('Categoría'), '1');
    await user.type(screen.getByLabelText('Monto (Q)'), '50');
    await user.type(
      screen.getByLabelText('¿En qué se usó el dinero?'),
      'Bolsas de papel',
    );
    await user.selectOptions(screen.getByLabelText('Forma de pago'), '1');

    await user.click(screen.getByRole('button', { name: 'Registrar gasto' }));

    await vi.waitFor(() =>
      expect(mockedCreateExpense).toHaveBeenCalledWith(
        expect.objectContaining({
          categoryId: 1,
          description: 'Bolsas de papel',
          amount: 50,
          paymentMethodId: 1,
        }),
      ),
    );
    expect(await screen.findByText('Pantalla de Finanzas')).toBeInTheDocument();
  });
});
