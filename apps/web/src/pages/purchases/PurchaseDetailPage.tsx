import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPurchase } from '../../api/purchases';
import { ApiError } from '../../api/client';
import { Card } from '../../components/Card';
import { Loading } from '../../components/Loading';
import { useNotify } from '../../notifications/useNotify';
import type { Purchase } from '../../types/purchase';
import './PurchaseDetailPage.css';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function PurchaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const notify = useNotify();
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    getPurchase(id)
      .then(setPurchase)
      .catch((error: unknown) => {
        notify.error(
          error instanceof ApiError ? error.message : 'No se pudo cargar la compra.',
        );
      })
      .finally(() => setLoading(false));
  }, [id, notify]);

  if (loading) {
    return <Loading fullPage label="Cargando compra…" />;
  }

  if (!purchase) {
    return (
      <Card>
        <p>No se encontró la compra.</p>
        <Link to="/compras">Volver a compras</Link>
      </Card>
    );
  }

  return (
    <div className="purchase-detail">
      <header className="purchase-detail__header">
        <h1>Compra #{purchase.purchaseNumber}</h1>
        <Link to="/compras" className="purchase-detail__back">
          ← Volver a compras
        </Link>
      </header>

      <Card className="purchase-detail__summary">
        <div>
          <span className="purchase-detail__label">Proveedor</span>
          <strong>{purchase.supplier.name}</strong>
        </div>
        <div>
          <span className="purchase-detail__label">Fecha</span>
          <strong>{formatDate(purchase.purchaseDate)}</strong>
        </div>
        <div>
          <span className="purchase-detail__label">Forma de pago</span>
          <strong>{purchase.paymentMethod.name}</strong>
        </div>
        <div>
          <span className="purchase-detail__label">Estado</span>
          <strong>{purchase.status === 'COMPLETED' ? 'Completada' : purchase.status}</strong>
        </div>
      </Card>

      {purchase.notes ? (
        <Card>
          <span className="purchase-detail__label">Notas</span>
          <p>{purchase.notes}</p>
        </Card>
      ) : null}

      <Card className="purchase-detail__items">
        <h2>Productos</h2>
        {Object.entries(
          purchase.items.reduce<Record<string, typeof purchase.items>>((acc, item) => {
            (acc[item.productName] ??= []).push(item);
            return acc;
          }, {}),
        ).map(([productName, items]) => (
          <div key={productName} className="purchase-detail__group">
            <strong>{productName}</strong>
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.sizeName} / {item.colorName} → {item.quantity} × Q{item.unitCost}
                  </span>
                  <span className="purchase-detail__subtotal">Q{item.subtotal}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      <p className="purchase-detail__total">
        Total: <strong>Q{purchase.totalCost}</strong>
      </p>
    </div>
  );
}
