import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listCategories, listPaymentMethods } from '../../api/catalog';
import { ApiError } from '../../api/client';
import { getFinanceSummary } from '../../api/finance';
import { getInventoryReport, getPurchasesReport, getSalesReport } from '../../api/reports';
import { listSuppliers } from '../../api/suppliers';
import { BarChart } from '../../components/charts/BarChart';
import { RankedBars } from '../../components/charts/RankedBars';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Loading } from '../../components/Loading';
import { formatMoney } from '../../lib/money';
import { useNotify } from '../../notifications/useNotify';
import type { Category, PaymentMethod } from '../../types/catalog';
import type { FinancePeriod, FinanceSummary } from '../../types/finance';
import type { InventoryReport, PurchasesReport, SalesReport } from '../../types/reports';
import type { Supplier } from '../../types/supplier';
import './ReportsPage.css';

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('es-GT', {
    day: '2-digit',
    month: 'short',
  });
}

const LOW_STOCK_PREVIEW_LIMIT = 8;

const PERIOD_LABELS: Record<FinancePeriod, string> = {
  week: 'Esta semana',
  month: 'Este mes',
  year: 'Este año',
  custom: 'Personalizado',
};

function SummaryCards({ summary }: { summary: FinanceSummary }) {
  return (
    <div className="reports__summary">
      <Card className="reports__summary-card">
        <span className="reports__summary-label">Ventas</span>
        <span className="reports__summary-value">{formatMoney(summary.breakdown.ventas)}</span>
      </Card>
      <Card className="reports__summary-card">
        <span className="reports__summary-label">Compras</span>
        <span className="reports__summary-value">{formatMoney(summary.breakdown.compras)}</span>
      </Card>
      <Card className="reports__summary-card">
        <span className="reports__summary-label">Gastos</span>
        <span className="reports__summary-value">{formatMoney(summary.breakdown.gastos)}</span>
      </Card>
      <Card className="reports__summary-card reports__summary-card--profit">
        <span className="reports__summary-label">Utilidad real</span>
        <span className="reports__summary-value">
          {formatMoney(summary.distribution.realProfit)}
        </span>
      </Card>
    </div>
  );
}

function SalesSection({
  report,
  paymentMethods,
  showFilter,
  paymentMethodFilter,
  onPaymentMethodFilterChange,
}: {
  report: SalesReport;
  paymentMethods: PaymentMethod[];
  showFilter: boolean;
  paymentMethodFilter: string;
  onPaymentMethodFilterChange: (value: string) => void;
}) {
  const hasActivity = report.salesCount > 0 || report.cancellationsCount > 0;

  return (
    <Card className="reports__section">
      <div className="reports__section-header">
        <h2>Ventas</h2>
        {showFilter ? (
          <select
            aria-label="Forma de pago"
            className="field__input"
            value={paymentMethodFilter}
            onChange={(event) => onPaymentMethodFilterChange(event.target.value)}
          >
            <option value="">Todas las formas de pago</option>
            {paymentMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {!hasActivity ? (
        <EmptyState title="No hay ventas en este período." showHeart={false} />
      ) : (
        <>
          <div className="reports__stat-row">
            <div className="reports__stat">
              <span className="reports__stat-value">{report.salesCount}</span>
              <span className="reports__stat-label">Ventas</span>
            </div>
            <div className="reports__stat">
              <span className="reports__stat-value">{report.unitsSold}</span>
              <span className="reports__stat-label">Unidades</span>
            </div>
            <div className="reports__stat">
              <span className="reports__stat-value">{formatMoney(report.discountsTotal)}</span>
              <span className="reports__stat-label">Descuentos</span>
            </div>
            {report.cancellationsCount > 0 ? (
              <div className="reports__stat">
                <span className="reports__stat-value">{report.cancellationsCount}</span>
                <span className="reports__stat-label">Canceladas</span>
              </div>
            ) : null}
            {Number(report.returnsTotal) > 0 ? (
              <div className="reports__stat">
                <span className="reports__stat-value">{formatMoney(report.returnsTotal)}</span>
                <span className="reports__stat-label">Devoluciones</span>
              </div>
            ) : null}
          </div>

          {report.byDay.length > 0 ? (
            <div className="reports__chart-block">
              <h3>Ventas por día</h3>
              <BarChart
                data={report.byDay.map((d) => ({
                  label: formatShortDate(d.date),
                  value: Number(d.total),
                }))}
                formatValue={(v) => `Q${v.toFixed(0)}`}
              />
            </div>
          ) : null}

          {report.byPaymentMethod.length > 0 ? (
            <div className="reports__chart-block">
              <h3>Ventas por método de pago</h3>
              <RankedBars
                items={report.byPaymentMethod.map((p) => ({
                  key: p.paymentMethodId,
                  label: p.name,
                  sublabel: `${p.count} venta${p.count === 1 ? '' : 's'}`,
                  value: Number(p.total),
                }))}
                formatValue={(v) => `Q${v.toFixed(0)}`}
              />
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function TopProductsSection({ report }: { report: SalesReport }) {
  return (
    <Card className="reports__section">
      <h2>Productos más vendidos</h2>
      {report.topProducts.length === 0 ? (
        <EmptyState title="No hay productos vendidos en este período." showHeart={false} />
      ) : (
        <RankedBars
          items={report.topProducts.map((p) => ({
            key: p.productId,
            label: p.productName,
            sublabel: formatMoney(p.revenue),
            value: p.quantity,
          }))}
          formatValue={(v) => `${v} u.`}
        />
      )}
    </Card>
  );
}

function TopProfitSection({ report }: { report: SalesReport }) {
  return (
    <Card className="reports__section">
      <h2>Productos más rentables</h2>
      {report.topProductsByProfit.length === 0 ? (
        <EmptyState title="No hay productos vendidos en este período." showHeart={false} />
      ) : (
        <RankedBars
          items={report.topProductsByProfit.map((p) => ({
            key: p.productId,
            label: p.productName,
            sublabel: `${p.quantity} u. · ${formatMoney(p.revenue)} en ventas`,
            value: Number(p.profit),
          }))}
          formatValue={(v) => `Q${v.toFixed(0)} utilidad`}
        />
      )}
    </Card>
  );
}

function PurchasesSection({
  report,
  suppliers,
  showFilter,
  supplierFilter,
  onSupplierFilterChange,
}: {
  report: PurchasesReport;
  suppliers: Supplier[];
  showFilter: boolean;
  supplierFilter: string;
  onSupplierFilterChange: (value: string) => void;
}) {
  return (
    <Card className="reports__section">
      <div className="reports__section-header">
        <h2>Compras</h2>
        {showFilter ? (
          <select
            aria-label="Proveedor"
            className="field__input"
            value={supplierFilter}
            onChange={(event) => onSupplierFilterChange(event.target.value)}
          >
            <option value="">Todos los proveedores</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {report.purchasesCount === 0 ? (
        <EmptyState title="No hay compras en este período." showHeart={false} />
      ) : (
        <>
          <div className="reports__stat-row">
            <div className="reports__stat">
              <span className="reports__stat-value">{report.purchasesCount}</span>
              <span className="reports__stat-label">Compras</span>
            </div>
            <div className="reports__stat">
              <span className="reports__stat-value">{report.unitsPurchased}</span>
              <span className="reports__stat-label">Unidades</span>
            </div>
            <div className="reports__stat">
              <span className="reports__stat-value">{formatMoney(report.totalAmount)}</span>
              <span className="reports__stat-label">Invertido</span>
            </div>
          </div>

          {report.bySupplier.length > 0 ? (
            <div className="reports__chart-block">
              <h3>Compras por proveedor</h3>
              <RankedBars
                items={report.bySupplier.map((s) => ({
                  key: s.supplierId,
                  label: s.name,
                  sublabel: `${s.count} compra${s.count === 1 ? '' : 's'}`,
                  value: Number(s.total),
                }))}
                formatValue={(v) => `Q${v.toFixed(0)}`}
              />
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function InventorySection({
  report,
  categories,
  showFilter,
  categoryFilter,
  onCategoryFilterChange,
}: {
  report: InventoryReport;
  categories: Category[];
  showFilter: boolean;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
}) {
  return (
    <Card className="reports__section">
      <div className="reports__section-header">
        <h2>Inventario</h2>
        {showFilter ? (
          <select
            aria-label="Categoría"
            className="field__input"
            value={categoryFilter}
            onChange={(event) => onCategoryFilterChange(event.target.value)}
          >
            <option value="">Todas las categorías</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>
      <p className="reports__hint">Fotografía del inventario actual (no depende del período).</p>

      {report.productsCount === 0 ? (
        <EmptyState title="No hay productos en el inventario." showHeart={false} />
      ) : (
        <>
          <div className="reports__stat-row">
            <div className="reports__stat">
              <span className="reports__stat-value">{report.productsCount}</span>
              <span className="reports__stat-label">Productos</span>
            </div>
            <div className="reports__stat">
              <span className="reports__stat-value">{report.totalUnits}</span>
              <span className="reports__stat-label">Unidades</span>
            </div>
            <div className="reports__stat">
              <span className="reports__stat-value">{report.lowStockCount}</span>
              <span className="reports__stat-label">Stock bajo</span>
            </div>
            <div className="reports__stat">
              <span className="reports__stat-value">{report.outOfStockCount}</span>
              <span className="reports__stat-label">Agotados</span>
            </div>
          </div>

          <p className="reports__approx-value">
            Valor aproximado del inventario: <strong>{formatMoney(report.approxValue)}</strong>
          </p>

          <div className="reports__chart-block">
            <h3>Productos con poco stock</h3>
            {report.lowStockItems.length === 0 ? (
              <EmptyState
                title="Todo el inventario está en buen nivel."
                showHeart={false}
              />
            ) : (
              <>
                <ul className="reports__low-stock-list">
                  {report.lowStockItems.slice(0, LOW_STOCK_PREVIEW_LIMIT).map((item, index) => (
                    <li key={index} className="reports__low-stock-item">
                      <div>
                        <strong>{item.productName}</strong>
                        <span className="reports__low-stock-variant">
                          {item.sizeName} / {item.colorName}
                        </span>
                      </div>
                      <span
                        className={`reports__low-stock-badge reports__low-stock-badge--${item.status.toLowerCase()}`}
                      >
                        {item.status === 'AGOTADO' ? 'Agotado' : `${item.quantity} u.`}
                      </span>
                    </li>
                  ))}
                </ul>
                {report.lowStockItems.length > LOW_STOCK_PREVIEW_LIMIT ? (
                  <p className="reports__low-stock-more">
                    Y {report.lowStockItems.length - LOW_STOCK_PREVIEW_LIMIT} combinación(es) más.{' '}
                    <Link to="/disponibilidad">Ver todo en Disponibilidad →</Link>
                  </p>
                ) : null}
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function FinanceSection({ summary }: { summary: FinanceSummary }) {
  const [open, setOpen] = useState(false);
  const { distribution } = summary;

  return (
    <Card className="reports__section">
      <h2>Reporte financiero</h2>
      <div className="reports__stat-row">
        <div className="reports__stat">
          <span className="reports__stat-value">{formatMoney(summary.ingresos)}</span>
          <span className="reports__stat-label">Entradas</span>
        </div>
        <div className="reports__stat">
          <span className="reports__stat-value">{formatMoney(summary.salidas)}</span>
          <span className="reports__stat-label">Salidas</span>
        </div>
        <div className="reports__stat">
          <span className="reports__stat-value">{formatMoney(summary.netSales)}</span>
          <span className="reports__stat-label">Ventas netas</span>
        </div>
        <div className="reports__stat">
          <span className="reports__stat-value">{formatMoney(summary.cogs)}</span>
          <span className="reports__stat-label">Costo de mercadería</span>
        </div>
      </div>

      <button
        type="button"
        className="reports__disclosure-toggle"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? 'Ocultar distribución ↑' : 'Ver distribución de utilidad ↓'}
      </button>
      {open ? (
        <div className="reports__distribution">
          <div className="reports__distribution-row">
            <span>💗 Para mí ({distribution.personalPercentage}%)</span>
            <span>{formatMoney(distribution.personalAmount)}</span>
          </div>
          <div className="reports__distribution-row">
            <span>📦 Reinversión ({distribution.reinvestmentPercentage}%)</span>
            <span>{formatMoney(distribution.reinvestmentAmount)}</span>
          </div>
          <div className="reports__distribution-row">
            <span>🏦 Reserva ({distribution.reservePercentage}%)</span>
            <span>{formatMoney(distribution.reserveAmount)}</span>
          </div>
        </div>
      ) : null}

      <div className="reports__section-footer">
        <Link to="/finanzas/movimientos">
          <Button type="button" variant="ghost">
            Ver movimientos
          </Button>
        </Link>
      </div>
    </Card>
  );
}

export function ReportsPage() {
  const notify = useNotify();
  const [period, setPeriod] = useState<FinancePeriod>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [financeSummary, setFinanceSummary] = useState<FinanceSummary | null>(null);
  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [purchasesReport, setPurchasesReport] = useState<PurchasesReport | null>(null);
  const [inventoryReport, setInventoryReport] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [inventoryLoading, setInventoryLoading] = useState(true);

  useEffect(() => {
    Promise.all([listPaymentMethods('sales'), listSuppliers(), listCategories()])
      .then(([pm, sup, cats]) => {
        setPaymentMethods(pm);
        setSuppliers(sup);
        setCategories(cats);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return;

    const timer = setTimeout(() => {
      setLoading(true);
      Promise.all([
        getFinanceSummary({ period, from: customFrom || undefined, to: customTo || undefined }),
        getSalesReport({
          period,
          from: customFrom || undefined,
          to: customTo || undefined,
          paymentMethodId: paymentMethodFilter ? Number(paymentMethodFilter) : undefined,
        }),
        getPurchasesReport({
          period,
          from: customFrom || undefined,
          to: customTo || undefined,
          supplierId: supplierFilter ? Number(supplierFilter) : undefined,
        }),
      ])
        .then(([financeRes, salesRes, purchasesRes]) => {
          setFinanceSummary(financeRes);
          setSalesReport(salesRes);
          setPurchasesReport(purchasesRes);
        })
        .catch((error: unknown) => {
          notify.error(
            error instanceof ApiError ? error.message : 'No se pudieron cargar los reportes.',
          );
        })
        .finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [period, customFrom, customTo, paymentMethodFilter, supplierFilter, notify]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInventoryLoading(true);
      getInventoryReport({ categoryId: categoryFilter ? Number(categoryFilter) : undefined })
        .then(setInventoryReport)
        .catch((error: unknown) => {
          notify.error(
            error instanceof ApiError
              ? error.message
              : 'No se pudo cargar el reporte de inventario.',
          );
        })
        .finally(() => setInventoryLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [categoryFilter, notify]);

  return (
    <div className="reports">
      <header className="reports__header">
        <div>
          <h1>Reportes</h1>
          <p>Cómo le está yendo a MALA MÍA.</p>
        </div>
      </header>

      <div className="reports__period">
        <select
          aria-label="Periodo"
          className="field__input"
          value={period}
          onChange={(event) => setPeriod(event.target.value as FinancePeriod)}
        >
          <option value="week">{PERIOD_LABELS.week}</option>
          <option value="month">{PERIOD_LABELS.month}</option>
          <option value="year">{PERIOD_LABELS.year}</option>
          <option value="custom">{PERIOD_LABELS.custom}</option>
        </select>
        {period === 'custom' ? (
          <>
            <input
              aria-label="Desde"
              type="date"
              className="field__input"
              value={customFrom}
              onChange={(event) => setCustomFrom(event.target.value)}
            />
            <input
              aria-label="Hasta"
              type="date"
              className="field__input"
              value={customTo}
              onChange={(event) => setCustomTo(event.target.value)}
            />
          </>
        ) : null}
        <button
          type="button"
          className="reports__disclosure-toggle"
          onClick={() => setShowFilters((prev) => !prev)}
        >
          {showFilters ? 'Ocultar filtros' : 'Más filtros'}
        </button>
      </div>

      {financeSummary ? (
        <p className="reports__period-label">Mostrando: {financeSummary.period.label}</p>
      ) : null}

      {loading || !financeSummary || !salesReport || !purchasesReport ? (
        <Loading label="Cargando reportes…" />
      ) : (
        <>
          <SummaryCards summary={financeSummary} />

          <SalesSection
            report={salesReport}
            paymentMethods={paymentMethods}
            showFilter={showFilters}
            paymentMethodFilter={paymentMethodFilter}
            onPaymentMethodFilterChange={setPaymentMethodFilter}
          />

          <TopProductsSection report={salesReport} />

          <TopProfitSection report={salesReport} />

          <PurchasesSection
            report={purchasesReport}
            suppliers={suppliers}
            showFilter={showFilters}
            supplierFilter={supplierFilter}
            onSupplierFilterChange={setSupplierFilter}
          />

          {inventoryLoading || !inventoryReport ? (
            <Loading label="Cargando inventario…" />
          ) : (
            <InventorySection
              report={inventoryReport}
              categories={categories}
              showFilter={showFilters}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
            />
          )}

          <FinanceSection summary={financeSummary} />
        </>
      )}
    </div>
  );
}
