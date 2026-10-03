import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getDistributionSettings,
  getFinanceSummary,
  listFinanceMovements,
  updateDistributionSettings,
} from '../../api/finance';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Loading } from '../../components/Loading';
import { RecentMovements } from '../../components/RecentMovements';
import { formatMoney } from '../../lib/money';
import { useNotify } from '../../notifications/useNotify';
import type { DistributionSettings, FinanceMovement, FinancePeriod, FinanceSummary } from '../../types/finance';
import './FinancePage.css';

const PERIOD_LABELS: Record<FinancePeriod, string> = {
  week: 'Esta semana',
  month: 'Este mes',
  year: 'Este año',
  custom: 'Personalizado',
};

/** "Mi dinero vs. reinversión" se reinicia cada semana calendario a
 * propósito (es una asignación semanal, no acumulada) — por eso usa siempre
 * `period: 'week'` aquí, sin importar qué período tenga seleccionado el
 * resto de la pantalla de Finanzas. */
function DistributionSection({ summary }: { summary: FinanceSummary }) {
  const notify = useNotify();
  const [editing, setEditing] = useState(false);
  const [settings, setSettings] = useState<DistributionSettings | null>(null);
  const [personal, setPersonal] = useState('');
  const [reinvestment, setReinvestment] = useState('');
  const [reserve, setReserve] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getDistributionSettings()
      .then((s) => {
        setSettings(s);
        setPersonal(s.personalPercentage);
        setReinvestment(s.reinvestmentPercentage);
        setReserve(s.reservePercentage);
      })
      .catch(() => undefined);
  }, []);

  const sum = (Number(personal) || 0) + (Number(reinvestment) || 0) + (Number(reserve) || 0);
  const sumValid = Math.abs(sum - 100) < 0.01;

  async function handleSave() {
    if (!sumValid) {
      notify.error('Los porcentajes deben sumar 100%.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateDistributionSettings({
        personalPercentage: Number(personal),
        reinvestmentPercentage: Number(reinvestment),
        reservePercentage: Number(reserve),
      });
      setSettings(updated);
      notify.success('Distribución actualizada.');
      setEditing(false);
    } catch (error) {
      notify.error(
        error instanceof ApiError ? error.message : 'No se pudo actualizar la distribución.',
      );
    } finally {
      setSaving(false);
    }
  }

  const { distribution } = summary;

  return (
    <Card className="finance__distribution">
      <h2>Mi dinero vs. reinversión</h2>
      <p className="finance__distribution-hint">
        {distribution.hasProfit
          ? `Según la utilidad real de ${summary.period.label.toLowerCase()}.`
          : 'No hay utilidad que repartir en este periodo todavía.'}
      </p>

      <div className="finance__distribution-rows">
        <div className="finance__distribution-row">
          <span className="finance__distribution-row-label">
            💗 Para mí
            <span className="finance__distribution-percent">{distribution.personalPercentage}%</span>
          </span>
          <span className="finance__distribution-amount">
            {formatMoney(distribution.personalAmount)}
          </span>
        </div>
        <div className="finance__distribution-row">
          <span className="finance__distribution-row-label">
            📦 Reinversión
            <span className="finance__distribution-percent">
              {distribution.reinvestmentPercentage}%
            </span>
          </span>
          <span className="finance__distribution-amount">
            {formatMoney(distribution.reinvestmentAmount)}
          </span>
        </div>
        <div className="finance__distribution-row">
          <span className="finance__distribution-row-label">
            🏦 Reserva
            <span className="finance__distribution-percent">{distribution.reservePercentage}%</span>
          </span>
          <span className="finance__distribution-amount">
            {formatMoney(distribution.reserveAmount)}
          </span>
        </div>
      </div>

      <div className="finance__distribution-footer">
        <button
          type="button"
          className="finance__disclosure-toggle"
          onClick={() => setEditing((prev) => !prev)}
        >
          {editing ? 'Cancelar' : 'Ajustar distribución'}
        </button>
      </div>

      {editing && settings ? (
        <div className="finance__settings-form">
          <div className="finance__settings-row">
            <div className="field">
              <label className="field__label" htmlFor="dist-personal">
                Para mí (%)
              </label>
              <input
                id="dist-personal"
                className="field__input"
                type="number"
                min="0"
                max="100"
                value={personal}
                onChange={(event) => setPersonal(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="dist-reinvestment">
                Reinversión (%)
              </label>
              <input
                id="dist-reinvestment"
                className="field__input"
                type="number"
                min="0"
                max="100"
                value={reinvestment}
                onChange={(event) => setReinvestment(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="dist-reserve">
                Reserva (%)
              </label>
              <input
                id="dist-reserve"
                className="field__input"
                type="number"
                min="0"
                max="100"
                value={reserve}
                onChange={(event) => setReserve(event.target.value)}
              />
            </div>
          </div>
          <span className={`finance__settings-sum${sumValid ? '' : ' finance__settings-sum--invalid'}`}>
            Suma: {sum}% {sumValid ? '' : '(debe ser 100%)'}
          </span>
          <div className="finance__settings-actions">
            <Button type="button" loading={saving} onClick={() => void handleSave()}>
              Guardar
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

function BreakdownSection({ summary }: { summary: FinanceSummary }) {
  const [open, setOpen] = useState(false);
  const { breakdown } = summary;

  return (
    <Card>
      <div className="finance__breakdown-header">
        <h2>Desglose del periodo</h2>
        <button
          type="button"
          className="finance__disclosure-toggle"
          onClick={() => setOpen((p) => !p)}
        >
          {open ? 'Ocultar ↑' : 'Ver desglose ↓'}
        </button>
      </div>
      {open ? (
        <div className="finance__breakdown">
          <div className="finance__breakdown-row finance__breakdown-row--in">
            <span>Ventas</span>
            <span className="finance__breakdown-value">{formatMoney(breakdown.ventas)}</span>
          </div>
          {Number(breakdown.ingresoManual) > 0 ? (
            <div className="finance__breakdown-row finance__breakdown-row--in">
              <span>Ingreso manual</span>
              <span className="finance__breakdown-value">
                {formatMoney(breakdown.ingresoManual)}
              </span>
            </div>
          ) : null}
          {Number(breakdown.devoluciones) > 0 ? (
            <div className="finance__breakdown-row finance__breakdown-row--out">
              <span>Devoluciones</span>
              <span className="finance__breakdown-value">
                − {formatMoney(breakdown.devoluciones)}
              </span>
            </div>
          ) : null}
          {Number(breakdown.cancelaciones) > 0 ? (
            <div className="finance__breakdown-row finance__breakdown-row--out">
              <span>Cancelaciones</span>
              <span className="finance__breakdown-value">
                − {formatMoney(breakdown.cancelaciones)}
              </span>
            </div>
          ) : null}
          <div className="finance__breakdown-row finance__breakdown-row--out">
            <span>Compras de mercadería</span>
            <span className="finance__breakdown-value">− {formatMoney(breakdown.compras)}</span>
          </div>
          <div className="finance__breakdown-row finance__breakdown-row--out">
            <span>Gastos operativos</span>
            <span className="finance__breakdown-value">− {formatMoney(breakdown.gastos)}</span>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

export function FinancePage() {
  const notify = useNotify();
  const [period, setPeriod] = useState<FinancePeriod>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [weekSummary, setWeekSummary] = useState<FinanceSummary | null>(null);
  const [movements, setMovements] = useState<FinanceMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (period === 'custom' && (!customFrom || !customTo)) return;

    const timer = setTimeout(() => {
      setLoading(true);
      Promise.all([
        getFinanceSummary({ period, from: customFrom || undefined, to: customTo || undefined }),
        // "Mi dinero vs. reinversión" siempre se calcula sobre la semana
        // actual, sin importar el periodo que la persona elija arriba —
        // es una asignación semanal, no acumulada.
        period === 'week' ? null : getFinanceSummary({ period: 'week' }),
        listFinanceMovements({ pageSize: 5 }),
      ])
        .then(([summaryRes, weekRes, movementsRes]) => {
          setSummary(summaryRes);
          setWeekSummary(period === 'week' ? summaryRes : weekRes);
          setMovements(movementsRes.items);
        })
        .catch((error: unknown) => {
          notify.error(
            error instanceof ApiError ? error.message : 'No se pudo cargar el resumen financiero.',
          );
        })
        .finally(() => setLoading(false));
    }, 0);

    return () => clearTimeout(timer);
  }, [period, customFrom, customTo, notify]);

  return (
    <div className="finance">
      <header className="finance__header">
        <div>
          <h1>Finanzas</h1>
          <p>El centro económico de MALA MÍA.</p>
        </div>
        <div className="finance__header-actions">
          <Link to="/finanzas/reportes">
            <Button variant="secondary">Ver reportes</Button>
          </Link>
          <Link to="/finanzas/ingresos/nuevo">
            <Button variant="secondary">Registrar ingreso</Button>
          </Link>
          <Link to="/finanzas/gastos/nuevo">
            <Button>Registrar gasto</Button>
          </Link>
        </div>
      </header>

      <div className="finance__period">
        <select
          aria-label="Periodo"
          id="finance-period"
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
      </div>

      {loading || !summary ? (
        <Loading label="Cargando resumen…" />
      ) : (
        <>
          <div className="finance__summary">
            <Card className="finance__summary-card finance__summary-card--in">
              <span className="finance__summary-label">Ingresos</span>
              <span className="finance__summary-value">{formatMoney(summary.ingresos)}</span>
            </Card>
            <Card className="finance__summary-card finance__summary-card--out">
              <span className="finance__summary-label">Salidas</span>
              <span className="finance__summary-value">{formatMoney(summary.salidas)}</span>
            </Card>
            <Card
              className={`finance__summary-card finance__summary-card--available${
                Number(summary.ingresos) - Number(summary.salidas) < 0
                  ? ' finance__summary-card--deficit'
                  : ''
              }`}
            >
              <span className="finance__summary-label">Resultado del período</span>
              <span className="finance__summary-value">
                {formatMoney(String(Number(summary.ingresos) - Number(summary.salidas)))}
              </span>
            </Card>
          </div>

          {weekSummary ? <DistributionSection summary={weekSummary} /> : null}
          <BreakdownSection summary={summary} />
          <RecentMovements movements={movements} />
        </>
      )}
    </div>
  );
}
