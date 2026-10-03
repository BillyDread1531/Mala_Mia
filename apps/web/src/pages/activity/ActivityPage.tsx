import { useEffect, useState } from 'react';
import { listActivity } from '../../api/audit';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { useNotify } from '../../notifications/useNotify';
import type { ActivityEntry } from '../../types/audit';
import { ACTIVITY_ACTION_LABELS } from '../../types/audit';
import './ActivityPage.css';

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

export function ActivityPage() {
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);

  const [entries, setEntries] = useState<ActivityEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      listActivity({
        search: search.trim() || undefined,
        action: action || undefined,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
        .then((res) => {
          setEntries(res.items);
          setTotal(res.total);
        })
        .catch((error: unknown) => {
          notify.error(
            error instanceof ApiError ? error.message : 'No se pudo cargar la actividad.',
          );
          setEntries([]);
        })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [search, action, from, to, page, notify]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="activity">
      <header className="activity__header">
        <h1>Actividad</h1>
        <p>Qué pasó, cuándo y quién lo hizo.</p>
      </header>

      <div className="activity__filters">
        <Input
          label="Buscar"
          placeholder="Descripción"
          value={search}
          onChange={(event) => {
            setPage(1);
            setSearch(event.target.value);
          }}
        />
        <button
          type="button"
          className="activity__filters-toggle"
          onClick={() => setShowFilters((prev) => !prev)}
        >
          {showFilters ? 'Ocultar filtros' : 'Más filtros'}
        </button>
      </div>

      {showFilters ? (
        <div className="activity__filters-extra">
          <select
            aria-label="Tipo de acción"
            className="field__input"
            value={action}
            onChange={(event) => {
              setPage(1);
              setAction(event.target.value);
            }}
          >
            <option value="">Todas las acciones</option>
            {Object.entries(ACTIVITY_ACTION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
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
      ) : null}

      {loading ? (
        <Loading label="Cargando actividad…" />
      ) : !entries || entries.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin actividad"
            description="No encontramos actividad que coincida con los filtros."
            showHeart={false}
          />
        </Card>
      ) : (
        <Card className="activity__list">
          {entries.map((entry) => (
            <div key={entry.id} className="activity__row">
              <div className="activity__info">
                <span className="activity__type">
                  {ACTIVITY_ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <span className="activity__description">{entry.description}</span>
              </div>
              <div className="activity__meta">
                <span>{entry.userName}</span>
                <span>{formatDateTime(entry.createdAt)}</span>
              </div>
            </div>
          ))}
        </Card>
      )}

      {totalPages > 1 ? (
        <div className="activity__pagination">
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
