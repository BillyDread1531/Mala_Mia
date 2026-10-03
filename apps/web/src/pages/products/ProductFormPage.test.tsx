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
  createSize: vi.fn(),
  createColor: vi.fn(),
}));
vi.mock('../../api/products', () => ({
  checkDuplicates: vi.fn(),
  createProduct: vi.fn(),
  generateCode: vi.fn(),
  getProduct: vi.fn(),
  previewRecommendedPrice: vi.fn(),
  setProductActive: vi.fn(),
  updateProduct: vi.fn(),
}));
vi.mock('../../api/inventory', () => ({
  adjustInventoryVariant: vi.fn(),
  listGroupedInventory: vi.fn(),
}));

import { createColor, createSize, listCategories, listColors, listSizes } from '../../api/catalog';
import { adjustInventoryVariant, listGroupedInventory } from '../../api/inventory';
import {
  checkDuplicates,
  createProduct,
  generateCode,
  getProduct,
  previewRecommendedPrice,
  setProductActive,
  updateProduct,
} from '../../api/products';

const CATEGORIES: Category[] = [{ id: '1', name: 'Blusas', isActive: true }];
const SIZES: Size[] = [
  { id: '2', name: 'S', normalizedName: 'S', isActive: true },
  { id: '3', name: 'M', normalizedName: 'M', isActive: true },
];
const COLORS: Color[] = [
  { id: '5', name: 'Beige', normalizedName: 'BEIGE', isActive: true },
  { id: '3', name: 'Rojo', normalizedName: 'ROJO', isActive: true },
];

const mockedListCategories = vi.mocked(listCategories);
const mockedListSizes = vi.mocked(listSizes);
const mockedListColors = vi.mocked(listColors);
const mockedCreateSize = vi.mocked(createSize);
const mockedCreateColor = vi.mocked(createColor);
const mockedCheckDuplicates = vi.mocked(checkDuplicates);
const mockedCreateProduct = vi.mocked(createProduct);
const mockedGenerateCode = vi.mocked(generateCode);
const mockedGetProduct = vi.mocked(getProduct);
const mockedPreviewRecommendedPrice = vi.mocked(previewRecommendedPrice);
const mockedSetProductActive = vi.mocked(setProductActive);
const mockedUpdateProduct = vi.mocked(updateProduct);
const mockedAdjustInventoryVariant = vi.mocked(adjustInventoryVariant);
const mockedListGroupedInventory = vi.mocked(listGroupedInventory);

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
  mockedListGroupedInventory.mockResolvedValue([]);
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

  it('permite crear un color nuevo sin salir del formulario', async () => {
    const user = userEvent.setup();
    mockedCreateColor.mockResolvedValue({
      id: '9',
      name: 'Verde musgo',
      normalizedName: 'VERDE MUSGO',
      isActive: true,
    });
    renderCreatePage();

    await user.click(await screen.findByRole('button', { name: '+ Nuevo color' }));
    await user.type(screen.getByLabelText('Nombre del color'), 'Verde musgo');
    await user.click(screen.getByRole('button', { name: 'Agregar color' }));

    await vi.waitFor(() => expect(mockedCreateColor).toHaveBeenCalledWith('Verde musgo'));
    // El color nuevo aparece en la lista y queda seleccionado de una vez.
    const newColorChip = await screen.findByRole('button', { name: 'Verde musgo' });
    expect(newColorChip.className).toContain('is-active');
  });

  it('permite crear una talla nueva sin salir del formulario', async () => {
    const user = userEvent.setup();
    mockedCreateSize.mockResolvedValue({ id: '9', name: 'XXL', normalizedName: 'XXL', isActive: true });
    renderCreatePage();

    await user.click(await screen.findByRole('button', { name: '+ Nueva talla' }));
    await user.type(screen.getByLabelText('Nombre de la talla'), 'XXL');
    await user.click(screen.getByRole('button', { name: 'Agregar talla' }));

    await vi.waitFor(() => expect(mockedCreateSize).toHaveBeenCalledWith('XXL'));
    const newSizeChip = await screen.findByRole('button', { name: 'XXL' });
    expect(newSizeChip.className).toContain('is-active');
  });

  it('permite ingresar cantidad inicial opcional por combinación al crear', async () => {
    const user = userEvent.setup();
    mockedGenerateCode.mockResolvedValue({ code: 'BLU-0001' });
    mockedCreateProduct.mockResolvedValue({ id: '77' } as Product);
    mockedAdjustInventoryVariant.mockResolvedValue({} as never);
    renderCreatePage();

    await user.type(await screen.findByLabelText('Nombre'), 'Blusa Satinada');
    await user.selectOptions(screen.getByLabelText('Categoría'), '1');
    await user.click(screen.getByRole('button', { name: 'S' }));
    await user.click(screen.getByRole('button', { name: 'Beige' }));

    await user.type(await screen.findByLabelText('Cantidad S / Beige'), '10');
    await user.click(screen.getByRole('button', { name: 'Crear producto' }));

    await vi.waitFor(() =>
      expect(mockedAdjustInventoryVariant).toHaveBeenCalledWith({
        productId: 77,
        sizeId: 2,
        colorId: 5,
        quantityChange: 10,
        reason: 'Corrección de inventario',
        notes: 'Stock inicial al crear el producto.',
      }),
    );
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
    waistMeasurement: null,
    lengthMeasurement: null,
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

  it('guarda medidas de cintura/largo, y las borra si se dejan en blanco', async () => {
    const user = userEvent.setup();
    mockedGetProduct.mockResolvedValue({
      ...EXISTING_PRODUCT,
      waistMeasurement: '76',
      lengthMeasurement: '102',
    });
    mockedUpdateProduct.mockResolvedValue(EXISTING_PRODUCT);
    renderEditPage('9');

    expect(await screen.findByDisplayValue('76')).toBeInTheDocument();
    expect(screen.getByDisplayValue('102')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Cintura (cm)'));
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await vi.waitFor(() =>
      expect(mockedUpdateProduct).toHaveBeenCalledWith(
        '9',
        expect.objectContaining({ waistMeasurement: null, lengthMeasurement: 102 }),
      ),
    );
  });

  it('pide confirmación antes de desactivar y permite reactivar', async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockedGetProduct.mockResolvedValue(EXISTING_PRODUCT);
    mockedSetProductActive.mockResolvedValue({ ...EXISTING_PRODUCT, isAvailableForSale: false });
    renderEditPage('9');

    await screen.findByDisplayValue('Blusa Existente');
    await user.click(screen.getByRole('button', { name: 'Desactivar' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(mockedSetProductActive).toHaveBeenCalledWith('9', false);
    expect(await screen.findByRole('button', { name: 'Reactivar' })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('muestra las existencias actuales y permite ajustarlas con un motivo', async () => {
    const user = userEvent.setup();
    mockedGetProduct.mockResolvedValue(EXISTING_PRODUCT);
    mockedListGroupedInventory.mockResolvedValue([
      {
        inventoryItemId: '1',
        productId: '9',
        productName: 'Blusa Existente',
        productCode: 'BLU-0009',
        sizeId: '2',
        sizeName: 'S',
        colorId: '5',
        colorName: 'Beige',
        quantity: 4,
        averageCost: '50',
        status: 'DISPONIBLE',
      },
    ]);
    mockedAdjustInventoryVariant.mockResolvedValue({
      id: '1',
      product: { id: '9', name: 'Blusa Existente', code: 'BLU-0009' },
      sizeId: '2',
      sizeName: 'S',
      colorId: '5',
      colorName: 'Beige',
      quantity: 3,
      averageCost: '50',
      status: 'DISPONIBLE',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    renderEditPage('9');

    expect(await screen.findByText('4 u.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ajustar' }));
    await user.type(screen.getByLabelText('Ajuste (ej. -1 o 1)'), '-1');
    await user.selectOptions(screen.getByLabelText('Motivo'), 'Prenda perdida');
    await user.click(screen.getByRole('button', { name: 'Confirmar ajuste' }));

    await vi.waitFor(() =>
      expect(mockedAdjustInventoryVariant).toHaveBeenCalledWith({
        productId: 9,
        sizeId: 2,
        colorId: 5,
        quantityChange: -1,
        reason: 'Prenda perdida',
        notes: undefined,
      }),
    );
    expect(await screen.findByText('3 u.')).toBeInTheDocument();
  });

  it('no muestra existencias para una combinación recién marcada en esta edición', async () => {
    mockedGetProduct.mockResolvedValue(EXISTING_PRODUCT);
    mockedListGroupedInventory.mockResolvedValue([
      {
        inventoryItemId: '1',
        productId: '9',
        productName: 'Blusa Existente',
        productCode: 'BLU-0009',
        sizeId: '2',
        sizeName: 'S',
        colorId: '5',
        colorName: 'Beige',
        quantity: 4,
        averageCost: '50',
        status: 'DISPONIBLE',
      },
    ]);
    const user = userEvent.setup();
    renderEditPage('9');

    await screen.findByText('4 u.');
    await user.click(screen.getByRole('button', { name: 'M' }));
    await user.click(screen.getByRole('button', { name: 'Rojo' }));

    // La nueva combinación S y M / Rojo no aparece en "Existencias" todavía.
    expect(screen.queryByText('M / Rojo')).not.toBeInTheDocument();
  });
});
