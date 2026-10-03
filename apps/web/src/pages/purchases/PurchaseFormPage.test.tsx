import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { Category, Color, PaymentMethod, Size } from '../../types/catalog';
import type { Product } from '../../types/product';
import type { Purchase } from '../../types/purchase';
import type { Supplier } from '../../types/supplier';
import { PurchaseFormPage } from './PurchaseFormPage';

vi.mock('../../api/catalog', () => ({
  listCategories: vi.fn(),
  listSizes: vi.fn(),
  listColors: vi.fn(),
  listPaymentMethods: vi.fn(),
  createSize: vi.fn(),
  createColor: vi.fn(),
}));
vi.mock('../../api/suppliers', () => ({
  listSuppliers: vi.fn(),
  createSupplier: vi.fn(),
}));
vi.mock('../../api/products', () => ({
  listProducts: vi.fn(),
  checkDuplicates: vi.fn(),
  createProduct: vi.fn(),
  generateCode: vi.fn(),
  previewRecommendedPrice: vi.fn(),
  addProductVariants: vi.fn(),
  updateProduct: vi.fn(),
}));
vi.mock('../../api/purchases', () => ({
  createPurchase: vi.fn(),
}));

import {
  createColor,
  createSize,
  listCategories,
  listColors,
  listPaymentMethods,
  listSizes,
} from '../../api/catalog';
import {
  addProductVariants,
  checkDuplicates,
  createProduct,
  generateCode,
  listProducts,
  previewRecommendedPrice,
  updateProduct,
} from '../../api/products';
import { createPurchase } from '../../api/purchases';
import { createSupplier, listSuppliers } from '../../api/suppliers';

const mockedListSuppliers = vi.mocked(listSuppliers);
const mockedCreateSupplier = vi.mocked(createSupplier);
const mockedListPaymentMethods = vi.mocked(listPaymentMethods);
const mockedListCategories = vi.mocked(listCategories);
const mockedListSizes = vi.mocked(listSizes);
const mockedListColors = vi.mocked(listColors);
const mockedCreateSize = vi.mocked(createSize);
const mockedCreateColor = vi.mocked(createColor);
const mockedListProducts = vi.mocked(listProducts);
const mockedCheckDuplicates = vi.mocked(checkDuplicates);
const mockedCreateProduct = vi.mocked(createProduct);
const mockedGenerateCode = vi.mocked(generateCode);
const mockedPreviewRecommendedPrice = vi.mocked(previewRecommendedPrice);
const mockedAddProductVariants = vi.mocked(addProductVariants);
const mockedUpdateProduct = vi.mocked(updateProduct);
const mockedCreatePurchase = vi.mocked(createPurchase);

const SUPPLIERS: Supplier[] = [
  {
    id: '1',
    name: 'Boutique XX',
    phone: null,
    whatsapp: null,
    contactPerson: null,
    address: null,
    social: null,
    notes: null,
    isActive: true,
  },
];
const PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: '1',
    name: 'Efectivo',
    appliesToSales: true,
    appliesToPurchases: true,
    appliesToExpenses: true,
    isActive: true,
  },
];
const CATEGORIES: Category[] = [{ id: '1', name: 'Blusas', isActive: true }];
const SIZES: Size[] = [
  { id: '2', name: 'S', normalizedName: 'S', isActive: true },
  { id: '3', name: 'M', normalizedName: 'M', isActive: true },
];
const COLORS: Color[] = [{ id: '5', name: 'Beige', normalizedName: 'BEIGE', isActive: true }];

const EXISTING_PRODUCT: Product = {
  id: '10',
  code: 'BLU-0012',
  name: 'Blusa Satinada',
  description: null,
  category: { id: '1', name: 'Blusas' },
  cost: '65',
  salePrice: '125',
  recommendedPrice: '100',
  waistMeasurement: null,
  lengthMeasurement: null,
  isAvailableForSale: true,
  variantCount: 2,
  variants: [
    { sizeId: '2', sizeName: 'S', colorId: '5', colorName: 'Beige' },
    { sizeId: '3', sizeName: 'M', colorId: '5', colorName: 'Beige' },
  ],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/compras/nueva']}>
        <Routes>
          <Route path="/compras/nueva" element={<PurchaseFormPage />} />
          <Route path="/compras/:id" element={<div>Detalle de compra</div>} />
          <Route path="/compras" element={<div>Lista de compras</div>} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedListSuppliers.mockResolvedValue(SUPPLIERS);
  mockedListPaymentMethods.mockResolvedValue(PAYMENT_METHODS);
  mockedListCategories.mockResolvedValue(CATEGORIES);
  mockedListSizes.mockResolvedValue(SIZES);
  mockedListColors.mockResolvedValue(COLORS);
  mockedCheckDuplicates.mockResolvedValue([]);
  mockedPreviewRecommendedPrice.mockResolvedValue({ recommendedPrice: '100' });
  mockedAddProductVariants.mockImplementation((id) =>
    Promise.resolve({ ...EXISTING_PRODUCT, id } as Product),
  );
});

describe('PurchaseFormPage', () => {
  it('renderiza proveedor y forma de pago', async () => {
    renderPage();

    expect(await screen.findByLabelText('Proveedor')).toBeInTheDocument();
    expect(screen.getByLabelText('Forma de pago')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Proveedor')).getByText('Boutique XX')).toBeInTheDocument();
  });

  it('permite crear un proveedor nuevo desde el selector', async () => {
    const user = userEvent.setup();
    mockedCreateSupplier.mockResolvedValue({
      id: '2',
      name: 'Boutique YY',
      phone: null,
      whatsapp: null,
      contactPerson: null,
      address: null,
      social: null,
      notes: null,
      isActive: true,
    });
    renderPage();

    await user.selectOptions(await screen.findByLabelText('Proveedor'), '__new__');
    await user.type(screen.getByLabelText('Nombre del proveedor'), 'Boutique YY');
    await user.click(screen.getByRole('button', { name: 'Agregar proveedor' }));

    await vi.waitFor(() => expect(mockedCreateSupplier).toHaveBeenCalledWith({ name: 'Boutique YY' }));
  });

  it('busca productos existentes y permite seleccionarlos', async () => {
    const user = userEvent.setup();
    mockedListProducts.mockResolvedValue({ items: [EXISTING_PRODUCT], total: 1, page: 1, pageSize: 20 });
    renderPage();

    await user.type(await screen.findByLabelText('Producto'), 'blusa satin');

    const result = await screen.findByRole('button', { name: /Blusa Satinada/ });
    await user.click(result);

    expect(
      await screen.findByText(
        'BLU-0012 · Marca las tallas y colores que trae esta factura — puedes agregar combinaciones que el producto nunca había manejado.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('S / Beige')).toBeInTheDocument();
    expect(screen.getByText('M / Beige')).toBeInTheDocument();
  });

  it('permite editar las medidas (cintura/largo) de un producto seleccionado sin salir de la compra', async () => {
    const user = userEvent.setup();
    mockedListProducts.mockResolvedValue({ items: [EXISTING_PRODUCT], total: 1, page: 1, pageSize: 20 });
    mockedUpdateProduct.mockResolvedValue({
      ...EXISTING_PRODUCT,
      waistMeasurement: '76',
      lengthMeasurement: '102',
    });
    renderPage();

    await user.type(await screen.findByLabelText('Producto'), 'blusa satin');
    await user.click(await screen.findByRole('button', { name: /Blusa Satinada/ }));

    await user.type(screen.getByLabelText('Cintura (cm)'), '76');
    await user.type(screen.getByLabelText('Largo (cm)'), '102');
    await user.click(screen.getByRole('button', { name: 'Guardar medidas' }));

    await vi.waitFor(() =>
      expect(mockedUpdateProduct).toHaveBeenCalledWith('10', {
        waistMeasurement: 76,
        lengthMeasurement: 102,
      }),
    );
  });

  it('detecta posibles duplicados al escribir el nombre de un producto nuevo', async () => {
    const user = userEvent.setup();
    mockedCheckDuplicates.mockResolvedValue([EXISTING_PRODUCT]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: '+ Crear producto nuevo' }));
    await user.type(screen.getByLabelText('Nombre'), 'Blusa satin');
    await user.tab();

    expect(await screen.findByText('Producto posiblemente duplicado')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar existente' })).toBeInTheDocument();
  });

  it('crea un producto nuevo inline y lo selecciona automáticamente', async () => {
    const user = userEvent.setup();
    mockedGenerateCode.mockResolvedValue({ code: 'BLU-0001' });
    mockedCreateProduct.mockResolvedValue(EXISTING_PRODUCT);
    renderPage();

    await user.click(await screen.findByRole('button', { name: '+ Crear producto nuevo' }));
    await user.type(screen.getByLabelText('Nombre'), 'Blusa Satinada');
    await user.selectOptions(screen.getByLabelText('Categoría'), '1');
    await user.click(screen.getByRole('button', { name: 'S' }));
    await user.click(screen.getByRole('button', { name: 'Beige' }));

    await user.click(screen.getByRole('button', { name: 'Crear y seleccionar' }));

    await vi.waitFor(() => expect(mockedCreateProduct).toHaveBeenCalledTimes(1));
    expect(mockedCreateProduct).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Blusa Satinada', categoryId: 1, variants: [{ sizeId: 2, colorId: 5 }] }),
    );
    // El producto creado queda seleccionado: aparece el picker de combinaciones.
    expect(
      await screen.findByText(
        `${EXISTING_PRODUCT.code} · Marca las tallas y colores que trae esta factura — puedes agregar combinaciones que el producto nunca había manejado.`,
      ),
    ).toBeInTheDocument();
  });

  it('permite crear una talla o un color nuevo también al crear un producto inline', async () => {
    const user = userEvent.setup();
    mockedCreateColor.mockResolvedValue({
      id: '8',
      name: 'Verde musgo',
      normalizedName: 'VERDE MUSGO',
      isActive: true,
    });
    renderPage();

    await user.click(await screen.findByRole('button', { name: '+ Crear producto nuevo' }));
    expect(screen.getByRole('button', { name: '+ Nueva talla' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Nuevo color' }));
    await user.type(screen.getByLabelText('Nombre del color'), 'Verde musgo');
    await user.click(screen.getByRole('button', { name: 'Agregar color' }));

    await vi.waitFor(() => expect(mockedCreateColor).toHaveBeenCalledWith('Verde musgo'));
    expect(await screen.findByRole('button', { name: 'Verde musgo' })).toHaveClass('is-active');
  });

  it('calcula subtotal y total al ingresar cantidades y costos', async () => {
    const user = userEvent.setup();
    mockedListProducts.mockResolvedValue({ items: [EXISTING_PRODUCT], total: 1, page: 1, pageSize: 20 });
    renderPage();

    await user.type(await screen.findByLabelText('Producto'), 'blusa satin');
    await user.click(await screen.findByRole('button', { name: /Blusa Satinada/ }));

    const rows = screen.getAllByRole('row');
    // Fila 0 es el encabezado; S/Beige y M/Beige son las filas 1 y 2.
    const sBeigeInputs = within(rows[1]).getAllByRole('spinbutton');
    const mBeigeInputs = within(rows[2]).getAllByRole('spinbutton');
    await user.type(sBeigeInputs[0], '2');
    await user.clear(sBeigeInputs[1]);
    await user.type(sBeigeInputs[1], '65');
    await user.type(mBeigeInputs[0], '3');
    await user.clear(mBeigeInputs[1]);
    await user.type(mBeigeInputs[1], '65');

    await user.click(screen.getByRole('button', { name: 'Agregar a la compra' }));

    expect(await screen.findByText('Subtotal: Q325')).toBeInTheDocument();
    expect(screen.getByText('Q325')).toBeInTheDocument(); // total (unico producto)
  });

  it('un producto sin combinaciones declaradas permite elegir talla/color y agregar cantidad (bug crítico)', async () => {
    const user = userEvent.setup();
    const productWithoutVariants: Product = {
      ...EXISTING_PRODUCT,
      id: '20',
      variantCount: 0,
      variants: [],
    };
    mockedListProducts.mockResolvedValue({
      items: [productWithoutVariants],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    renderPage();

    await user.type(await screen.findByLabelText('Producto'), 'blusa satin');
    await user.click(await screen.findByRole('button', { name: /Blusa Satinada/ }));

    // Sin combinaciones aún: no hay fila de cantidad/costo que llenar.
    expect(
      screen.getByText(
        'Marca al menos una talla y un color arriba para ingresar cantidad y costo.',
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'S' }));
    await user.click(screen.getByRole('button', { name: 'Beige' }));

    const rows = screen.getAllByRole('row');
    const inputs = within(rows[1]).getAllByRole('spinbutton');
    await user.type(inputs[0], '5');
    await user.clear(inputs[1]);
    await user.type(inputs[1], '40');

    await user.click(screen.getByRole('button', { name: 'Agregar a la compra' }));

    await vi.waitFor(() =>
      expect(mockedAddProductVariants).toHaveBeenCalledWith('20', [{ sizeId: 2, colorId: 5 }]),
    );
    expect(await screen.findByText('Subtotal: Q200')).toBeInTheDocument();
  });

  it('permite crear una talla o un color nuevo sin salir de la compra', async () => {
    const user = userEvent.setup();
    mockedListProducts.mockResolvedValue({ items: [EXISTING_PRODUCT], total: 1, page: 1, pageSize: 20 });
    mockedCreateSize.mockResolvedValue({ id: '9', name: 'XL', normalizedName: 'XL', isActive: true });
    mockedCreateColor.mockResolvedValue({
      id: '8',
      name: 'Verde musgo',
      normalizedName: 'VERDE MUSGO',
      isActive: true,
    });
    renderPage();

    await user.type(await screen.findByLabelText('Producto'), 'blusa satin');
    await user.click(await screen.findByRole('button', { name: /Blusa Satinada/ }));

    await user.click(screen.getByRole('button', { name: '+ Nueva talla' }));
    await user.type(screen.getByLabelText('Nombre de la talla'), 'XL');
    await user.click(screen.getByRole('button', { name: 'Agregar talla' }));

    await vi.waitFor(() => expect(mockedCreateSize).toHaveBeenCalledWith('XL'));
    expect(await screen.findByRole('button', { name: 'XL' })).toHaveClass('is-active');

    await user.click(screen.getByRole('button', { name: '+ Nuevo color' }));
    await user.type(screen.getByLabelText('Nombre del color'), 'Verde musgo');
    await user.click(screen.getByRole('button', { name: 'Agregar color' }));

    await vi.waitFor(() => expect(mockedCreateColor).toHaveBeenCalledWith('Verde musgo'));
    const verdeMusgoButtons = await screen.findAllByRole('button', { name: 'Verde musgo' });
    expect(verdeMusgoButtons.some((btn) => btn.className.includes('is-active'))).toBe(true);
  });

  it('confirma la compra y navega al detalle', async () => {
    const user = userEvent.setup();
    mockedListProducts.mockResolvedValue({ items: [EXISTING_PRODUCT], total: 1, page: 1, pageSize: 20 });
    mockedCreatePurchase.mockResolvedValue({ id: '99' } as Purchase);
    renderPage();

    await user.selectOptions(await screen.findByLabelText('Proveedor'), '1');
    await user.selectOptions(screen.getByLabelText('Forma de pago'), '1');

    await user.type(screen.getByLabelText('Producto'), 'blusa satin');
    await user.click(await screen.findByRole('button', { name: /Blusa Satinada/ }));
    const rows = screen.getAllByRole('row');
    const sBeigeInputs = within(rows[1]).getAllByRole('spinbutton');
    await user.type(sBeigeInputs[0], '1');
    await user.clear(sBeigeInputs[1]);
    await user.type(sBeigeInputs[1], '65');
    await user.click(screen.getByRole('button', { name: 'Agregar a la compra' }));

    await user.click(await screen.findByRole('button', { name: 'Confirmar compra' }));

    await vi.waitFor(() => expect(mockedCreatePurchase).toHaveBeenCalledTimes(1));
    expect(mockedCreatePurchase).toHaveBeenCalledWith(
      expect.objectContaining({
        supplierId: 1,
        paymentMethodId: 1,
        items: [{ productId: 10, sizeId: 2, colorId: 5, quantity: 1, unitCost: 65 }],
      }),
    );
    expect(await screen.findByText('Detalle de compra')).toBeInTheDocument();
  });

  it('incluye el costo de transporte en la compra cuando se ingresa', async () => {
    const user = userEvent.setup();
    mockedListProducts.mockResolvedValue({ items: [EXISTING_PRODUCT], total: 1, page: 1, pageSize: 20 });
    mockedCreatePurchase.mockResolvedValue({ id: '99' } as Purchase);
    renderPage();

    await user.selectOptions(await screen.findByLabelText('Proveedor'), '1');
    await user.selectOptions(screen.getByLabelText('Forma de pago'), '1');

    await user.type(screen.getByLabelText('Producto'), 'blusa satin');
    await user.click(await screen.findByRole('button', { name: /Blusa Satinada/ }));
    const rows = screen.getAllByRole('row');
    const sBeigeInputs = within(rows[1]).getAllByRole('spinbutton');
    await user.type(sBeigeInputs[0], '1');
    await user.clear(sBeigeInputs[1]);
    await user.type(sBeigeInputs[1], '65');
    await user.click(screen.getByRole('button', { name: 'Agregar a la compra' }));

    await user.type(await screen.findByLabelText('Costo de transporte (opcional)'), '20');
    expect(screen.getByText(/^Total:/)).toHaveTextContent('Q85');

    await user.click(screen.getByRole('button', { name: 'Confirmar compra' }));

    await vi.waitFor(() =>
      expect(mockedCreatePurchase).toHaveBeenCalledWith(
        expect.objectContaining({ shippingCost: 20 }),
      ),
    );
  });
});
