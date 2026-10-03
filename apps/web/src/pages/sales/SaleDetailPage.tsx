import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getSale, getSaleHistory } from '../../api/sales';
import { getGeneralSettings } from '../../api/settings';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Loading } from '../../components/Loading';
import { formatMoney } from '../../lib/money';
import { renderReceiptJpgDataUrl, shareOrDownloadDataUrl } from '../../lib/receipt';
import { useNotify } from '../../notifications/useNotify';
import type { Sale, SaleHistoryEntry, SaleStatus } from '../../types/sale';
import { SaleManagePanel } from './SaleManagePanel';
import './SaleDetailPage.css';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const STATUS_LABELS: Record<SaleStatus, string> = {
  COMPLETED: 'Completada',
  PARTIALLY_RETURNED: 'Parcialmente devuelta',
  RETURNED: 'Devuelta',
  CANCELLED: 'Cancelada',
};

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const notify = useNotify();
  const [sale, setSale] = useState<Sale | null>(null);
  const [history, setHistory] = useState<SaleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  function loadHistory(saleId: string) {
    getSaleHistory(saleId)
      .then(setHistory)
      .catch(() => undefined);
  }

  useEffect(() => {
    if (!id) return;
    getSale(id)
      .then((result) => {
        setSale(result);
        loadHistory(id);
      })
      .catch((error: unknown) => {
        notify.error(error instanceof ApiError ? error.message : 'No se pudo cargar la venta.');
      })
      .finally(() => setLoading(false));
  }, [id, notify]);

  function handleUpdated(updated: Sale) {
    setSale(updated);
    loadHistory(updated.id);
  }

  async function handleShareReceipt() {
    if (!sale) return;
    setDownloading(true);
    try {
      const settings = await getGeneralSettings().catch(() => undefined);
      const dataUrl = await renderReceiptJpgDataUrl(
        sale,
        settings
          ? { businessName: settings.businessName, receiptMessage: settings.receiptMessage }
          : undefined,
      );
      await shareOrDownloadDataUrl(
        dataUrl,
        `venta-${sale.saleNumber}.jpg`,
        `Venta #${sale.saleNumber}`,
      );
    } catch {
      notify.error('No se pudo generar el comprobante.');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <Loading fullPage label="Cargando venta…" />;
  }

  if (!sale) {
    return (
      <Card>
        <p>No se encontró la venta.</p>
        <Link to="/ventas">Volver a ventas</Link>
      </Card>
    );
  }

  return (
    <div className="sale-detail">
      <header className="sale-detail__header">
        <h1>Venta #{sale.saleNumber}</h1>
        <Link to="/ventas" className="sale-detail__back">
          ← Volver a ventas
        </Link>
      </header>

      <Card className="sale-detail__summary">
        <div>
          <span className="sale-detail__label">Fecha</span>
          <strong>{formatDate(sale.saleDate)}</strong>
        </div>
        <div>
          <span className="sale-detail__label">Forma de pago</span>
          <strong>{sale.paymentMethod.name}</strong>
        </div>
        <div>
          <span className="sale-detail__label">Estado</span>
          <strong className={`sale-detail__status sale-detail__status--${sale.status.toLowerCase()}`}>
            {STATUS_LABELS[sale.status]}
          </strong>
        </div>
      </Card>

      <SaleManagePanel sale={sale} onUpdated={handleUpdated} />

      {sale.notes ? (
        <Card>
          <span className="sale-detail__label">Notas</span>
          <p>{sale.notes}</p>
        </Card>
      ) : null}

      <Card className="sale-detail__items">
        <h2>Productos</h2>
        {Object.entries(
          sale.items.reduce<Record<string, typeof sale.items>>((acc, item) => {
            (acc[item.productName] ??= []).push(item);
            return acc;
          }, {}),
        ).map(([productName, items]) => (
          <div key={productName} className="sale-detail__group">
            <strong>{productName}</strong>
            <ul>
              {items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.sizeName} / {item.colorName} → {item.quantity} × Q{item.unitSalePrice}
                    {Number(item.discountAmount) > 0 ? (
                      <span className="sale-detail__discount-badge">Con descuento</span>
                    ) : null}
                  </span>
                  <span className="sale-detail__subtotal">Q{item.subtotal}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </Card>

      {Number(sale.totalRefunded) > 0 ? (
        <Card className="sale-detail__total-breakdown">
          <div className="sale-detail__total-row">
            <span>Total de la venta</span>
            <span>{formatMoney(sale.total)}</span>
          </div>
          <div className="sale-detail__total-row sale-detail__total-row--refund">
            <span>Devuelto</span>
            <span>− {formatMoney(sale.totalRefunded)}</span>
          </div>
          <div className="sale-detail__total-row sale-detail__total-row--net">
            <span>Queda</span>
            <strong>{formatMoney(sale.netTotal)}</strong>
          </div>
        </Card>
      ) : (
        <p className="sale-detail__total">
          Total: <strong>{formatMoney(sale.total)}</strong>
        </p>
      )}

      {history.length > 0 ? (
        <Card className="sale-detail__history">
          <h2>Historial de operaciones</h2>
          <ul>
            {history.map((entry, index) => (
              <li key={index}>
                <span className="sale-detail__history-date">{formatDateTime(entry.date)}</span>
                <span>{entry.description}</span>
                {entry.by ? <span className="sale-detail__history-by">{entry.by}</span> : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="sale-detail__actions">
        <Button type="button" loading={downloading} onClick={() => void handleShareReceipt()}>
          Compartir comprobante
        </Button>
      </div>
    </div>
  );
}
