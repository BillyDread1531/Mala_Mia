import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { Consumable } from '../../types/consumable';
import { ConsumablesPage } from './ConsumablesPage';

vi.mock('../../api/consumables', () => ({
  listConsumables: vi.fn(),
  createConsumable: vi.fn(),
  updateConsumable: vi.fn(),
  setConsumableActive: vi.fn(),
  adjustConsumable: vi.fn(),
}));
vi.mock('../../api/catalog', () => ({
  listPaymentMethods: vi.fn(),
}));

import {
  adjustConsumable,
  createConsumable,
  listConsumables,
  setConsumableActive,
} from '../../api/consumables';
import { listPaymentMethods } from '../../api/catalog';

const mockedListConsumables = vi.mocked(listConsumables);
const mockedCreateConsumable = vi.mocked(createConsumable);
const mockedSetConsumableActive = vi.mocked(setConsumableActive);
const mockedAdjustConsumable = vi.mocked(adjustConsumable);
const mockedListPaymentMethods = vi.mocked(listPaymentMethods);

const CONSUMABLES: Consumable[] = [
  {
    id: '1',
    name: 'Bolsas de papel',
    quantity: 20,
    lowStockThreshold: 5,
    unitsPerSale: 1,
    isActive: true,
    status: 'DISPONIBLE',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    name: 'Cintas',
    quantity: 0,
    lowStockThreshold: 5,
    unitsPerSale: 1,
    isActive: false,
    status: 'AGOTADO',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <ConsumablesPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedListConsumables.mockResolvedValue(CONSUMABLES);
  mockedListPaymentMethods.mockResolvedValue([
    { id: '1', name: 'Efectivo', appliesToSales: true, appliesToPurchases: true, appliesToExpenses: true, isActive: true },
  ]);
});

describe('ConsumablesPage', () => {
  it('muestra los insumos con su cantidad y estado', async () => {
    renderPage();

    expect(await screen.findByText('Bolsas de papel')).toBeInTheDocument();
    expect(screen.getByText(/20 u\. · Disponible/)).toBeInTheDocument();
    expect(screen.getByText('Cintas')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('muestra un estado vacío cuando no hay insumos', async () => {
    mockedListConsumables.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Todavía no hay insumos')).toBeInTheDocument();
  });

  it('"Nuevo insumo" permite agregar uno desde la lista', async () => {
    const user = userEvent.setup();
    mockedCreateConsumable.mockResolvedValue({
      id: '3',
      name: 'Etiquetas',
      quantity: 100,
      lowStockThreshold: 5,
      unitsPerSale: 1,
      isActive: true,
      status: 'DISPONIBLE',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    renderPage();

    await screen.findByText('Bolsas de papel');
    await user.click(screen.getByRole('button', { name: 'Nuevo insumo' }));
    await user.type(screen.getByLabelText('Nombre'), 'Etiquetas');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(mockedCreateConsumable).toHaveBeenCalledWith({
      name: 'Etiquetas',
      quantity: undefined,
      lowStockThreshold: 5,
      unitsPerSale: 1,
      cost: undefined,
      paymentMethodId: undefined,
    });
  });

  it('"Ajustar stock" cambia la cantidad de un insumo', async () => {
    const user = userEvent.setup();
    mockedAdjustConsumable.mockResolvedValue({ ...CONSUMABLES[0], quantity: 25 });
    renderPage();

    await screen.findByText('Bolsas de papel');
    const row = screen.getByText('Bolsas de papel').closest('li') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Ajustar stock' }));
    await user.type(within(row).getByLabelText('Ajuste (ej. -5 o 50)'), '5');
    await user.click(within(row).getByRole('button', { name: 'Confirmar' }));

    expect(mockedAdjustConsumable).toHaveBeenCalledWith('1', {
      quantityChange: 5,
      cost: undefined,
      paymentMethodId: undefined,
    });
  });

  it('al agregar stock positivo, permite registrar el costo y la forma de pago como gasto', async () => {
    const user = userEvent.setup();
    mockedAdjustConsumable.mockResolvedValue({ ...CONSUMABLES[0], quantity: 70 });
    renderPage();

    await screen.findByText('Bolsas de papel');
    const row = screen.getByText('Bolsas de papel').closest('li') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Ajustar stock' }));
    await user.type(within(row).getByLabelText('Ajuste (ej. -5 o 50)'), '50');

    expect(within(row).getByLabelText('Costo total (opcional)')).toBeInTheDocument();
    await user.type(within(row).getByLabelText('Costo total (opcional)'), '120');
    await user.selectOptions(within(row).getByLabelText('Forma de pago'), '1');
    await user.click(within(row).getByRole('button', { name: 'Confirmar' }));

    expect(mockedAdjustConsumable).toHaveBeenCalledWith('1', {
      quantityChange: 50,
      cost: 120,
      paymentMethodId: 1,
    });
  });

  it('"Reactivar" cambia el estado de un insumo inactivo', async () => {
    const user = userEvent.setup();
    mockedSetConsumableActive.mockResolvedValue({ ...CONSUMABLES[1], isActive: true });
    renderPage();

    await screen.findByText('Cintas');
    const row = screen.getByText('Cintas').closest('li') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Reactivar' }));

    expect(mockedSetConsumableActive).toHaveBeenCalledWith('2', true);
  });
});
