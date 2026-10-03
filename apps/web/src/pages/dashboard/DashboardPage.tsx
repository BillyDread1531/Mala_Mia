import { useEffect, useState } from 'react';
import { getFinanceSummary, listFinanceMovements } from '../../api/finance';
import { getInventoryReport, getSalesReport } from '../../api/reports';
import { useAuth } from '../../auth/useAuth';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { RecentMovements } from '../../components/RecentMovements';
import { formatMoney } from '../../lib/money';
import type { FinanceMovement, FinanceSummary } from '../../types/finance';
import type { InventoryReport, SalesReport } from '../../types/reports';
import { QuickActions } from './QuickActions';
import { StatCard } from './StatCard';
import './DashboardPage.css';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

/** Límites del día calendario actual, en hora local — mismo criterio que
 * `FinanceService.resolvePeriod` usa para "semana"/"mes"/"año" (componentes
 * de fecha locales, no UTC). No existe un periodo "día" en Finanzas/Reportes,
 * así que se arma aquí y se envía como periodo "custom". */
function getTodayRange(): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

interface DashboardData {
  todayFinance: FinanceSummary | null;
  todaySales: SalesReport | null;
  monthFinance: FinanceSummary | null;
  monthSales: SalesReport | null;
  inventory: InventoryReport | null;
  movements: FinanceMovement[] | null;
  movementsTotal: number;
}

interface DashboardErrors {
  todayFinance: boolean;
  todaySales: boolean;
  monthFinance: boolean;
  monthSales: boolean;
  inventory: boolean;
  movements: boolean;
}

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.fullName.split(' ')[0] ?? '';
  const [currentHour] = useState(() => new Date().getHours());
  const greeting = greetingForHour(currentHour);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    todayFinance: null,
    todaySales: null,
    monthFinance: null,
    monthSales: null,
    inventory: null,
    movements: null,
    movementsTotal: 0,
  });
  const [errors, setErrors] = useState<DashboardErrors>({
    todayFinance: false,
    todaySales: false,
    monthFinance: false,
    monthSales: false,
    inventory: false,
    movements: false,
  });

  useEffect(() => {
    const { from, to } = getTodayRange();

    Promise.allSettled([
      getFinanceSummary({ period: 'custom', from, to }),
      getSalesReport({ period: 'custom', from, to }),
      getFinanceSummary({ period: 'month' }),
      getSalesReport({ period: 'month' }),
      getInventoryReport(),
      listFinanceMovements({ pageSize: 5 }),
    ]).then(([todayFinanceRes, todaySalesRes, monthFinanceRes, monthSalesRes, inventoryRes, movementsRes]) => {
      setData({
        todayFinance: todayFinanceRes.status === 'fulfilled' ? todayFinanceRes.value : null,
        todaySales: todaySalesRes.status === 'fulfilled' ? todaySalesRes.value : null,
        monthFinance: monthFinanceRes.status === 'fulfilled' ? monthFinanceRes.value : null,
        monthSales: monthSalesRes.status === 'fulfilled' ? monthSalesRes.value : null,
        inventory: inventoryRes.status === 'fulfilled' ? inventoryRes.value : null,
        movements: movementsRes.status === 'fulfilled' ? movementsRes.value.items : null,
        movementsTotal: movementsRes.status === 'fulfilled' ? movementsRes.value.total : 0,
      });
      setErrors({
        todayFinance: todayFinanceRes.status === 'rejected',
        todaySales: todaySalesRes.status === 'rejected',
        monthFinance: monthFinanceRes.status === 'rejected',
        monthSales: monthSalesRes.status === 'rejected',
        inventory: inventoryRes.status === 'rejected',
        movements: movementsRes.status === 'rejected',
      });
      setLoading(false);
    });
  }, []);

  const todayActiveTotal = data.todaySales
    ? Number(data.todaySales.grossTotal) - Number(data.todaySales.cancellationsTotal)
    : 0;
  const monthActiveTotal = data.monthSales
    ? Number(data.monthSales.grossTotal) - Number(data.monthSales.cancellationsTotal)
    : 0;

  const hasEverHadActivity = data.movementsTotal > 0;

  return (
    <div className="dashboard">
      <header className="dashboard__greeting">
        <h1>
          {greeting}, {firstName}
        </h1>
        <p>Este es el resumen de MALA MÍA.</p>
      </header>

      <section aria-label="Resumen del día" className="dashboard__grid">
        <StatCard
          label="Ventas de hoy"
          loading={loading}
          error={errors.todaySales}
          value={data.todaySales ? String(data.todaySales.salesCount) : undefined}
          hint={data.todaySales ? `${formatMoney(todayActiveTotal)} vendidos hoy` : undefined}
        />
        <StatCard
          label="Ganancia de hoy"
          loading={loading}
          error={errors.todayFinance}
          value={data.todayFinance ? formatMoney(data.todayFinance.distribution.realProfit) : undefined}
        />
      </section>

      <section aria-label="Inventario" className="dashboard__grid">
        <StatCard
          label="Productos en inventario"
          loading={loading}
          error={errors.inventory}
          value={data.inventory ? String(data.inventory.productsCount) : undefined}
          hint={data.inventory ? `${data.inventory.totalUnits} unidades` : undefined}
        />
        <StatCard
          label="Alertas de stock bajo"
          loading={loading}
          error={errors.inventory}
          value={data.inventory ? String(data.inventory.lowStockCount) : undefined}
          hint={
            data.inventory
              ? data.inventory.outOfStockCount > 0
                ? `${data.inventory.outOfStockCount} agotados`
                : 'Todo con buen stock'
              : undefined
          }
        />
      </section>

      <section aria-label="Resumen mensual" className="dashboard__grid">
        <StatCard
          label="Ventas del mes"
          loading={loading}
          error={errors.monthSales}
          value={data.monthSales ? String(data.monthSales.salesCount) : undefined}
          hint={data.monthSales ? `${formatMoney(monthActiveTotal)} vendidos este mes` : undefined}
        />
        <StatCard
          label="Ganancia del mes"
          loading={loading}
          error={errors.monthFinance}
          value={data.monthFinance ? formatMoney(data.monthFinance.distribution.realProfit) : undefined}
        />
      </section>

      {loading ? null : errors.movements ? (
        <Card>
          <p className="dashboard__error">No se pudo cargar la actividad reciente.</p>
        </Card>
      ) : hasEverHadActivity ? (
        <RecentMovements
          movements={data.movements ?? []}
          title="Actividad reciente"
          emptyLabel="Sin movimientos en los últimos días."
        />
      ) : (
        <Card>
          <EmptyState
            title="Todavía no hay actividad registrada"
            description="Cuando empieces a vender, comprar y registrar gastos, este panel mostrará el resumen real de MALA MÍA."
          />
        </Card>
      )}

      <section aria-label="Acciones rápidas">
        <h2 className="dashboard__section-title">Acciones rápidas</h2>
        <QuickActions />
      </section>
    </div>
  );
}
