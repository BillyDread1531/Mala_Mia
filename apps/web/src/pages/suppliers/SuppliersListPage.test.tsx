import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { SupplierListItem } from '../../types/supplier';
import { SuppliersListPage } from './SuppliersListPage';

vi.mock('../../api/suppliers', () => ({
  listAllSuppliers: vi.fn(),
  createSupplier: vi.fn(),
}));

import { createSupplier, listAllSuppliers } from '../../api/suppliers';

const mockedListAllSuppliers = vi.mocked(listAllSuppliers);
const mockedCreateSupplier = vi.mocked(createSupplier);

const SUPPLIERS: SupplierListItem[] = [
  {
    id: '1',
    name: 'Boutique XY',
    phone: null,
    whatsapp: null,
    contactPerson: null,
    address: null,
    social: null,
    notes: null,
    isActive: true,
    purchaseCount: 3,
    lastPurchaseDate: '2026-01-05T00:00:00.000Z',
    totalPurchased: '900',
  },
  {
    id: '2',
    name: 'Textiles Inactivos',
    phone: null,
    whatsapp: null,
    contactPerson: null,
    address: null,
    social: null,
    notes: null,
    isActive: false,
    purchaseCount: 0,
    lastPurchaseDate: null,
    totalPurchased: '0',
  },
];

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <SuppliersListPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedListAllSuppliers.mockResolvedValue(SUPPLIERS);
});

describe('SuppliersListPage', () => {
  it('muestra los proveedores activos con sus estadísticas de compra', async () => {
    renderPage();

    expect(await screen.findByText('Boutique XY')).toBeInTheDocument();
    expect(screen.getByText('3 compras')).toBeInTheDocument();
    expect(screen.getByText('Q900')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Boutique XY/ })).toHaveAttribute(
      'href',
      '/proveedores/1',
    );
  });

  it('oculta los proveedores inactivos por defecto', async () => {
    renderPage();

    await screen.findByText('Boutique XY');
    expect(screen.queryByText('Textiles Inactivos')).not.toBeInTheDocument();
  });

  it('"Mostrar inactivos" revela los proveedores desactivados', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Boutique XY');
    await user.click(screen.getByLabelText('Mostrar inactivos'));

    expect(await screen.findByText('Textiles Inactivos')).toBeInTheDocument();
    expect(screen.getByText('Inactivo')).toBeInTheDocument();
  });

  it('filtra por nombre', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Boutique XY');
    await user.type(screen.getByLabelText('Buscar'), 'xy');

    expect(screen.getByText('Boutique XY')).toBeInTheDocument();
  });

  it('muestra un estado vacío cuando no hay proveedores', async () => {
    mockedListAllSuppliers.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Todavía no hay proveedores')).toBeInTheDocument();
  });

  it('"Nuevo proveedor" permite agregar uno desde la lista', async () => {
    const user = userEvent.setup();
    mockedCreateSupplier.mockResolvedValue({
      id: '3',
      name: 'Proveedor Nuevo',
      phone: null,
      whatsapp: null,
      contactPerson: null,
      address: null,
      social: null,
      notes: null,
      isActive: true,
    });
    renderPage();

    await screen.findByText('Boutique XY');
    await user.click(screen.getByRole('button', { name: 'Nuevo proveedor' }));
    await user.type(screen.getByLabelText('Nombre del proveedor'), 'Proveedor Nuevo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Proveedor Nuevo')).toBeInTheDocument();
    expect(mockedCreateSupplier).toHaveBeenCalledWith({ name: 'Proveedor Nuevo' });
  });
});
