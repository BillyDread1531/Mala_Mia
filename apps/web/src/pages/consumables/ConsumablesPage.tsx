import { useEffect, useState } from 'react';
import {
  adjustConsumable,
  createConsumable,
  listConsumables,
  setConsumableActive,
  updateConsumable,
} from '../../api/consumables';
import { ApiError } from '../../api/client';
import { listPaymentMethods } from '../../api/catalog';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { useNotify } from '../../notifications/useNotify';
import type { PaymentMethod } from '../../types/catalog';
import type { Consumable } from '../../types/consumable';
import './ConsumablesPage.css';

const STATUS_LABEL: Record<Consumable['status'], string> = {
  DISPONIBLE: 'Disponible',
  STOCK_BAJO: 'Stock bajo',
  AGOTADO: 'Agotado',
};

/** Insumos de empaque (bolsas, cintas, etiquetas, etc.): stock simple, sin
 * talla ni color, que se descuenta solo con cada venta (1 unidad por venta
 * salvo que se configure otra cantidad) y nunca bloquea una venta al llegar
 * a cero — solo avisa con la misma alerta de stock bajo que el inventario. */
export function ConsumablesPage() {
  const notify = useNotify();
  const [items, setItems] = useState<Consumable[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState('');
  const [newThreshold, setNewThreshold] = useState('5');
  const [newUnitsPerSale, setNewUnitsPerSale] = useState('1');
  const [newCost, setNewCost] = useState('');
  const [newPaymentMethodId, setNewPaymentMethodId] = useState<number | ''>('');
  const [creating, setCreating] = useState(false);

  const [adjustingId, setAdjustingId] = useState<string | null>(null);
  const [quantityChange, setQuantityChange] = useState('');
  const [adjustCost, setAdjustCost] = useState('');
  const [adjustPaymentMethodId, setAdjustPaymentMethodId] = useState<number | ''>('');
  const [adjusting, setAdjusting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editThreshold, setEditThreshold] = useState('');
  const [editUnitsPerSale, setEditUnitsPerSale] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  function load() {
    setLoading(true);
    listConsumables()
      .then(setItems)
      .catch((error: unknown) => {
        notify.error(error instanceof ApiError ? error.message : 'No se pudieron cargar los insumos.');
        setItems([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    listPaymentMethods('expenses')
      .then(setPaymentMethods)
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notify]);

  async function handleCreate() {
    if (!newName.trim()) {
      notify.error('Ingresa un nombre.');
      return;
    }
    if (newCost.trim() && !newPaymentMethodId) {
      notify.error('Selecciona una forma de pago para registrar el costo.');
      return;
    }
    setCreating(true);
    try {
      await createConsumable({
        name: newName.trim(),
        quantity: newQuantity ? Number(newQuantity) : undefined,
        lowStockThreshold: newThreshold ? Number(newThreshold) : undefined,
        unitsPerSale: newUnitsPerSale ? Number(newUnitsPerSale) : undefined,
        cost: newCost.trim() ? Number(newCost) : undefined,
        paymentMethodId: newPaymentMethodId ? Number(newPaymentMethodId) : undefined,
      });
      notify.success('Insumo agregado.');
      setShowNew(false);
      setNewName('');
      setNewQuantity('');
      setNewThreshold('5');
      setNewUnitsPerSale('1');
      setNewCost('');
      setNewPaymentMethodId('');
      load();
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo crear el insumo.');
    } finally {
      setCreating(false);
    }
  }

  function startAdjusting(item: Consumable) {
    setAdjustingId(item.id);
    setQuantityChange('');
    setAdjustCost('');
    setAdjustPaymentMethodId('');
  }

  async function submitAdjustment(item: Consumable) {
    const delta = Number(quantityChange);
    if (!delta || Number.isNaN(delta)) {
      notify.error('Ingresa una cantidad distinta de cero.');
      return;
    }
    if (adjustCost.trim() && !adjustPaymentMethodId) {
      notify.error('Selecciona una forma de pago para registrar el costo.');
      return;
    }
    setAdjusting(true);
    try {
      await adjustConsumable(item.id, {
        quantityChange: delta,
        cost: adjustCost.trim() ? Number(adjustCost) : undefined,
        paymentMethodId: adjustPaymentMethodId ? Number(adjustPaymentMethodId) : undefined,
      });
      notify.success('Stock actualizado.');
      setAdjustingId(null);
      load();
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo ajustar el stock.');
    } finally {
      setAdjusting(false);
    }
  }

  function startEditing(item: Consumable) {
    setEditingId(item.id);
    setEditThreshold(String(item.lowStockThreshold));
    setEditUnitsPerSale(String(item.unitsPerSale));
  }

  async function submitEdit(item: Consumable) {
    setSavingEdit(true);
    try {
      await updateConsumable(item.id, {
        lowStockThreshold: Number(editThreshold),
        unitsPerSale: Number(editUnitsPerSale),
      });
      notify.success('Insumo actualizado.');
      setEditingId(null);
      load();
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo actualizar el insumo.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleActive(item: Consumable) {
    try {
      await setConsumableActive(item.id, !item.isActive);
      notify.success(item.isActive ? 'Insumo desactivado.' : 'Insumo reactivado.');
      load();
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo cambiar el estado.');
    }
  }

  return (
    <div className="consumables-page">
      <header className="consumables-page__header">
        <div>
          <h1>Insumos</h1>
          <p>Bolsas, cintas, etiquetas y otro material de empaque — se descuentan solos con cada venta.</p>
        </div>
        <Button type="button" onClick={() => setShowNew((prev) => !prev)}>
          {showNew ? 'Cancelar' : 'Nuevo insumo'}
        </Button>
      </header>

      {showNew ? (
        <Card className="consumables-page__new">
          <Input
            label="Nombre"
            placeholder="Ej. Bolsas de papel"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            autoFocus
          />
          <div className="consumables-page__new-row">
            <Input
              label="Stock inicial"
              type="number"
              min="0"
              value={newQuantity}
              onChange={(event) => setNewQuantity(event.target.value)}
            />
            <Input
              label="Alerta de stock bajo"
              type="number"
              min="0"
              value={newThreshold}
              onChange={(event) => setNewThreshold(event.target.value)}
            />
            <Input
              label="Unidades por venta"
              type="number"
              min="1"
              value={newUnitsPerSale}
              onChange={(event) => setNewUnitsPerSale(event.target.value)}
            />
          </div>
          {Number(newQuantity) > 0 ? (
            <div className="consumables-page__new-row">
              <Input
                label="Costo total (opcional)"
                type="number"
                min="0"
                step="0.01"
                placeholder="¿Cuánto te costó?"
                value={newCost}
                onChange={(event) => setNewCost(event.target.value)}
              />
              <div className="field">
                <label className="field__label" htmlFor="new-consumable-payment-method">
                  Forma de pago
                </label>
                <select
                  id="new-consumable-payment-method"
                  className="field__input"
                  value={newPaymentMethodId}
                  onChange={(event) =>
                    setNewPaymentMethodId(event.target.value ? Number(event.target.value) : '')
                  }
                >
                  <option value="">Selecciona una forma de pago</option>
                  {paymentMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ) : null}
          <div className="consumables-page__new-actions">
            <Button type="button" loading={creating} onClick={() => void handleCreate()}>
              Guardar
            </Button>
          </div>
        </Card>
      ) : null}

      {loading ? (
        <Loading label="Cargando insumos…" />
      ) : (items ?? []).length === 0 ? (
        <Card>
          <EmptyState
            title="Todavía no hay insumos"
            description="Agrega bolsas u otro material de empaque para llevar su stock y recibir alertas cuando se agote."
          />
        </Card>
      ) : (
        <ul className="consumables-page__items">
          {(items ?? []).map((item) => (
            <li key={item.id}>
              <Card className="consumable-row">
                <div className="consumable-row__main">
                  <div className="consumable-row__name-line">
                    <span
                      className={`consumable-dot consumable-dot--${item.status.toLowerCase()}`}
                      aria-hidden="true"
                    />
                    <span className="consumable-row__name">{item.name}</span>
                    {!item.isActive ? <span className="consumable-row__badge">Inactivo</span> : null}
                  </div>
                  <span className="consumable-row__meta">
                    {item.quantity} u. · {STATUS_LABEL[item.status]} · alerta ≤ {item.lowStockThreshold} ·{' '}
                    {item.unitsPerSale} por venta
                  </span>
                </div>
                <div className="consumable-row__actions">
                  <Button type="button" variant="ghost" onClick={() => startAdjusting(item)}>
                    Ajustar stock
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => startEditing(item)}>
                    Editar
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void handleToggleActive(item)}>
                    {item.isActive ? 'Desactivar' : 'Reactivar'}
                  </Button>
                </div>

                {adjustingId === item.id ? (
                  <div className="consumable-inline-form">
                    <Input
                      label="Ajuste (ej. -5 o 50)"
                      type="number"
                      step="1"
                      value={quantityChange}
                      onChange={(event) => setQuantityChange(event.target.value)}
                      autoFocus
                    />
                    {Number(quantityChange) > 0 ? (
                      <div className="consumables-page__new-row">
                        <Input
                          label="Costo total (opcional)"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="¿Cuánto te costó?"
                          value={adjustCost}
                          onChange={(event) => setAdjustCost(event.target.value)}
                        />
                        <div className="field">
                          <label className="field__label" htmlFor={`adjust-payment-method-${item.id}`}>
                            Forma de pago
                          </label>
                          <select
                            id={`adjust-payment-method-${item.id}`}
                            className="field__input"
                            value={adjustPaymentMethodId}
                            onChange={(event) =>
                              setAdjustPaymentMethodId(
                                event.target.value ? Number(event.target.value) : '',
                              )
                            }
                          >
                            <option value="">Selecciona una forma de pago</option>
                            {paymentMethods.map((method) => (
                              <option key={method.id} value={method.id}>
                                {method.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ) : null}
                    <div className="consumable-inline-form__actions">
                      <Button type="button" variant="ghost" onClick={() => setAdjustingId(null)}>
                        Cancelar
                      </Button>
                      <Button type="button" loading={adjusting} onClick={() => void submitAdjustment(item)}>
                        Confirmar
                      </Button>
                    </div>
                  </div>
                ) : null}

                {editingId === item.id ? (
                  <div className="consumable-inline-form">
                    <div className="consumables-page__new-row">
                      <Input
                        label="Alerta de stock bajo"
                        type="number"
                        min="0"
                        value={editThreshold}
                        onChange={(event) => setEditThreshold(event.target.value)}
                      />
                      <Input
                        label="Unidades por venta"
                        type="number"
                        min="1"
                        value={editUnitsPerSale}
                        onChange={(event) => setEditUnitsPerSale(event.target.value)}
                      />
                    </div>
                    <div className="consumable-inline-form__actions">
                      <Button type="button" variant="ghost" onClick={() => setEditingId(null)}>
                        Cancelar
                      </Button>
                      <Button type="button" loading={savingEdit} onClick={() => void submitEdit(item)}>
                        Guardar
                      </Button>
                    </div>
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
