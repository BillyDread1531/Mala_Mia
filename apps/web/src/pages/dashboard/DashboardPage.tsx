import { useState } from 'react';
import { useAuth } from '../../auth/useAuth';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { QuickActions } from './QuickActions';
import { StatCard } from './StatCard';
import './DashboardPage.css';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Buenos días';
  if (hour < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

export function DashboardPage() {
  const { user } = useAuth();
  const firstName = user?.fullName.split(' ')[0] ?? '';
  const [currentHour] = useState(() => new Date().getHours());
  const greeting = greetingForHour(currentHour);

  return (
    <div className="dashboard">
      <header className="dashboard__greeting">
        <h1>
          {greeting}, {firstName}
        </h1>
        <p>Este es el resumen de MALA MÍA.</p>
      </header>

      <section aria-label="Resumen del día" className="dashboard__grid">
        <StatCard label="Ventas de hoy" />
        <StatCard label="Ganancia de hoy" />
      </section>

      <section aria-label="Inventario" className="dashboard__grid">
        <StatCard label="Productos en inventario" />
        <StatCard label="Alertas de stock bajo" hint="Ninguna alerta todavía" />
      </section>

      <section aria-label="Resumen mensual" className="dashboard__grid">
        <StatCard label="Ventas del mes" />
        <StatCard label="Ganancia del mes" />
      </section>

      <Card>
        <EmptyState
          title="Todavía no hay actividad registrada"
          description="Cuando empieces a vender, comprar y registrar gastos, este panel mostrará el resumen real de MALA MÍA."
        />
      </Card>

      <section aria-label="Acciones rápidas">
        <h2 className="dashboard__section-title">Acciones rápidas</h2>
        <QuickActions />
      </section>
    </div>
  );
}
