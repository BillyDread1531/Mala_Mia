import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listInventory } from '../../api/inventory';
import { ApiError } from '../../api/client';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { useNotify } from '../../notifications/useNotify';
import type { InventoryItem, InventoryStatus } from '../../types/inventory';
import './InventoryListPage.css';

const SEARCH_DEBOUNCE_MS = 350;

const STATUS_LABEL: Record<InventoryStatus, string> = {
  DISPONIBLE: 'Disponible',
  STOCK_BAJO: 'Stock bajo',
  AGOTADO: 'Agotado',
};

export function InventoryListPage() {
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<InventoryItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      listInventory({ search: search.trim() || undefined })
        .then((res) => {
          if (!cancelled) setItems(res.items);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          notify.error(error instanceof ApiError ? error.message : 'No se pudo cargar el inventario.');
          setItems([]);
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
    <div className="inventory-list">
      <header className="inventory-list__header">
        <div>
          <h1>Inventario</h1>
          <p>Existencias actuales por talla y color.</p>
        </div>
        <Link to="/inventario" className="inventory-list__back">
          ← Ver catálogo de productos
        </Link>
      </header>

      <Input
        label="Buscar"
        placeholder="Producto, código, talla o color"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {loading ? (
        <Loading label="Buscando inventario…" />
      ) : !items || items.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin existencias registradas"
            description="El inventario se genera automáticamente cuando confirmas una compra."
          />
        </Card>
      ) : (
        <ul className="inventory-list__items">
          {items.map((item) => (
            <li key={item.id}>
              <Link to={`/inventario/stock/${item.id}`} className="inventory-row">
                <div className="inventory-row__main">
                  <span className="inventory-row__name">{item.product.name}</span>
                  <span className="inventory-row__code">
                    {item.product.code} · {item.sizeName} / {item.colorName}
                  </span>
                </div>
                <div className="inventory-row__qty">{item.quantity} u.</div>
                <span className={`inventory-badge inventory-badge--${item.status.toLowerCase()}`}>
                  {STATUS_LABEL[item.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
