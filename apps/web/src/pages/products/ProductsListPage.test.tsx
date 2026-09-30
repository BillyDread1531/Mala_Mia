import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { Product } from '../../types/product';
import { ProductsListPage } from './ProductsListPage';

vi.mock('../../api/products', () => ({
  listProducts: vi.fn(),
}));

import { listProducts } from '../../api/products';

const mockedListProducts = vi.mocked(listProducts);

const SAMPLE_PRODUCT: Product = {
  id: '1',
  code: 'BLU-0001',
  name: 'Blusa Satinada',
  description: null,
  category: { id: '1', name: 'Blusas' },
  cost: '65',
  salePrice: '125',
  recommendedPrice: '100',
  isAvailableForSale: true,
  variantCount: 3,
  variants: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <ProductsListPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('ProductsListPage', () => {
  it('muestra un estado vacío cuando no hay productos', async () => {
    mockedListProducts.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('Todavía no hay productos')).toBeInTheDocument();
  });

  it('lista los productos devueltos por la API', async () => {
    mockedListProducts.mockResolvedValue({
      items: [SAMPLE_PRODUCT],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    renderPage();

    expect(await screen.findByText('Blusa Satinada')).toBeInTheDocument();
    expect(screen.getByText('BLU-0001')).toBeInTheDocument();
    expect(screen.getByText('Q125')).toBeInTheDocument();
  });

  it('busca productos según el texto ingresado', async () => {
    const user = userEvent.setup();
    mockedListProducts.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();

    await screen.findByText('Todavía no hay productos');
    await user.type(screen.getByLabelText('Buscar'), 'satin');

    await vi.waitFor(() => {
      expect(mockedListProducts).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'satin' }),
      );
    });
  });
});
