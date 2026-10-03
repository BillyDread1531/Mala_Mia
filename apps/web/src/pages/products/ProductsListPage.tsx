import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listProducts } from '../../api/products';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { useNotify } from '../../notifications/useNotify';
import type { Product } from '../../types/product';
import './ProductsListPage.css';

const SEARCH_DEBOUNCE_MS = 350;

export function ProductsListPage() {
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(() => {
      setLoading(true);
      listProducts({ search: search.trim() || undefined, includeInactive: showInactive })
        .then((res) => {
          if (cancelled) return;
          setProducts(res.items);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          notify.error(
            error instanceof ApiError
              ? error.message
              : 'No se pudieron cargar los productos.',
          );
          setProducts([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, showInactive, notify]);

  return (
    <div className="products-list">
      <header className="products-list__header">
        <div>
          <h1>Productos</h1>
          <p>El catálogo de MALA MÍA.</p>
        </div>
        <div className="products-list__header-actions">
          <Link to="/inventario/stock" className="products-list__stock-link">
            Ver inventario →
          </Link>
          <Link to="/inventario/nuevo">
            <Button>Nuevo producto</Button>
          </Link>
        </div>
      </header>

      <div className="products-list__filters">
        <Input
          label="Buscar"
          placeholder="Nombre o código, ej. blusa satin"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="products-list__checkbox">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
          />
          Mostrar inactivos
        </label>
      </div>

      {loading ? (
        <Loading label="Buscando productos…" />
      ) : !products || products.length === 0 ? (
        <Card>
          <EmptyState
            title={search ? 'Sin resultados' : 'Todavía no hay productos'}
            description={
              search
                ? 'No encontramos productos que coincidan con tu búsqueda.'
                : 'Crea el primer producto de MALA MÍA para empezar el catálogo.'
            }
            action={
              !search ? (
                <Link to="/inventario/nuevo">
                  <Button variant="secondary">Nuevo producto</Button>
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <ul className="products-list__items">
          {products.map((product) => (
            <li key={product.id}>
              <Link to={`/inventario/${product.id}`} className="product-row">
                <div className="product-row__main">
                  <span className="product-row__name">{product.name}</span>
                  <span className="product-row__code">{product.code}</span>
                  {!product.isAvailableForSale ? (
                    <span className="product-row__badge">Inactivo</span>
                  ) : null}
                </div>
                <div className="product-row__meta">
                  <span>{product.category.name}</span>
                  <span>
                    {product.variantCount === 0
                      ? 'Sin combinaciones'
                      : `${product.variantCount} combinación${product.variantCount === 1 ? '' : 'es'}`}
                  </span>
                </div>
                <div className="product-row__price">
                  {product.salePrice ? `Q${product.salePrice}` : '—'}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
