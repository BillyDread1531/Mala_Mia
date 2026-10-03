import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listFinanceMovements } from '../../api/finance';
import { ApiError } from '../../api/client';
import { listPaymentMethods } from '../../api/catalog';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { formatMoney } from '../../lib/money';
import { useNotify } from '../../notifications/useNotify';
import type { PaymentMethod } from '../../types/catalog';
import type { FinanceDirection, FinanceMovement } from '../../types/finance';
import { MOVEMENT_TYPE_LABELS } from '../../types/finance';
import './FinanceMovementsPage.css';

const PAGE_SIZE = 20;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function FinanceMovementsPage() {
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [movementType, setMovementType] = useState('');
  const [direction, setDirection] = useState<FinanceDirection | ''>('');
  const [paymentMethodId, setPaymentMethodId] = useState<number | ''>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [movements, setMovements] = useState<FinanceMovement[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Un movimiento puede venir de una venta, compra o gasto, cada uno con
    // su propio contexto de formas de pago válidas: se unen las tres listas
    // para que el filtro cubra cualquier movimiento existente.
    Promise.all([
      listPaymentMethods('sales'),
      listPaymentMethods('purchases'),
      listPaymentMethods('expenses'),
    ])
      .then(([sales, purchases, expenses]) => {
        const byId = new Map(
          [...sales, ...purchases, ...expenses].map((m) => [m.id, m]),
        );
        setPaymentMethods(
          [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)),
        );
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      listFinanceMovements({
        search: search.trim() || undefined,
        movementType: movementType || undefined,
        direction: direction || undefined,
        paymentMethodId: paymentMethodId || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
        .then((res) => {
          setMovements(res.items);
          setTotal(res.total);
        })
        .catch((error: unknown) => {
          notify.error(
            error instanceof ApiError ? error.message : 'No se pudieron cargar los movimientos.',
          );
          setMovements([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, movementType, direction, paymentMethodId, from, to, page, notify]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="finance-movements">
      <header className="finance-movements__header">
        <h1>Movimientos</h1>
        <Link to="/finanzas" className="finance-movements__back">
          ← Volver a Finanzas
        </Link>
      </header>

      <Input
        label="Buscar"
        placeholder="Descripción del movimiento"
        value={search}
        onChange={(event) => {
          setPage(1);
          setSearch(event.target.value);
        }}
      />

      <div className="finance-movements__filters">
        <select
          aria-label="Tipo"
          className="field__input"
          value={movementType}
          onChange={(event) => {
            setPage(1);
            setMovementType(event.target.value);
          }}
        >
          <option value="">Todos los tipos</option>
          {Object.entries(MOVEMENT_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          aria-label="Entrada/salida"
          className="field__input"
          value={direction}
          onChange={(event) => {
            setPage(1);
            setDirection(event.target.value as FinanceDirection | '');
          }}
        >
          <option value="">Entradas y salidas</option>
          <option value="IN">Solo entradas</option>
          <option value="OUT">Solo salidas</option>
        </select>
        <select
          aria-label="Forma de pago"
          className="field__input"
          value={paymentMethodId}
          onChange={(event) => {
            setPage(1);
            setPaymentMethodId(event.target.value ? Number(event.target.value) : '');
          }}
        >
          <option value="">Todas las formas de pago</option>
          {paymentMethods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Desde"
          type="date"
          className="field__input"
          value={from}
          onChange={(event) => {
            setPage(1);
            setFrom(event.target.value);
          }}
        />
        <input
          aria-label="Hasta"
          type="date"
          className="field__input"
          value={to}
          onChange={(event) => {
            setPage(1);
            setTo(event.target.value);
          }}
        />
      </div>

      {loading ? (
        <Loading label="Cargando movimientos…" />
      ) : !movements || movements.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin movimientos"
            description="No encontramos movimientos que coincidan con los filtros."
          />
        </Card>
      ) : (
        <Card className="finance-movements__list">
          {movements.map((m) => (
            <div key={m.id} className="finance-movements__row">
              <div className="finance-movements__info">
                <span className="finance-movements__type">
                  {MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType}
                </span>
                <span className="finance-movements__meta">
                  {m.description} · {formatDateTime(m.movementDate)}
                  {m.paymentMethod ? ` · ${m.paymentMethod.name}` : ''}
                </span>
              </div>
              <span
                className={`finance-movements__amount finance-movements__amount--${m.direction.toLowerCase()}`}
              >
                {m.direction === 'IN' ? '+' : '−'} {formatMoney(m.amount)}
              </span>
            </div>
          ))}
        </Card>
      )}

      {totalPages > 1 ? (
        <div className="finance-movements__pagination">
          <Button
            type="button"
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <span>
            Página {page} de {totalPages}
          </span>
          <Button
            type="button"
            variant="ghost"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Siguiente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
