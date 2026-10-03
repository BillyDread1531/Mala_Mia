import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createSupplier, listAllSuppliers } from '../../api/suppliers';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { formatMoney } from '../../lib/money';
import { useNotify } from '../../notifications/useNotify';
import type { SupplierListItem } from '../../types/supplier';
import './SuppliersListPage.css';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function SuppliersListPage() {
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    listAllSuppliers()
      .then(setSuppliers)
      .catch((error: unknown) => {
        notify.error(
          error instanceof ApiError ? error.message : 'No se pudieron cargar los proveedores.',
        );
        setSuppliers([]);
      })
      .finally(() => setLoading(false));
  }, [notify]);

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const supplier = await createSupplier({ name: newName.trim() });
      setSuppliers((prev) =>
        [...(prev ?? []), { ...supplier, purchaseCount: 0, lastPurchaseDate: null, totalPurchased: '0' }].sort(
          (a, b) => a.name.localeCompare(b.name),
        ),
      );
      notify.success('Proveedor agregado.');
      setShowNew(false);
      setNewName('');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo crear el proveedor.');
    } finally {
      setCreating(false);
    }
  }

  const filtered = useMemo(() => {
    if (!suppliers) return [];
    const term = search.trim().toLowerCase();
    return suppliers.filter((s) => {
      if (!showInactive && !s.isActive) return false;
      if (term && !s.name.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [suppliers, search, showInactive]);

  return (
    <div className="suppliers-list">
      <header className="suppliers-list__header">
        <div>
          <h1>Proveedores</h1>
          <p>A quién le compramos y cuánto llevamos con cada uno.</p>
        </div>
        <Button type="button" onClick={() => setShowNew((prev) => !prev)}>
          {showNew ? 'Cancelar' : 'Nuevo proveedor'}
        </Button>
      </header>

      {showNew ? (
        <Card className="suppliers-list__new">
          <Input
            label="Nombre del proveedor"
            placeholder="Nombre"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <div className="suppliers-list__new-actions">
            <Button type="button" loading={creating} onClick={() => void handleCreate()}>
              Guardar
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="suppliers-list__filters">
        <Input
          label="Buscar"
          placeholder="Nombre del proveedor"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="suppliers-list__checkbox">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
          />
          Mostrar inactivos
        </label>
      </div>

      {loading ? (
        <Loading label="Cargando proveedores…" />
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={search ? 'Sin resultados' : 'Todavía no hay proveedores'}
            description={
              search
                ? 'No encontramos proveedores que coincidan con tu búsqueda.'
                : 'Los proveedores se agregan al registrar tu primera compra de mercadería.'
            }
          />
        </Card>
      ) : (
        <ul className="suppliers-list__items">
          {filtered.map((supplier) => (
            <li key={supplier.id}>
              <Link to={`/proveedores/${supplier.id}`} className="supplier-row">
                <div className="supplier-row__main">
                  <span className="supplier-row__name">{supplier.name}</span>
                  {!supplier.isActive ? (
                    <span className="supplier-row__badge">Inactivo</span>
                  ) : null}
                </div>
                <div className="supplier-row__meta">
                  <span>
                    {supplier.purchaseCount} compra{supplier.purchaseCount === 1 ? '' : 's'}
                  </span>
                  <span>
                    {supplier.lastPurchaseDate
                      ? `Última: ${formatDate(supplier.lastPurchaseDate)}`
                      : 'Sin compras todavía'}
                  </span>
                </div>
                <div className="supplier-row__total">{formatMoney(supplier.totalPurchased)}</div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
