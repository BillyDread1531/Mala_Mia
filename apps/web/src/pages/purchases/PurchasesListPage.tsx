import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPurchases } from '../../api/purchases';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { useNotify } from '../../notifications/useNotify';
import type { Purchase } from '../../types/purchase';
import './PurchasesListPage.css';

const SEARCH_DEBOUNCE_MS = 350;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function PurchasesListPage() {
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [purchases, setPurchases] = useState<Purchase[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      listPurchases({ search: search.trim() || undefined })
        .then((res) => {
          if (cancelled) return;
          setPurchases(res.items);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          notify.error(
            error instanceof ApiError ? error.message : 'No se pudieron cargar las compras.',
          );
          setPurchases([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, notify]);

  return (
    <div className="purchases-list">
      <header className="purchases-list__header">
        <div>
          <h1>Compras</h1>
          <p>Historial de mercadería adquirida.</p>
        </div>
        <Link to="/compras/nueva">
          <Button>Nueva compra</Button>
        </Link>
      </header>

      <Input
        label="Buscar"
        placeholder="Proveedor o número de compra"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {loading ? (
        <Loading label="Buscando compras…" />
      ) : !purchases || purchases.length === 0 ? (
        <Card>
          <EmptyState
            title={search ? 'Sin resultados' : 'Todavía no hay compras'}
            description={
              search
                ? 'No encontramos compras que coincidan con tu búsqueda.'
                : 'Registra la primera compra de mercadería para MALA MÍA.'
            }
            action={
              !search ? (
                <Link to="/compras/nueva">
                  <Button variant="secondary">Nueva compra</Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="purchases-list__items">
          {purchases.map((purchase) => (
            <li key={purchase.id}>
              <Link to={`/compras/${purchase.id}`} className="purchase-row">
                <div className="purchase-row__main">
                  <span className="purchase-row__number">Compra #{purchase.purchaseNumber}</span>
                  <span className="purchase-row__supplier">{purchase.supplier.name}</span>
                </div>
                <div className="purchase-row__meta">
                  <span>{formatDate(purchase.purchaseDate)}</span>
                  <span>
                    {purchase.itemCount} línea{purchase.itemCount === 1 ? '' : 's'}
                  </span>
                </div>
                <div className="purchase-row__price">Q{purchase.totalCost}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
