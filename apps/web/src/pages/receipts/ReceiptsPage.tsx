import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { getSale, listSales } from '../../api/sales';
import { getGeneralSettings } from '../../api/settings';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { renderReceiptJpgDataUrl, shareOrDownloadDataUrl } from '../../lib/receipt';
import { useNotify } from '../../notifications/useNotify';
import type { Sale } from '../../types/sale';
import './ReceiptsPage.css';

const SEARCH_DEBOUNCE_MS = 350;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('es-GT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "Comprobantes": encuentra rápido el recibo de una venta ya registrada y
 * vuelve a generarlo. No duplica el historial de ventas (reutiliza `/sales`
 * tal cual) ni la generación del JPG (reutiliza `lib/receipt.ts` de la
 * Fase 12) — es solo una puerta de entrada pensada para "necesito el
 * comprobante de tal venta", en vez de navegar a Ventas y buscarla ahí. */
export function ReceiptsPage() {
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [sales, setSales] = useState<Sale[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      listSales({ search: search.trim() || undefined, pageSize: 30 })
        .then((res) => {
          if (cancelled) return;
          setSales(res.items);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          notify.error(
            error instanceof ApiError ? error.message : 'No se pudieron cargar las ventas.',
          );
          setSales([]);
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

  async function handleShare(saleListItem: Sale) {
    setDownloadingId(saleListItem.id);
    try {
      const [sale, settings] = await Promise.all([
        getSale(saleListItem.id),
        getGeneralSettings().catch(() => undefined),
      ]);
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
    } catch (error) {
      notify.error(
        error instanceof ApiError ? error.message : 'No se pudo generar el comprobante.',
      );
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="receipts">
      <header className="receipts__header">
        <h1>Comprobantes</h1>
        <p>Encuentra y vuelve a descargar el comprobante de cualquier venta.</p>
      </header>

      <Input
        label="Buscar"
        placeholder="Número de venta"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {loading ? (
        <Loading label="Buscando ventas…" />
      ) : !sales || sales.length === 0 ? (
        <Card>
          <EmptyState
            title={search ? 'Sin resultados' : 'Todavía no hay comprobantes'}
            description={
              search
                ? 'No encontramos ventas que coincidan con tu búsqueda.'
                : 'Cuando registres tu primera venta, su comprobante aparecerá aquí.'
            }
            showHeart={false}
          />
        </Card>
      ) : (
        <ul className="receipts__items">
          {sales.map((sale) => (
            <li key={sale.id} className="receipt-row">
              <Link to={`/ventas/${sale.id}`} className="receipt-row__info">
                <span className="receipt-row__number">Venta #{sale.saleNumber}</span>
                <span className="receipt-row__meta">
                  {formatDateTime(sale.saleDate)} · Q{sale.total}
                </span>
              </Link>
              <Button
                type="button"
                variant="ghost"
                loading={downloadingId === sale.id}
                onClick={() => void handleShare(sale)}
              >
                Compartir
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
