import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { Category, PaymentMethod } from '../../types/catalog';
import type { FinanceSummary } from '../../types/finance';
import type { InventoryReport, PurchasesReport, SalesReport } from '../../types/reports';
import type { Supplier } from '../../types/supplier';
import { ReportsPage } from './ReportsPage';

vi.mock('../../api/finance', () => ({
  getFinanceSummary: vi.fn(),
}));
vi.mock('../../api/reports', () => ({
  getSalesReport: vi.fn(),
  getPurchasesReport: vi.fn(),
  getInventoryReport: vi.fn(),
}));
vi.mock('../../api/catalog', () => ({
  listPaymentMethods: vi.fn(),
  listCategories: vi.fn(),
}));
vi.mock('../../api/suppliers', () => ({
  listSuppliers: vi.fn(),
}));

import { listCategories, listPaymentMethods } from '../../api/catalog';
import { getFinanceSummary } from '../../api/finance';
import { getInventoryReport, getPurchasesReport, getSalesReport } from '../../api/reports';
import { listSuppliers } from '../../api/suppliers';

const mockedGetFinanceSummary = vi.mocked(getFinanceSummary);
const mockedGetSalesReport = vi.mocked(getSalesReport);
const mockedGetPurchasesReport = vi.mocked(getPurchasesReport);
const mockedGetInventoryReport = vi.mocked(getInventoryReport);
const mockedListPaymentMethods = vi.mocked(listPaymentMethods);
const mockedListCategories = vi.mocked(listCategories);
const mockedListSuppliers = vi.mocked(listSuppliers);

const FINANCE_SUMMARY: FinanceSummary = {
  period: { from: '2026-01-01', to: '2026-01-08', label: 'Esta semana' },
  ingresos: '650',
  salidas: '200',
  disponible: '1000',
  netSales: '480',
  cogs: '150',
  breakdown: {
    ventas: '500',
    devoluciones: '0',
    cancelaciones: '0',
    correcciones: '0',
    cambios: '0',
    compras: '100',
    gastos: '100',
    ingresoManual: '0',
  },
  distribution: {
    hasProfit: true,
    realProfit: '250',
    personalPercentage: '50',
    reinvestmentPercentage: '30',
    reservePercentage: '20',
    personalAmount: '125',
    reinvestmentAmount: '75',
    reserveAmount: '50',
  },
};

const SALES_REPORT: SalesReport = {
  period: { from: '2026-01-01', to: '2026-01-08', label: 'Esta semana' },
  salesCount: 2,
  unitsSold: 3,
  grossTotal: '500',
  discountsTotal: '20',
  cancellationsCount: 0,
  cancellationsTotal: '0',
  returnsTotal: '0',
  byDay: [{ date: '2026-01-02', total: '500' }],
  byPaymentMethod: [{ paymentMethodId: '1', name: 'Efectivo', total: '500', count: 2 }],
  topProducts: [
    {
      productId: '10',
      productName: 'Blusa Satinada',
      quantity: 3,
      revenue: '500',
      cost: '200',
      profit: '300',
    },
  ],
  topProductsByProfit: [
    {
      productId: '10',
      productName: 'Blusa Satinada',
      quantity: 3,
      revenue: '500',
      cost: '200',
      profit: '300',
    },
  ],
};

const EMPTY_SALES_REPORT: SalesReport = {
  ...SALES_REPORT,
  salesCount: 0,
  unitsSold: 0,
  discountsTotal: '0',
  byDay: [],
  byPaymentMethod: [],
  topProducts: [],
  topProductsByProfit: [],
};

const PURCHASES_REPORT: PurchasesReport = {
  period: { from: '2026-01-01', to: '2026-01-08', label: 'Esta semana' },
  purchasesCount: 1,
  unitsPurchased: 10,
  totalAmount: '500',
  bySupplier: [{ supplierId: '9', name: 'Boutique XY', total: '500', count: 1 }],
  products: [{ productId: '10', productName: 'Blusa Satinada', quantity: 10, totalCost: '500' }],
};

const EMPTY_PURCHASES_REPORT: PurchasesReport = {
  ...PURCHASES_REPORT,
  purchasesCount: 0,
  unitsPurchased: 0,
  bySupplier: [],
  products: [],
};

const INVENTORY_REPORT: InventoryReport = {
  totalUnits: 20,
  productsCount: 2,
  availableCount: 1,
  lowStockCount: 1,
  outOfStockCount: 0,
  approxValue: '800',
  lowStockItems: [
    {
      productId: '11',
      productName: 'Blusa Corta',
      sizeName: 'S',
      colorName: 'Blanco',
      quantity: 2,
      status: 'STOCK_BAJO',
    },
  ],
  lowStockConsumables: [],
};

const EMPTY_INVENTORY_REPORT: InventoryReport = {
  ...INVENTORY_REPORT,
  lowStockItems: [],
};

const MANY_LOW_STOCK_ITEMS: InventoryReport = {
  ...INVENTORY_REPORT,
  lowStockItems: Array.from({ length: 10 }, (_, i) => ({
    productId: String(i),
    productName: `Producto ${i}`,
    sizeName: 'M',
    colorName: 'Negro',
    quantity: 0,
    status: 'AGOTADO' as const,
  })),
};

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
const SUPPLIERS: Supplier[] = [
  {
    id: '9',
    name: 'Boutique XY',
    phone: null,
    whatsapp: null,
    contactPerson: null,
    address: null,
    social: null,
    notes: null,
    isActive: true,
  },
];

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedGetFinanceSummary.mockResolvedValue(FINANCE_SUMMARY);
  mockedGetSalesReport.mockResolvedValue(SALES_REPORT);
  mockedGetPurchasesReport.mockResolvedValue(PURCHASES_REPORT);
  mockedGetInventoryReport.mockResolvedValue(INVENTORY_REPORT);
  mockedListPaymentMethods.mockResolvedValue(PAYMENT_METHODS);
  mockedListCategories.mockResolvedValue(CATEGORIES);
  mockedListSuppliers.mockResolvedValue(SUPPLIERS);
});

describe('ReportsPage', () => {
  it('muestra el resumen del período (ventas, compras, gastos, utilidad)', async () => {
    renderPage();

    await screen.findByText('Productos más vendidos');
    expect(screen.getByRole('heading', { name: 'Ventas' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Compras' })).toBeInTheDocument();
    expect(screen.getByText('Gastos')).toBeInTheDocument();
    expect(screen.getByText('Utilidad real')).toBeInTheDocument();
    expect(screen.getByText('Q250')).toBeInTheDocument(); // utilidad real (realProfit)
  });

  it('muestra el reporte de ventas con sus estadísticas y producto más vendido', async () => {
    renderPage();

    await screen.findByText('Productos más vendidos');
    const ventasSection = screen
      .getByRole('heading', { name: 'Ventas' })
      .closest('.reports__section') as HTMLElement;
    expect(within(ventasSection).getByText('2')).toBeInTheDocument(); // salesCount
    expect(screen.getAllByText('Blusa Satinada').length).toBeGreaterThan(0);
  });

  it('muestra el producto más rentable con su utilidad', async () => {
    renderPage();

    await screen.findByText('Productos más rentables');
    const profitSection = screen
      .getByRole('heading', { name: 'Productos más rentables' })
      .closest('.reports__section') as HTMLElement;
    expect(within(profitSection).getByText('Blusa Satinada')).toBeInTheDocument();
    expect(within(profitSection).getByText('Q300 utilidad')).toBeInTheDocument();
  });

  it('muestra el reporte de compras con su proveedor', async () => {
    renderPage();

    await screen.findByText('Productos más vendidos');
    expect(screen.getByRole('heading', { name: 'Compras' })).toBeInTheDocument();
    expect(screen.getByText('Boutique XY')).toBeInTheDocument();
  });

  it('muestra el inventario y los productos con poco stock', async () => {
    renderPage();

    await screen.findByRole('heading', { name: 'Inventario' });
    expect(screen.getByText('Blusa Corta')).toBeInTheDocument();
    expect(
      screen.getByText('Valor aproximado del inventario:', { exact: false }),
    ).toBeInTheDocument();
  });

  it('estado vacío: sin ventas en el período', async () => {
    mockedGetSalesReport.mockResolvedValue(EMPTY_SALES_REPORT);
    renderPage();

    expect(await screen.findByText('No hay ventas en este período.')).toBeInTheDocument();
  });

  it('estado vacío: sin compras en el período', async () => {
    mockedGetPurchasesReport.mockResolvedValue(EMPTY_PURCHASES_REPORT);
    renderPage();

    expect(await screen.findByText('No hay compras en este período.')).toBeInTheDocument();
  });

  it('limita la lista de poco stock y enlaza a Disponibilidad cuando hay muchas combinaciones', async () => {
    mockedGetInventoryReport.mockResolvedValue(MANY_LOW_STOCK_ITEMS);
    renderPage();

    await screen.findByRole('heading', { name: 'Inventario' });
    expect(screen.getAllByText('Agotado')).toHaveLength(8);
    expect(screen.getByText('Y 2 combinación(es) más.', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver todo en Disponibilidad →' })).toHaveAttribute(
      'href',
      '/disponibilidad',
    );
  });

  it('estado vacío: inventario sin stock bajo', async () => {
    mockedGetInventoryReport.mockResolvedValue(EMPTY_INVENTORY_REPORT);
    renderPage();

    expect(
      await screen.findByText('Todo el inventario está en buen nivel.'),
    ).toBeInTheDocument();
  });

  it('cambiar el periodo vuelve a pedir los reportes', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Productos más vendidos');
    await user.selectOptions(screen.getByLabelText('Periodo'), 'month');

    await vi.waitFor(() =>
      expect(mockedGetSalesReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: 'month' }),
      ),
    );
    await vi.waitFor(() =>
      expect(mockedGetPurchasesReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ period: 'month' }),
      ),
    );
  });

  it('"Más filtros" revela los selectores de forma de pago, proveedor y categoría', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Productos más vendidos');
    expect(screen.queryByLabelText('Forma de pago')).not.toBeInTheDocument();

    await user.click(screen.getByText('Más filtros'));

    expect(screen.getByLabelText('Forma de pago')).toBeInTheDocument();
    expect(screen.getByLabelText('Proveedor')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoría')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Forma de pago'), '1');
    await vi.waitFor(() =>
      expect(mockedGetSalesReport).toHaveBeenLastCalledWith(
        expect.objectContaining({ paymentMethodId: 1 }),
      ),
    );
  });

  it('el enlace "Ver movimientos" apunta a /finanzas/movimientos', async () => {
    renderPage();

    const link = await screen.findByRole('link', { name: 'Ver movimientos' });
    expect(link).toHaveAttribute('href', '/finanzas/movimientos');
  });

  it('el periodo personalizado no consulta hasta tener desde y hasta', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Productos más vendidos');
    mockedGetSalesReport.mockClear();
    await user.selectOptions(screen.getByLabelText('Periodo'), 'custom');

    expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    expect(screen.getByLabelText('Hasta')).toBeInTheDocument();
    expect(mockedGetSalesReport).not.toHaveBeenCalled();
  });
});
