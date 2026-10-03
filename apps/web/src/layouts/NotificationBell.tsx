import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getInventoryReport } from '../api/reports';
import { BellIcon } from '../components/icons';
import type { ConsumableLowStockItem, InventoryReportLowStockItem } from '../types/reports';
import './NotificationBell.css';

const ALERT_PREVIEW_LIMIT = 8;
const DISMISSED_STORAGE_KEY = 'mala-mia-dismissed-alerts';

interface AlertItem {
  key: string;
  label: string;
  quantity: number;
  status: 'STOCK_BAJO' | 'AGOTADO';
  href: string;
}

function fromProduct(item: InventoryReportLowStockItem): AlertItem {
  return {
    key: `p-${item.productId}-${item.sizeName}-${item.colorName}`,
    label: `${item.productName} — ${item.sizeName}/${item.colorName}`,
    quantity: item.quantity,
    status: item.status,
    href: `/disponibilidad/${item.productId}`,
  };
}

function fromConsumable(item: ConsumableLowStockItem): AlertItem {
  return {
    key: `c-${item.id}`,
    label: `Insumo: ${item.name}`,
    quantity: item.quantity,
    status: item.status,
    href: '/insumos',
  };
}

/** "Leído" = se guarda la cantidad que tenía la alerta cuando se marcó. Si
 * esa combinación cambia de cantidad después (se repuso y volvió a bajar,
 * bajó aún más, etc.), vuelve a aparecer — no es un "nunca más" permanente,
 * solo descarta el estado ya visto. */
function loadDismissed(): Record<string, number> {
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function saveDismissed(map: Record<string, number>): void {
  try {
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Si no se puede persistir, simplemente no se recuerda entre sesiones.
  }
}

/** La campana usa las mismas alertas de stock bajo/agotado que ya calcula
 * Reportes/Disponibilidad (`GET /reports/inventory`) — no hay una tabla de
 * notificaciones nueva, así se evita una segunda fuente de verdad sobre qué
 * cuenta como "alerta". También incluye insumos (bolsas/empaque) con poco
 * stock, del mismo endpoint. Se refresca cada vez que se abre, sin polling. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [allItems, setAllItems] = useState<AlertItem[] | null>(null);
  const [dismissed, setDismissed] = useState<Record<string, number>>(() => loadDismissed());
  const [loading, setLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  function applyReport(report: {
    lowStockItems: InventoryReportLowStockItem[];
    lowStockConsumables: ConsumableLowStockItem[];
  }) {
    setAllItems([
      ...report.lowStockItems.map(fromProduct),
      ...report.lowStockConsumables.map(fromConsumable),
    ]);
  }

  useEffect(() => {
    getInventoryReport()
      .then(applyReport)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      getInventoryReport()
        .then(applyReport)
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }
  }

  const items = (allItems ?? []).filter((item) => dismissed[item.key] !== item.quantity);
  const count = items.length;

  function handleMarkAllRead() {
    const next = { ...dismissed };
    for (const item of items) {
      next[item.key] = item.quantity;
    }
    setDismissed(next);
    saveDismissed(next);
  }

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        type="button"
        className="user-menu__bell"
        aria-label="Notificaciones"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={handleToggle}
      >
        <BellIcon />
        {count > 0 ? <span className="notification-bell__badge">{count}</span> : null}
      </button>

      {open ? (
        <div className="notification-bell__panel" role="menu">
          <div className="notification-bell__header">
            <h2>Alertas de stock</h2>
            {count > 0 ? (
              <button type="button" className="notification-bell__mark-read" onClick={handleMarkAllRead}>
                Marcar todas como leídas
              </button>
            ) : null}
          </div>
          {loading ? (
            <p className="notification-bell__empty">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="notification-bell__empty">No tienes alertas por ahora.</p>
          ) : (
            <ul>
              {items.slice(0, ALERT_PREVIEW_LIMIT).map((item) => (
                <li key={item.key}>
                  <Link
                    to={item.href}
                    className="notification-bell__item"
                    onClick={() => setOpen(false)}
                  >
                    <span>{item.label}</span>
                    <span
                      className={`notification-bell__status notification-bell__status--${item.status.toLowerCase()}`}
                    >
                      {item.status === 'AGOTADO' ? 'Agotado' : `${item.quantity} u.`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {items.length > ALERT_PREVIEW_LIMIT ? (
            <Link
              to="/finanzas/reportes"
              className="notification-bell__more"
              onClick={() => setOpen(false)}
            >
              Ver las {items.length} alertas en Reportes →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
