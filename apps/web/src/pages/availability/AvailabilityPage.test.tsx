import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { AvailabilityItem } from '../../types/availability';
import { AvailabilityPage } from './AvailabilityPage';

vi.mock('../../api/availability', () => ({
  listAvailability: vi.fn(),
}));
vi.mock('../../api/catalog', () => ({
  listCategories: vi.fn(),
  listSizes: vi.fn(),
  listColors: vi.fn(),
}));

import { listCategories, listColors, listSizes } from '../../api/catalog';
import { listAvailability } from '../../api/availability';

const mockedListAvailability = vi.mocked(listAvailability);
const mockedListCategories = vi.mocked(listCategories);
const mockedListSizes = vi.mocked(listSizes);
const mockedListColors = vi.mocked(listColors);

const ITEMS: AvailabilityItem[] = [
  {
    productId: '1',
    productName: 'Blusa Básica',
    productCode: 'BLU-0001',
    categoryId: '1',
    categoryName: 'Blusas',
    sizeId: '2',
    sizeName: 'M',
    colorId: '5',
    colorName: 'Beige',
    quantity: 3,
    salePrice: '125',
    waistMeasurement: null,
    lengthMeasurement: null,
    status: 'DISPONIBLE',
  },
  {
    productId: '1',
    productName: 'Blusa Básica',
    productCode: 'BLU-0001',
    categoryId: '1',
    categoryName: 'Blusas',
    sizeId: '2',
    sizeName: 'M',
    colorId: '6',
    colorName: 'Rojo',
    quantity: 0,
    salePrice: '125',
    waistMeasurement: null,
    lengthMeasurement: null,
    status: 'AGOTADO',
  },
  {
    productId: '1',
    productName: 'Blusa Básica',
    productCode: 'BLU-0001',
    categoryId: '1',
    categoryName: 'Blusas',
    sizeId: '3',
    sizeName: 'L',
    colorId: '7',
    colorName: 'Negro',
    quantity: 1,
    salePrice: '125',
    waistMeasurement: null,
    lengthMeasurement: null,
    status: 'STOCK_BAJO',
  },
];

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <AvailabilityPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedListCategories.mockResolvedValue([{ id: '1', name: 'Blusas', isActive: true }]);
  mockedListSizes.mockResolvedValue([
    { id: '2', name: 'M', normalizedName: 'M', isActive: true },
    { id: '3', name: 'L', normalizedName: 'L', isActive: true },
  ]);
  mockedListColors.mockResolvedValue([
    { id: '5', name: 'Beige', normalizedName: 'BEIGE', isActive: true },
  ]);
});

describe('AvailabilityPage', () => {
  it('carga la disponibilidad y muestra el resumen de contadores', async () => {
    mockedListAvailability.mockResolvedValue({
      items: ITEMS,
      total: 3,
      page: 1,
      pageSize: 200,
      summary: { products: 1, available: 1, lowStock: 1, outOfStock: 1 },
    });
    renderPage();

    expect(await screen.findByText('Blusa Básica')).toBeInTheDocument();
    // Resumen recalculado en el cliente a partir de los items recibidos.
    const stats = screen.getAllByText('1');
    expect(stats.length).toBeGreaterThanOrEqual(3); // productos, pocas, agotadas
  });

  it('agrupa por producto y luego por talla', async () => {
    mockedListAvailability.mockResolvedValue({
      items: ITEMS,
      total: 3,
      page: 1,
      pageSize: 200,
      summary: { products: 1, available: 1, lowStock: 1, outOfStock: 1 },
    });
    renderPage();

    await screen.findByText('Blusa Básica');
    expect(screen.getByText('M')).toBeInTheDocument();
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('Beige · 3')).toBeInTheDocument();
    expect(screen.getByText('Rojo · Agotado')).toBeInTheDocument();
    expect(screen.getByText('Negro · 1')).toBeInTheDocument();
  });

  it('muestra las medidas de cintura/largo bajo el código cuando el producto las tiene', async () => {
    mockedListAvailability.mockResolvedValue({
      items: [{ ...ITEMS[0], waistMeasurement: '76', lengthMeasurement: '102' }],
      total: 1,
      page: 1,
      pageSize: 200,
      summary: { products: 1, available: 1, lowStock: 0, outOfStock: 0 },
    });
    renderPage();

    expect(await screen.findByText('Cintura 76cm · Largo 102cm')).toBeInTheDocument();
  });

  it('la búsqueda filtra al instante sin volver a pedir datos al backend', async () => {
    const user = userEvent.setup();
    mockedListAvailability.mockResolvedValue({
      items: ITEMS,
      total: 3,
      page: 1,
      pageSize: 200,
      summary: { products: 1, available: 1, lowStock: 1, outOfStock: 1 },
    });
    renderPage();

    await screen.findByText('Beige · 3');
    await user.type(screen.getByLabelText('Buscar'), 'rojo');

    expect(screen.queryByText('Beige · 3')).not.toBeInTheDocument();
    expect(screen.getByText('Rojo · Agotado')).toBeInTheDocument();
    expect(mockedListAvailability).toHaveBeenCalledTimes(1); // sin refetch
  });

  it('el filtro de categoría vuelve a pedir datos al backend', async () => {
    const user = userEvent.setup();
    mockedListAvailability.mockResolvedValue({
      items: ITEMS,
      total: 3,
      page: 1,
      pageSize: 200,
      summary: { products: 1, available: 1, lowStock: 1, outOfStock: 1 },
    });
    renderPage();

    await screen.findByText('Blusa Básica');
    await user.click(screen.getByRole('button', { name: /Filtros/ }));
    await user.selectOptions(screen.getByLabelText('Categoría'), '1');

    await vi.waitFor(() =>
      expect(mockedListAvailability).toHaveBeenCalledWith(
        expect.objectContaining({ categoryId: 1 }),
      ),
    );
  });

  it('muestra un estado vacío cuando no hay resultados', async () => {
    mockedListAvailability.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 200,
      summary: { products: 0, available: 0, lowStock: 0, outOfStock: 0 },
    });
    renderPage();

    expect(await screen.findByText('Sin resultados')).toBeInTheDocument();
  });

  it('muestra un estado de error de carga con reintento', async () => {
    mockedListAvailability.mockRejectedValue(new Error('network down'));
    renderPage();

    expect(await screen.findByText('No se pudo cargar la disponibilidad')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });
});
