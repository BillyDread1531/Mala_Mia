import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listSales } from '../../api/sales';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { formatMoney } from '../../lib/money';
import { useNotify } from '../../notifications/useNotify';
import type { Sale } from '../../types/sale';
import './SalesListPage.css';

const SEARCH_DEBOUNCE_MS = 350;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function SalesListPage() {
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      listSales({ search: search.trim() || undefined, from: from || undefined, to: to || undefined })
        .then((res) => {
          if (cancelled) return;
          setSales(res.items);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          notify.error(error instanceof ApiError ? error.message : 'No se pudieron cargar las ventas.');
          setSales([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, from, to, notify]);

  return (
    <div className="sales-list">
      <header className="sales-list__header">
        <div>
          <h1>Ventas</h1>
          <p>Historial de ventas de MALA MÍA.</p>
        </div>
        <Link to="/ventas/nueva">
          <Button>Nueva venta</Button>
        </Link>
      </header>

      <div className="sales-list__toolbar">
        <Input
          label="Buscar"
          placeholder="Número de venta o producto"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          className="sales-list__filters-toggle"
          onClick={() => setShowFilters((prev) => !prev)}
        >
          {showFilters ? 'Ocultar filtros' : 'Más filtros'}
        </Button>
        {showFilters ? (
          <div className="sales-list__filters">
            <input
              aria-label="Desde"
              type="date"
              className="field__input"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
            />
            <input
              aria-label="Hasta"
              type="date"
              className="field__input"
              value={to}
              onChange={(event) => setTo(event.target.value)}
            />
          </div>
        ) : null}
      </div>

      {loading ? (
        <Loading label="Buscando ventas…" />
      ) : !sales || sales.length === 0 ? (
        <Card>
          <EmptyState
            title={search ? 'Sin resultados' : 'Todavía no hay ventas'}
            description={
              search
                ? 'No encontramos ventas que coincidan con tu búsqueda.'
                : 'Registra la primera venta de MALA MÍA.'
            }
            action={
              !search ? (
                <Link to="/ventas/nueva">
                  <Button variant="secondary">Nueva venta</Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="sales-list__items">
          {sales.map((sale) => (
            <li key={sale.id}>
              <Link to={`/ventas/${sale.id}`} className="sale-row">
                <div className="sale-row__main">
                  <span className="sale-row__number">Venta #{sale.saleNumber}</span>
                  <span className="sale-row__payment">{sale.paymentMethod.name}</span>
                </div>
                <div className="sale-row__meta">
                  <span>{formatDate(sale.saleDate)}</span>
                  <span>
                    {sale.itemCount} línea{sale.itemCount === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="sale-row__price">{formatMoney(sale.total)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
