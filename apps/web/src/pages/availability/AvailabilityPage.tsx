import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listAvailability } from '../../api/availability';
import { listCategories, listColors, listSizes } from '../../api/catalog';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { formatMoney } from '../../lib/money';
import { useNotify } from '../../notifications/useNotify';
import type { Category, Color, Size } from '../../types/catalog';
import type { AvailabilityItem, AvailabilityStatus } from '../../types/availability';
import './AvailabilityPage.css';

const STATUS_OPTIONS: { value: AvailabilityStatus | ''; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'DISPONIBLE', label: 'Disponibles' },
  { value: 'STOCK_BAJO', label: 'Pocas unidades' },
  { value: 'AGOTADO', label: 'Agotados' },
];

function matchesSearch(item: AvailabilityItem, tokens: string[]): boolean {
  const haystack = [
    item.productName,
    item.productCode,
    item.categoryName,
    item.sizeName,
    item.colorName,
  ]
    .join(' ')
    .toLowerCase();
  return tokens.every((token) => haystack.includes(token));
}

export function AvailabilityPage() {
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [sizeId, setSizeId] = useState<number | ''>('');
  const [colorId, setColorId] = useState<number | ''>('');
  const [status, setStatus] = useState<AvailabilityStatus | ''>('');

  const [allItems, setAllItems] = useState<AvailabilityItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    Promise.all([listCategories(), listSizes(), listColors()])
      .then(([cats, szs, cols]) => {
        setCategories(cats);
        setSizes(szs);
        setColors(cols);
      })
      .catch(() => undefined);
  }, []);

  // Solo categoría/talla/color requieren volver a pedir datos al backend.
  // El texto de búsqueda y el estado se filtran en memoria para que la
  // búsqueda se sienta instantánea (ver decisión de rendimiento documentada
  // en AvailabilityService).
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      setLoadError(false);
      listAvailability({
        categoryId: categoryId || undefined,
        sizeId: sizeId || undefined,
        colorId: colorId || undefined,
      })
        .then((res) => {
          if (cancelled) return;
          setAllItems(res.items);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          notify.error(
            error instanceof ApiError ? error.message : 'No se pudo cargar la disponibilidad.',
          );
          setLoadError(true);
          setAllItems(null);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [categoryId, sizeId, colorId, notify, reloadToken]);

  const searchTokens = useMemo(
    () => search.trim().toLowerCase().split(/\s+/).filter(Boolean),
    [search],
  );

  const searchedItems = useMemo(() => {
    if (!allItems) return [];
    if (searchTokens.length === 0) return allItems;
    return allItems.filter((item) => matchesSearch(item, searchTokens));
  }, [allItems, searchTokens]);

  const summary = useMemo(
    () => ({
      products: new Set(searchedItems.map((i) => i.productId)).size,
      available: searchedItems.filter((i) => i.status === 'DISPONIBLE').length,
      lowStock: searchedItems.filter((i) => i.status === 'STOCK_BAJO').length,
      outOfStock: searchedItems.filter((i) => i.status === 'AGOTADO').length,
    }),
    [searchedItems],
  );

  const visibleItems = useMemo(
    () => (status ? searchedItems.filter((i) => i.status === status) : searchedItems),
    [searchedItems, status],
  );

  const groups = useMemo(() => {
    const byProduct = new Map<
      string,
      {
        productName: string;
        productCode: string;
        salePrice: string | null;
        waistMeasurement: string | null;
        lengthMeasurement: string | null;
        items: AvailabilityItem[];
      }
    >();
    for (const item of visibleItems) {
      const group = byProduct.get(item.productId) ?? {
        productName: item.productName,
        productCode: item.productCode,
        salePrice: item.salePrice,
        waistMeasurement: item.waistMeasurement,
        lengthMeasurement: item.lengthMeasurement,
        items: [],
      };
      group.items.push(item);
      byProduct.set(item.productId, group);
    }
    return [...byProduct.entries()].map(([productId, group]) => {
      const bySize = new Map<string, { sizeName: string; items: AvailabilityItem[] }>();
      for (const item of group.items) {
        const sizeGroup = bySize.get(item.sizeId) ?? { sizeName: item.sizeName, items: [] };
        sizeGroup.items.push(item);
        bySize.set(item.sizeId, sizeGroup);
      }
      return { productId, ...group, sizes: [...bySize.values()] };
    });
  }, [visibleItems]);

  const hasActiveFilters = categoryId !== '' || sizeId !== '' || colorId !== '';

  return (
    <div className="availability">
      <header className="availability__header">
        <h1>Disponibilidad de productos</h1>
        <p>Consulta rápida de lo que hay en tienda.</p>
      </header>

      <div className="availability__summary">
        <Card className="availability__stat">
          <span className="availability__stat-value">{summary.products}</span>
          <span className="availability__stat-label">Productos</span>
        </Card>
        <Card className="availability__stat availability__stat--available">
          <span className="availability__stat-value">{summary.available}</span>
          <span className="availability__stat-label">Disponibles</span>
        </Card>
        <Card className="availability__stat availability__stat--low">
          <span className="availability__stat-value">{summary.lowStock}</span>
          <span className="availability__stat-label">Pocas unidades</span>
        </Card>
        <Card className="availability__stat availability__stat--out">
          <span className="availability__stat-value">{summary.outOfStock}</span>
          <span className="availability__stat-label">Agotadas</span>
        </Card>
      </div>

      <div className="availability__toolbar">
        <Input
          label="Buscar"
          placeholder="Nombre, código, categoría, talla o color"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button
          type="button"
          variant="ghost"
          className="availability__filters-toggle"
          onClick={() => setShowFilters((prev) => !prev)}
        >
          Filtros{hasActiveFilters ? ' ●' : ''}
        </Button>
        {showFilters ? (
          <div className="availability__filters">
            <select
              aria-label="Categoría"
              className="field__input"
              value={categoryId}
              onChange={(event) =>
                setCategoryId(event.target.value ? Number(event.target.value) : '')
              }
            >
              <option value="">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Talla"
              className="field__input"
              value={sizeId}
              onChange={(event) => setSizeId(event.target.value ? Number(event.target.value) : '')}
            >
              <option value="">Todas las tallas</option>
              {sizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Color"
              className="field__input"
              value={colorId}
              onChange={(event) => setColorId(event.target.value ? Number(event.target.value) : '')}
            >
              <option value="">Todos los colores</option>
              {colors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Estado"
              className="field__input"
              value={status}
              onChange={(event) => setStatus(event.target.value as AvailabilityStatus | '')}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}
      </div>

      {loading ? (
        <Loading label="Cargando disponibilidad…" />
      ) : loadError ? (
        <Card>
          <EmptyState
            title="No se pudo cargar la disponibilidad"
            description="Revisa tu conexión e intenta de nuevo."
            action={
              <Button type="button" variant="secondary" onClick={() => setReloadToken((n) => n + 1)}>
                Reintentar
              </Button>
            }
          />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin resultados"
            description="No encontramos productos que coincidan con tu búsqueda o filtros."
          />
        </Card>
      ) : (
        <div className="availability__items">
          {groups.map((group) => (
            <Link
              key={group.productId}
              to={`/disponibilidad/${group.productId}`}
              className="availability__group"
            >
              <div className="availability__group-header">
                <span className="availability__group-name">{group.productName}</span>
                <span className="availability__group-code-block">
                  <span className="availability__group-code">{group.productCode}</span>
                  {group.salePrice ? (
                    <span className="availability__group-price">{formatMoney(group.salePrice)}</span>
                  ) : null}
                  {group.waistMeasurement || group.lengthMeasurement ? (
                    <span className="availability__group-measurements">
                      {[
                        group.waistMeasurement ? `Cintura ${group.waistMeasurement}cm` : null,
                        group.lengthMeasurement ? `Largo ${group.lengthMeasurement}cm` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  ) : null}
                </span>
              </div>
              {group.sizes.map((sizeGroup) => (
                <div key={sizeGroup.sizeName} className="availability__size-row">
                  <span className="availability__size-label">{sizeGroup.sizeName}</span>
                  <div className="availability__colors">
                    {sizeGroup.items.map((item) => (
                      <span key={item.colorId} className="availability__color-chip">
                        <span
                          className={`availability__dot availability__dot--${item.status.toLowerCase()}`}
                          aria-hidden="true"
                        />
                        {item.colorName} ·{' '}
                        {item.status === 'AGOTADO' ? 'Agotado' : item.quantity}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
