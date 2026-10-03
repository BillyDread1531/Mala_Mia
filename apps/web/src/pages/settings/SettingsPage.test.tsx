import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../../auth/auth-context';
import { NotificationProvider } from '../../notifications/NotificationContext';
import { SettingsPage } from './SettingsPage';

vi.mock('../../api/settings', () => ({
  getGeneralSettings: vi.fn(),
  updateGeneralSettings: vi.fn(),
}));
vi.mock('../../api/catalog', () => ({
  listAllCategories: vi.fn(),
  listAllSizes: vi.fn(),
  listAllColors: vi.fn(),
  listAllPaymentMethods: vi.fn(),
  listAllExpenseCategories: vi.fn(),
  createCategory: vi.fn(),
  createSize: vi.fn(),
  createColor: vi.fn(),
  createExpenseCategory: vi.fn(),
  setCategoryActive: vi.fn(),
  setSizeActive: vi.fn(),
  setColorActive: vi.fn(),
  setPaymentMethodActive: vi.fn(),
  setExpenseCategoryActive: vi.fn(),
}));
vi.mock('../../api/users', () => ({
  listUsers: vi.fn(),
  setUserActive: vi.fn(),
}));
vi.mock('../../api/auth', () => ({
  changePassword: vi.fn(),
}));

import { changePassword } from '../../api/auth';
import {
  createCategory,
  listAllCategories,
  listAllColors,
  listAllExpenseCategories,
  listAllPaymentMethods,
  listAllSizes,
  setCategoryActive,
} from '../../api/catalog';
import { getGeneralSettings, updateGeneralSettings } from '../../api/settings';
import { listUsers } from '../../api/users';

const mockedGetGeneralSettings = vi.mocked(getGeneralSettings);
const mockedUpdateGeneralSettings = vi.mocked(updateGeneralSettings);
const mockedListAllCategories = vi.mocked(listAllCategories);
const mockedListAllSizes = vi.mocked(listAllSizes);
const mockedListAllColors = vi.mocked(listAllColors);
const mockedListAllPaymentMethods = vi.mocked(listAllPaymentMethods);
const mockedListAllExpenseCategories = vi.mocked(listAllExpenseCategories);
const mockedCreateCategory = vi.mocked(createCategory);
const mockedSetCategoryActive = vi.mocked(setCategoryActive);
const mockedListUsers = vi.mocked(listUsers);
const mockedChangePassword = vi.mocked(changePassword);

const SETTINGS = {
  businessName: 'MALA MÍA',
  receiptMessage: 'Gracias por tu compra. 💗',
  targetProfitMargin: 35,
  lowStockThreshold: 2,
  defaultShippingFee: 35,
};

function renderPage() {
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
          <SettingsPage />
        </MemoryRouter>
      </NotificationProvider>
    </AuthContext.Provider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetGeneralSettings.mockResolvedValue(SETTINGS);
  mockedListAllCategories.mockResolvedValue([{ id: '1', name: 'Blusas', isActive: true }]);
  mockedListAllSizes.mockResolvedValue([
    { id: '2', name: 'M', normalizedName: 'M', isActive: true },
  ]);
  mockedListAllColors.mockResolvedValue([
    { id: '5', name: 'Beige', normalizedName: 'BEIGE', isActive: true },
  ]);
  mockedListAllPaymentMethods.mockResolvedValue([
    {
      id: '1',
      name: 'Efectivo',
      appliesToSales: true,
      appliesToPurchases: true,
      appliesToExpenses: true,
      isActive: true,
    },
  ]);
  mockedListAllExpenseCategories.mockResolvedValue([
    { id: '1', name: 'Empaque', isActive: true },
  ]);
  mockedListUsers.mockResolvedValue([
    { id: '1', username: 'andrea', fullName: 'Andrea', role: 'ADMIN', isActive: true, createdAt: '2026-01-01' },
    { id: '2', username: 'billy', fullName: 'Billy', role: 'ADMIN', isActive: true, createdAt: '2026-01-01' },
  ]);
});

describe('SettingsPage', () => {
  it('muestra las 7 tarjetas de configuración', () => {
    renderPage();

    expect(screen.getByText('Negocio')).toBeInTheDocument();
    expect(screen.getByText('Ventas e inventario')).toBeInTheDocument();
    expect(screen.getByText('Finanzas')).toBeInTheDocument();
    expect(screen.getByText('Catálogo')).toBeInTheDocument();
    expect(screen.getByText('Métodos de pago')).toBeInTheDocument();
    expect(screen.getByText('Categorías de gastos')).toBeInTheDocument();
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('la tarjeta de Finanzas navega a /finanzas en vez de expandirse', () => {
    renderPage();
    const financeCard = screen.getByText('Finanzas').closest('div');
    const link = financeCard?.closest('.card')?.querySelector('a');
    expect(link).toHaveAttribute('href', '/finanzas');
  });

  it('abre Negocio, edita el nombre y guarda', async () => {
    const user = userEvent.setup();
    mockedUpdateGeneralSettings.mockResolvedValue({ ...SETTINGS, businessName: 'MALA MÍA 2' });
    renderPage();

    const businessCard = screen.getByText('Negocio').closest('.card') as HTMLElement;
    await user.click(within(businessCard).getByRole('button', { name: 'Administrar' }));

    const nameInput = await screen.findByLabelText('Nombre del negocio');
    await user.clear(nameInput);
    await user.type(nameInput, 'MALA MÍA 2');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await vi.waitFor(() =>
      expect(mockedUpdateGeneralSettings).toHaveBeenCalledWith(
        expect.objectContaining({ businessName: 'MALA MÍA 2' }),
      ),
    );
  });

  it('abre Catálogo y crea una categoría', async () => {
    const user = userEvent.setup();
    mockedCreateCategory.mockResolvedValue({ id: '2', name: 'Accesorios', isActive: true });
    renderPage();

    const catalogCard = screen.getByText('Catálogo').closest('.card') as HTMLElement;
    await user.click(within(catalogCard).getByRole('button', { name: 'Administrar' }));

    await screen.findByText('Blusas');
    const categoriesSection = screen.getByText('Categorías').closest('.settings__subsection') as HTMLElement;
    await user.type(within(categoriesSection).getByLabelText('Nueva categoría'), 'Accesorios');
    await user.click(within(categoriesSection).getByRole('button', { name: 'Crear' }));

    await vi.waitFor(() => expect(mockedCreateCategory).toHaveBeenCalledWith('Accesorios'));
    expect(await screen.findByText('Accesorios')).toBeInTheDocument();
  });

  it('desactivar una categoría pide confirmación', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();

    const catalogCard = screen.getByText('Catálogo').closest('.card') as HTMLElement;
    await user.click(within(catalogCard).getByRole('button', { name: 'Administrar' }));
    await screen.findByText('Blusas');

    const categoriesSection = screen.getByText('Categorías').closest('.settings__subsection') as HTMLElement;
    await user.click(within(categoriesSection).getByRole('button', { name: 'Desactivar' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockedSetCategoryActive).not.toHaveBeenCalled(); // canceló la confirmación
    confirmSpy.mockRestore();
  });

  it('en Usuarios, el propio usuario no puede desactivarse', async () => {
    const user = userEvent.setup();
    renderPage();

    const usersCard = screen.getByText('Usuarios').closest('.card') as HTMLElement;
    await user.click(within(usersCard).getByRole('button', { name: 'Administrar' }));

    await screen.findByText(/Andrea/);
    const andreaRow = screen.getByText(/Andrea \(tú\)/).closest('.settings__list-item') as HTMLElement;
    expect(within(andreaRow).getByRole('button', { name: 'Desactivar' })).toBeDisabled();

    const billyRow = screen.getByText('Billy').closest('.settings__list-item') as HTMLElement;
    expect(within(billyRow).getByRole('button', { name: 'Desactivar' })).not.toBeDisabled();
  });

  it('cambia la contraseña desde Usuarios', async () => {
    const user = userEvent.setup();
    mockedChangePassword.mockResolvedValue({ success: true });
    renderPage();

    const usersCard = screen.getByText('Usuarios').closest('.card') as HTMLElement;
    await user.click(within(usersCard).getByRole('button', { name: 'Administrar' }));
    await screen.findByText(/Andrea/);

    await user.type(screen.getByLabelText('Contraseña actual'), 'vieja-123');
    await user.type(screen.getByLabelText('Contraseña nueva'), 'nueva-12345678');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await vi.waitFor(() =>
      expect(mockedChangePassword).toHaveBeenCalledWith('vieja-123', 'nueva-12345678'),
    );
  });
});
