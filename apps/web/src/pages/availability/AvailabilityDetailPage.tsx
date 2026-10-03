import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAvailabilityDetail } from '../../api/availability';
import { ApiError } from '../../api/client';
import { Card } from '../../components/Card';
import { Loading } from '../../components/Loading';
import { useNotify } from '../../notifications/useNotify';
import type { AvailabilityProductDetail, AvailabilityStatus } from '../../types/availability';
import './AvailabilityDetailPage.css';

const STATUS_LABELS: Record<AvailabilityStatus, string> = {
  DISPONIBLE: 'Disponible',
  STOCK_BAJO: 'Pocas unidades',
  AGOTADO: 'Agotado',
};

export function AvailabilityDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const notify = useNotify();
  const [product, setProduct] = useState<AvailabilityProductDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!productId) return;
    getAvailabilityDetail(productId)
      .then(setProduct)
      .catch((error: unknown) => {
        notify.error(error instanceof ApiError ? error.message : 'No se pudo cargar el producto.');
      })
      .finally(() => setLoading(false));
  }, [productId, notify]);

  if (loading) {
    return <Loading fullPage label="Cargando producto…" />;
  }

  if (!product) {
    return (
      <Card>
        <p>No se encontró el producto.</p>
        <Link to="/disponibilidad">Volver a disponibilidad</Link>
      </Card>
    );
  }

  return (
    <div className="availability-detail">
      <header className="availability-detail__header">
        <h1>{product.name}</h1>
        <Link to="/disponibilidad" className="availability-detail__back">
          ← Volver
        </Link>
      </header>

      <Card className="availability-detail__summary">
        <span className="availability-detail__code">
          {product.code} · {product.category.name}
        </span>
        {product.description ? (
          <p className="availability-detail__description">{product.description}</p>
        ) : null}
        {product.salePrice ? (
          <span className="availability-detail__price">Q{product.salePrice}</span>
        ) : null}
        {product.waistMeasurement || product.lengthMeasurement ? (
          <span className="availability-detail__measurements">
            {[
              product.waistMeasurement ? `Cintura ${product.waistMeasurement}cm` : null,
              product.lengthMeasurement ? `Largo ${product.lengthMeasurement}cm` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        ) : null}
      </Card>

      <Card className="availability-detail__variants">
        <h2>Combinaciones</h2>
        {product.variants.length === 0 ? (
          <p>Este producto no tiene combinaciones activas.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Talla</th>
                <th>Color</th>
                <th>Stock</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => (
                <tr key={`${variant.sizeId}-${variant.colorId}`}>
                  <td>{variant.sizeName}</td>
                  <td>{variant.colorName}</td>
                  <td>
                    <span
                      className={`availability-detail__status availability-detail__status--${variant.status.toLowerCase()}`}
                    >
                      {variant.status === 'AGOTADO' ? STATUS_LABELS[variant.status] : variant.quantity}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
