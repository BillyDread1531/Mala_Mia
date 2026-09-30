import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { Category, Color, Size } from '../../types/catalog';
import type { Product } from '../../types/product';
import { ProductFormPage } from './ProductFormPage';

vi.mock('../../api/catalog', () => ({
  listCategories: vi.fn(),
  listSizes: vi.fn(),
  listColors: vi.fn(),
}));
vi.mock('../../api/products', () => ({
  checkDuplicates: vi.fn(),
  createProduct: vi.fn(),
  generateCode: vi.fn(),
  getProduct: vi.fn(),
  previewRecommendedPrice: vi.fn(),
  updateProduct: vi.fn(),
}));

import { listCategories, listColors, listSizes } from '../../api/catalog';
import {
  checkDuplicates,
  createProduct,
  generateCode,
  getProduct,
  previewRecommendedPrice,
  updateProduct,
} from '../../api/products';

const CATEGORIES: Category[] = [{ id: '1', name: 'Blusas' }];
const SIZES: Size[] = [
  { id: '2', name: 'S' },
  { id: '3', name: 'M' },
];
const COLORS: Color[] = [
  { id: '5', name: 'Beige' },
  { id: '3', name: 'Rojo' },
];

const mockedListCategories = vi.mocked(listCategories);
const mockedListSizes = vi.mocked(listSizes);
const mockedListColors = vi.mocked(listColors);
const mockedCheckDuplicates = vi.mocked(checkDuplicates);
const mockedCreateProduct = vi.mocked(createProduct);
const mockedGenerateCode = vi.mocked(generateCode);
const mockedGetProduct = vi.mocked(getProduct);
const mockedPreviewRecommendedPrice = vi.mocked(previewRecommendedPrice);
const mockedUpdateProduct = vi.mocked(updateProduct);

function renderCreatePage() {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/inventario/nuevo']}>
        <Routes>
          <Route path="/inventario/nuevo" element={<ProductFormPage />} />
          <Route path="/inventario/:id" element={<ProductFormPage />} />
          <Route path="/inventario" element={<div>Lista de productos</div>} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>,
  );
}

function renderEditPage(id: string) {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={[`/inventario/${id}`]}>
        <Routes>
          <Route path="/inventario/nuevo" element={<ProductFormPage />} />
          <Route path="/inventario/:id" element={<ProductFormPage />} />
          <Route path="/inventario" element={<div>Lista de productos</div>} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedListCategories.mockResolvedValue(CATEGORIES);
  mockedListSizes.mockResolvedValue(SIZES);
  mockedListColors.mockResolvedValue(COLORS);
  mockedCheckDuplicates.mockResolvedValue([]);
});

describe('ProductFormPage (crear)', () => {
  it('renderiza los campos principales del formulario', async () => {
    renderCreatePage();

    expect(await screen.findByLabelText('Nombre')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoría')).toBeInTheDocument();
    expect(screen.getByLabelText('Código')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear producto' })).toBeInTheDocument();
  });

  it('rechaza el envío sin nombre ni categoría', async () => {
    const user = userEvent.setup();
    renderCreatePage();
    await screen.findByLabelText('Nombre');

    await user.click(screen.getByRole('button', { name: 'Crear producto' }));

    expect(await screen.findByText('Escribe un nombre de al menos 2 letras.')).toBeInTheDocument();
    expect(screen.getByText('Selecciona una categoría.')).toBeInTheDocument();
    expect(mockedCreateProduct).not.toHaveBeenCalled();
  });

  it('genera el código automáticamente al elegir categoría', async () => {
    const user = userEvent.setup();
    mockedGenerateCode.mockResolvedValue({ code: 'BLU-0001' });
    renderCreatePage();

    await user.selectOptions(await screen.findByLabelText('Categoría'), '1');

    expect(await screen.findByDisplayValue('BLU-0001')).toBeInTheDocument();
  });

  it('muestra el precio recomendado en vivo al escribir el costo', async () => {
    const user = userEvent.setup();
    mockedPreviewRecommendedPrice.mockResolvedValue({ recommendedPrice: '100' });
    renderCreatePage();

    await user.type(await screen.findByLabelText('Costo actual (Q)'), '65');

    expect(await screen.findByText('Q100')).toBeInTheDocument();
    expect(mockedPreviewRecommendedPrice).toHaveBeenCalledWith(65);
  });

  it('permite elegir tallas/colores y togglear combinaciones específicas', async () => {
    const user = userEvent.setup();
    renderCreatePage();

    await user.click(await screen.findByRole('button', { name: 'S' }));
    await user.click(screen.getByRole('button', { name: 'M' }));
    await user.click(screen.getByRole('button', { name: 'Beige' }));
    await user.click(screen.getByRole('button', { name: 'Rojo' }));

    expect(screen.getByText('Desmarca las combinaciones que no manejas:')).toBeInTheDocument();
    // Selector de color "Beige" + una fila de combinación por cada talla (S y M).
    expect(screen.getAllByText('Beige')).toHaveLength(3);
  });

  it('crea el producto con las combinaciones activas y navega al listado', async () => {
    const user = userEvent.setup();
    mockedGenerateCode.mockResolvedValue({ code: 'BLU-0001' });
    mockedCreateProduct.mockResolvedValue({} as Product);
    renderCreatePage();

    await user.type(await screen.findByLabelText('Nombre'), 'Blusa Satinada');
    await user.selectOptions(screen.getByLabelText('Categoría'), '1');
    await screen.findByDisplayValue('BLU-0001');
    await user.click(screen.getByRole('button', { name: 'S' }));
    await user.click(screen.getByRole('button', { name: 'Beige' }));

    await user.click(screen.getByRole('button', { name: 'Crear producto' }));

    await vi.waitFor(() => expect(mockedCreateProduct).toHaveBeenCalledTimes(1));
    expect(mockedCreateProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Blusa Satinada',
        categoryId: 1,
        variants: [{ sizeId: 2, colorId: 5 }],
      }),
    );
    expect(await screen.findByText('Lista de productos')).toBeInTheDocument();
  });
});

describe('ProductFormPage (editar)', () => {
  const EXISTING_PRODUCT: Product = {
    id: '9',
    code: 'BLU-0009',
    name: 'Blusa Existente',
    description: 'Una blusa',
    category: { id: '1', name: 'Blusas' },
    cost: '50',
    salePrice: '90',
    recommendedPrice: '76.92',
    isAvailableForSale: true,
    variantCount: 1,
    variants: [{ sizeId: '2', sizeName: 'S', colorId: '5', colorName: 'Beige' }],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('precarga los datos del producto existente', async () => {
    mockedGetProduct.mockResolvedValue(EXISTING_PRODUCT);
    renderEditPage('9');

    expect(await screen.findByDisplayValue('Blusa Existente')).toBeInTheDocument();
    expect(screen.getByDisplayValue('BLU-0009')).toBeInTheDocument();
    expect(screen.getByDisplayValue('50')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument();
  });

  it('guarda los cambios con updateProduct', async () => {
    const user = userEvent.setup();
    mockedGetProduct.mockResolvedValue(EXISTING_PRODUCT);
    mockedUpdateProduct.mockResolvedValue(EXISTING_PRODUCT);
    renderEditPage('9');

    await screen.findByDisplayValue('Blusa Existente');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await vi.waitFor(() => expect(mockedUpdateProduct).toHaveBeenCalledTimes(1));
    expect(mockedUpdateProduct).toHaveBeenCalledWith('9', expect.objectContaining({ name: 'Blusa Existente' }));
  });
});
