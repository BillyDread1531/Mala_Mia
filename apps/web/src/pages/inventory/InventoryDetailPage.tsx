import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { adjustInventory, getInventoryItem } from '../../api/inventory';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Loading } from '../../components/Loading';
import { useNotify } from '../../notifications/useNotify';
import { ADJUSTMENT_REASONS } from '../../types/inventory';
import type { InventoryItem, InventoryMovement } from '../../types/inventory';
import './InventoryDetailPage.css';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short', year: 'numeric' });
}

const MOVEMENT_LABEL: Record<string, string> = {
  ENTRADA: 'Entrada',
  SALIDA: 'Salida',
  AJUSTE: 'Ajuste',
};

export function InventoryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const notify = useNotify();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);

  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    if (!id) return;
    getInventoryItem(id)
      .then((res) => {
        setItem(res.item);
        setMovements(res.movements);
      })
      .catch((error: unknown) =>
        notify.error(error instanceof ApiError ? error.message : 'No se pudo cargar el inventario.'),
      )
      .finally(() => setLoading(false));
  }

  useEffect(load, [id, notify]);

  async function handleAdjustSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const change = Number(adjustAmount);
    if (!change) {
      notify.error('Ingresa una cantidad distinta de cero.');
      return;
    }
    if (!reason) {
      notify.error('Selecciona un motivo.');
      return;
    }
    if (reason === 'Otro' && !notes.trim()) {
      notify.error('Explica el motivo cuando selecciones "Otro".');
      return;
    }

    setSaving(true);
    try {
      await adjustInventory(id, { quantityChange: change, reason, notes: notes.trim() || undefined });
      notify.success('Inventario ajustado.');
      setShowAdjust(false);
      setAdjustAmount('');
      setReason('');
      setNotes('');
      setLoading(true);
      load();
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo ajustar el inventario.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <Loading fullPage label="Cargando inventario…" />;
  if (!item) {
    return (
      <Card>
        <p>No se encontró el inventario.</p>
        <Link to="/inventario/stock">Volver</Link>
      </Card>
    );
  }

  const newStock = item.quantity + (Number(adjustAmount) || 0);

  return (
    <div className="inventory-detail">
      <header className="inventory-detail__header">
        <h1>
          {item.product.name} — {item.sizeName} / {item.colorName}
        </h1>
        <Link to="/inventario/stock" className="inventory-detail__back">
          ← Volver a inventario
        </Link>
      </header>

      <Card className="inventory-detail__summary">
        <div>
          <span className="inventory-detail__label">Código</span>
          <strong>{item.product.code}</strong>
        </div>
        <div>
          <span className="inventory-detail__label">Stock actual</span>
          <strong>{item.quantity} unidades</strong>
        </div>
        <div>
          <span className="inventory-detail__label">Costo promedio</span>
          <strong>Q{item.averageCost}</strong>
        </div>
      </Card>

      {!showAdjust ? (
        <Button type="button" variant="secondary" onClick={() => setShowAdjust(true)}>
          Ajustar inventario
        </Button>
      ) : (
        <Card className="inventory-detail__adjust-form">
          <h2>Ajustar inventario</h2>
          <form onSubmit={handleAdjustSubmit} noValidate>
            <div className="field">
              <label className="field__label" htmlFor="adjust-amount">
                Ajuste (ej. -2 o 3)
              </label>
              <input
                id="adjust-amount"
                className="field__input"
                type="number"
                value={adjustAmount}
                onChange={(event) => setAdjustAmount(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="adjust-reason">
                Motivo
              </label>
              <select
                id="adjust-reason"
                className="field__input"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                <option value="">Selecciona un motivo</option>
                {ADJUSTMENT_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="field__label" htmlFor="adjust-notes">
                Notas {reason === 'Otro' ? '(obligatorio)' : '(opcional)'}
              </label>
              <textarea
                id="adjust-notes"
                className="field__input"
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            {adjustAmount ? (
              <p className="inventory-detail__preview">
                Stock actual: {item.quantity} → Nuevo stock: <strong>{newStock}</strong>
              </p>
            ) : null}

            <div className="inventory-detail__adjust-actions">
              <Button type="button" variant="ghost" onClick={() => setShowAdjust(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={saving}>
                Confirmar ajuste
              </Button>
            </div>
          </form>
        </Card>
      )}

      <Card>
        <h2 className="inventory-detail__section-title">Historial de movimientos</h2>
        {movements.length === 0 ? (
          <p className="inventory-detail__hint">Todavía no hay movimientos.</p>
        ) : (
          <ul className="inventory-detail__movements">
            {movements.map((m) => (
              <li key={m.id}>
                <span className="inventory-detail__movement-type">{MOVEMENT_LABEL[m.movementType] ?? m.movementType}</span>
                <span className="inventory-detail__movement-qty">
                  {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                </span>
                <span className="inventory-detail__movement-ref">
                  {m.referenceType === 'purchase' && m.referenceId
                    ? `Compra #${m.referenceId}`
                    : m.reason ?? '—'}
                </span>
                <span className="inventory-detail__movement-date">{formatDate(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
