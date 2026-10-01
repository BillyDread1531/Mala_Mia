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
}));
vi.mock('../../api/purchases', () => ({
  createPurchase: vi.fn(),
}));

import { listCategories, listColors, listPaymentMethods, listSizes } from '../../api/catalog';
import { checkDuplicates, createProduct, generateCode, listProducts } from '../../api/products';
import { createPurchase } from '../../api/purchases';
import { createSupplier, listSuppliers } from '../../api/suppliers';

const mockedListSuppliers = vi.mocked(listSuppliers);
const mockedCreateSupplier = vi.mocked(createSupplier);
const mockedListPaymentMethods = vi.mocked(listPaymentMethods);
const mockedListCategories = vi.mocked(listCategories);
const mockedListSizes = vi.mocked(listSizes);
const mockedListColors = vi.mocked(listColors);
const mockedListProducts = vi.mocked(listProducts);
const mockedCheckDuplicates = vi.mocked(checkDuplicates);
const mockedCreateProduct = vi.mocked(createProduct);
const mockedGenerateCode = vi.mocked(generateCode);
const mockedCreatePurchase = vi.mocked(createPurchase);

const SUPPLIERS: Supplier[] = [
  {
    id: '1',
    name: 'Boutique XX',
    phone: null,
    whatsapp: null,
    contact_person: null,
    address: null,
    social: null,
    notes: null,
    is_active: true,
  },
];
const PAYMENT_METHODS: PaymentMethod[] = [{ id: '1', name: 'Efectivo' }];
const CATEGORIES: Category[] = [{ id: '1', name: 'Blusas' }];
const SIZES: Size[] = [
  { id: '2', name: 'S' },
  { id: '3', name: 'M' },
];
const COLORS: Color[] = [{ id: '5', name: 'Beige' }];

const EXISTING_PRODUCT: Product = {
  id: '10',
  code: 'BLU-0012',
  name: 'Blusa Satinada',
  description: null,
  category: { id: '1', name: 'Blusas' },
  cost: '65',
  salePrice: '125',
  recommendedPrice: '100',
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
      contact_person: null,
      address: null,
      social: null,
      notes: null,
      is_active: true,
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

    expect(await screen.findByText('BLU-0012 · Registra cantidad y costo de las combinaciones que compraste.')).toBeInTheDocument();
    expect(screen.getByText('S / Beige')).toBeInTheDocument();
    expect(screen.getByText('M / Beige')).toBeInTheDocument();
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
    // El producto creado queda seleccionado: aparece la tabla de combinaciones.
    expect(await screen.findByText(`${EXISTING_PRODUCT.code} · Registra cantidad y costo de las combinaciones que compraste.`)).toBeInTheDocument();
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
});
