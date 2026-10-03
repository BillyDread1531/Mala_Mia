import { useEffect, useState } from 'react';
import { listPaymentMethods } from '../../api/catalog';
import { ApiError } from '../../api/client';
import { listInventory } from '../../api/inventory';
import { getProduct, listProducts } from '../../api/products';
import { cancelSale, createCorrection, createExchange, createReturn } from '../../api/sales';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { useNotify } from '../../notifications/useNotify';
import type { PaymentMethod } from '../../types/catalog';
import type { InventoryItem } from '../../types/inventory';
import type { Product } from '../../types/product';
import {
  CORRECTION_REASONS,
  RETURN_CONDITIONS,
  RETURN_REASONS,
  type Sale,
  type SaleStatus,
} from '../../types/sale';
import './SaleManagePanel.css';

type Action = 'none' | 'cancel' | 'return' | 'exchange' | 'correct';

const ACTION_LABELS: Record<Exclude<Action, 'none'>, string> = {
  correct: 'Corregir',
  return: 'Devolver',
  exchange: 'Cambiar',
  cancel: 'Cancelar',
};

function availableActions(status: SaleStatus): Exclude<Action, 'none'>[] {
  if (status === 'COMPLETED') return ['correct', 'return', 'exchange', 'cancel'];
  if (status === 'PARTIALLY_RETURNED') return ['return', 'exchange'];
  return [];
}

interface FormProps {
  sale: Sale;
  onDone: (sale: Sale) => void;
  onClose: () => void;
}

function CancelForm({ sale, onDone, onClose }: FormProps) {
  const notify = useNotify();
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try {
      const updated = await cancelSale(sale.id);
      notify.success('Venta cancelada correctamente.');
      onDone(updated);
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo cancelar la venta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sale-manage__form">
      <p className="sale-manage__confirm-text">
        ¿Cancelar esta venta? El inventario vendido será reintegrado y la venta quedará
        registrada como cancelada.
      </p>
      <div className="sale-manage__form-actions">
        <Button type="button" variant="ghost" onClick={onClose}>
          Volver
        </Button>
        <Button type="button" loading={loading} onClick={() => void handleConfirm()}>
          Cancelar venta
        </Button>
      </div>
    </div>
  );
}

function ReturnForm({ sale, onDone, onClose }: FormProps) {
  const notify = useNotify();
  const [reason, setReason] = useState<(typeof RETURN_REASONS)[number]>(RETURN_REASONS[0]);
  const [notes, setNotes] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [refundPaymentMethodId, setRefundPaymentMethodId] = useState<number | ''>('');
  const [lines, setLines] = useState<
    Record<string, { quantity: string; condition: 'SALEABLE' | 'DAMAGED' }>
  >({});
  const [saving, setSaving] = useState(false);

  const returnable = sale.items.filter((item) => item.returnableQuantity > 0);

  useEffect(() => {
    listPaymentMethods('sales')
      .then(setPaymentMethods)
      .catch(() => undefined);
  }, []);

  async function handleSubmit() {
    const items = returnable.flatMap((item) => {
      const line = lines[item.id];
      const quantity = Number(line?.quantity);
      if (!line || !quantity || quantity <= 0 || quantity > item.returnableQuantity) return [];
      return [{ saleItemId: Number(item.id), quantity, conditionStatus: line.condition }];
    });

    if (items.length === 0) {
      notify.error('Indica la cantidad a devolver de al menos un producto.');
      return;
    }

    setSaving(true);
    try {
      const updated = await createReturn(sale.id, {
        reason,
        refundPaymentMethodId: refundPaymentMethodId ? Number(refundPaymentMethodId) : undefined,
        notes: notes.trim() || undefined,
        items,
      });
      notify.success('Devolución registrada correctamente.');
      onDone(updated);
    } catch (error) {
      notify.error(
        error instanceof ApiError ? error.message : 'No se pudo registrar la devolución.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sale-manage__form">
      {returnable.map((item) => {
        const line = lines[item.id] ?? { quantity: '', condition: 'SALEABLE' as const };
        return (
          <div key={item.id} className="sale-manage__line">
            <span>
              {item.productName} — {item.sizeName}/{item.colorName} (máx. {item.returnableQuantity}
              )
            </span>
            <input
              type="number"
              min="0"
              max={item.returnableQuantity}
              value={line.quantity}
              aria-label={`Cantidad a devolver de ${item.productName} ${item.sizeName}/${item.colorName}`}
              onChange={(event) =>
                setLines((prev) => ({ ...prev, [item.id]: { ...line, quantity: event.target.value } }))
              }
            />
            <select
              value={line.condition}
              aria-label={`Estado de ${item.productName} ${item.sizeName}/${item.colorName}`}
              onChange={(event) =>
                setLines((prev) => ({
                  ...prev,
                  [item.id]: { ...line, condition: event.target.value as 'SALEABLE' | 'DAMAGED' },
                }))
              }
            >
              {RETURN_CONDITIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        );
      })}

      <div className="field">
        <label className="field__label" htmlFor="return-reason">
          Motivo
        </label>
        <select
          id="return-reason"
          className="field__input"
          value={reason}
          onChange={(event) => setReason(event.target.value as (typeof RETURN_REASONS)[number])}
        >
          {RETURN_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="return-refund-method">
          Reembolsar vía (opcional)
        </label>
        <select
          id="return-refund-method"
          className="field__input"
          value={refundPaymentMethodId}
          onChange={(event) =>
            setRefundPaymentMethodId(event.target.value ? Number(event.target.value) : '')
          }
        >
          <option value="">Sin especificar</option>
          {paymentMethods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="return-notes">
          Notas (opcional)
        </label>
        <textarea
          id="return-notes"
          className="field__input"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="sale-manage__form-actions">
        <Button type="button" variant="ghost" onClick={onClose}>
          Volver
        </Button>
        <Button type="button" loading={saving} onClick={() => void handleSubmit()}>
          Registrar devolución
        </Button>
      </div>
    </div>
  );
}

function ExchangeForm({ sale, onDone, onClose }: FormProps) {
  const notify = useNotify();
  const [originalSaleItemId, setOriginalSaleItemId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [productSearch, setProductSearch] = useState('');
  const [fetchedSearchResults, setFetchedSearchResults] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<InventoryItem[]>([]);
  const [newInventoryItemId, setNewInventoryItemId] = useState('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const returnable = sale.items.filter((item) => item.returnableQuantity > 0);
  const originalLine = returnable.find((item) => item.id === originalSaleItemId) ?? null;
  const selectedVariant = variants.find((v) => v.id === newInventoryItemId) ?? null;

  useEffect(() => {
    listPaymentMethods('sales')
      .then(setPaymentMethods)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (productSearch.trim().length < 2) return;
    const timer = setTimeout(() => {
      listProducts({ search: productSearch.trim() })
        .then((res) => setFetchedSearchResults(res.items))
        .catch(() => undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const searchResults = productSearch.trim().length < 2 ? [] : fetchedSearchResults;

  function selectProduct(product: Product) {
    setSelectedProduct(product);
    setProductSearch('');
    setFetchedSearchResults([]);
    setNewInventoryItemId('');
    listInventory({ productId: Number(product.id), available: 'true' })
      .then((res) => setVariants(res.items))
      .catch(() => notify.error('No se pudieron cargar las existencias.'));
  }

  const qty = Number(quantity) || 0;
  const newPrice = selectedProduct?.salePrice
    ? Number(selectedProduct.salePrice)
    : originalLine
      ? Number(originalLine.unitSalePrice)
      : 0;
  const originalPrice = originalLine ? Number(originalLine.unitSalePrice) : 0;
  const difference = (newPrice - originalPrice) * qty;
  const showDifference = Boolean(originalLine && selectedVariant && qty > 0);

  async function handleSubmit() {
    if (!originalLine) {
      notify.error('Selecciona el producto a cambiar.');
      return;
    }
    if (!selectedVariant) {
      notify.error('Selecciona la nueva combinación.');
      return;
    }
    if (qty <= 0 || qty > originalLine.returnableQuantity) {
      notify.error('La cantidad indicada no es válida.');
      return;
    }
    if (difference > 0 && !paymentMethodId) {
      notify.error('Selecciona cómo pagará el cliente la diferencia.');
      return;
    }

    setSaving(true);
    try {
      const updated = await createExchange(sale.id, {
        paymentMethodId: paymentMethodId ? Number(paymentMethodId) : undefined,
        items: [
          {
            originalSaleItemId: Number(originalLine.id),
            quantity: qty,
            newInventoryItemId: Number(selectedVariant.id),
          },
        ],
      });
      notify.success('Cambio registrado correctamente.');
      onDone(updated);
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo registrar el cambio.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sale-manage__form">
      <div className="field">
        <label className="field__label" htmlFor="exchange-line">
          Producto a cambiar
        </label>
        <select
          id="exchange-line"
          className="field__input"
          value={originalSaleItemId}
          onChange={(event) => {
            setOriginalSaleItemId(event.target.value);
            setQuantity('1');
          }}
        >
          <option value="">Selecciona una línea</option>
          {returnable.map((item) => (
            <option key={item.id} value={item.id}>
              {item.productName} — {item.sizeName}/{item.colorName} (máx. {item.returnableQuantity})
            </option>
          ))}
        </select>
      </div>

      {originalLine ? (
        <Input
          label="Cantidad a cambiar"
          type="number"
          min="1"
          max={originalLine.returnableQuantity}
          value={quantity}
          onChange={(event) => setQuantity(event.target.value)}
        />
      ) : null}

      {!selectedProduct ? (
        <Input
          label="Buscar producto nuevo"
          placeholder="Nombre o código"
          value={productSearch}
          onChange={(event) => setProductSearch(event.target.value)}
        />
      ) : null}

      {searchResults.length > 0 && !selectedProduct ? (
        <ul className="sale-manage__results">
          {searchResults.map((product) => (
            <li key={product.id}>
              <button type="button" onClick={() => selectProduct(product)}>
                <strong>{product.name}</strong> — {product.code}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selectedProduct ? (
        <div className="field">
          <label className="field__label" htmlFor="exchange-variant">
            Nueva combinación — {selectedProduct.name}
          </label>
          <select
            id="exchange-variant"
            className="field__input"
            value={newInventoryItemId}
            onChange={(event) => setNewInventoryItemId(event.target.value)}
          >
            <option value="">Selecciona una combinación</option>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.sizeName}/{v.colorName} ({v.quantity} disp.)
              </option>
            ))}
          </select>
          <button
            type="button"
            className="sale-manage__link-button"
            onClick={() => {
              setSelectedProduct(null);
              setVariants([]);
              setNewInventoryItemId('');
            }}
          >
            Buscar otro producto
          </button>
        </div>
      ) : null}

      {showDifference ? (
        <p className="sale-manage__difference">
          {difference > 0
            ? `Diferencia a pagar: Q${difference.toFixed(2)}`
            : difference < 0
              ? `Diferencia a favor del cliente: Q${Math.abs(difference).toFixed(2)}`
              : 'Sin diferencia'}
        </p>
      ) : null}

      {difference > 0 ? (
        <div className="field">
          <label className="field__label" htmlFor="exchange-payment">
            Forma de pago de la diferencia
          </label>
          <select
            id="exchange-payment"
            className="field__input"
            value={paymentMethodId}
            onChange={(event) =>
              setPaymentMethodId(event.target.value ? Number(event.target.value) : '')
            }
          >
            <option value="">Selecciona una forma de pago</option>
            {paymentMethods.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="sale-manage__form-actions">
        <Button type="button" variant="ghost" onClick={onClose}>
          Volver
        </Button>
        <Button type="button" loading={saving} onClick={() => void handleSubmit()}>
          Confirmar cambio
        </Button>
      </div>
    </div>
  );
}

function CorrectForm({ sale, onDone, onClose }: FormProps) {
  const notify = useNotify();
  const [saleItemId, setSaleItemId] = useState('');
  const [product, setProduct] = useState<Product | null>(null);
  const [sizeId, setSizeId] = useState('');
  const [colorId, setColorId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [reason, setReason] = useState<(typeof CORRECTION_REASONS)[number]>(
    CORRECTION_REASONS[0],
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const line = sale.items.find((item) => item.id === saleItemId) ?? null;

  function selectLine(id: string) {
    setSaleItemId(id);
    const item = sale.items.find((i) => i.id === id);
    if (!item) return;
    setSizeId(item.sizeId);
    setColorId(item.colorId);
    setQuantity(String(item.quantity));
    setUnitPrice(item.unitSalePrice);
    setProduct(null);
    getProduct(item.productId)
      .then(setProduct)
      .catch(() => notify.error('No se pudieron cargar las combinaciones del producto.'));
  }

  async function handleSubmit() {
    if (!line) {
      notify.error('Selecciona la línea a corregir.');
      return;
    }
    setSaving(true);
    try {
      const updated = await createCorrection(sale.id, {
        saleItemId: Number(line.id),
        newSizeId: sizeId !== line.sizeId ? Number(sizeId) : undefined,
        newColorId: colorId !== line.colorId ? Number(colorId) : undefined,
        newQuantity: Number(quantity) !== line.quantity ? Number(quantity) : undefined,
        newUnitPrice:
          Number(unitPrice) !== Number(line.unitSalePrice) ? Number(unitPrice) : undefined,
        reason,
        notes: notes.trim() || undefined,
      });
      notify.success('Corrección registrada correctamente.');
      onDone(updated);
    } catch (error) {
      notify.error(
        error instanceof ApiError ? error.message : 'No se pudo registrar la corrección.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sale-manage__form">
      <div className="field">
        <label className="field__label" htmlFor="correction-line">
          Línea a corregir
        </label>
        <select
          id="correction-line"
          className="field__input"
          value={saleItemId}
          onChange={(event) => selectLine(event.target.value)}
        >
          <option value="">Selecciona una línea</option>
          {sale.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.productName} — {item.sizeName}/{item.colorName} × {item.quantity}
            </option>
          ))}
        </select>
      </div>

      {line && product ? (
        <div className="field">
          <label className="field__label" htmlFor="correction-variant">
            Talla / color
          </label>
          <select
            id="correction-variant"
            className="field__input"
            value={`${sizeId}-${colorId}`}
            onChange={(event) => {
              const [s, c] = event.target.value.split('-');
              setSizeId(s);
              setColorId(c);
            }}
          >
            {product.variants.map((v) => (
              <option key={`${v.sizeId}-${v.colorId}`} value={`${v.sizeId}-${v.colorId}`}>
                {v.sizeName}/{v.colorName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {line ? (
        <>
          <Input
            label="Cantidad"
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
          />
          <Input
            label="Precio de venta (Q)"
            type="number"
            min="0"
            step="0.01"
            value={unitPrice}
            onChange={(event) => setUnitPrice(event.target.value)}
          />
        </>
      ) : null}

      <div className="field">
        <label className="field__label" htmlFor="correction-reason">
          Motivo
        </label>
        <select
          id="correction-reason"
          className="field__input"
          value={reason}
          onChange={(event) =>
            setReason(event.target.value as (typeof CORRECTION_REASONS)[number])
          }
        >
          {CORRECTION_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field__label" htmlFor="correction-notes">
          Notas (opcional)
        </label>
        <textarea
          id="correction-notes"
          className="field__input"
          rows={2}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="sale-manage__form-actions">
        <Button type="button" variant="ghost" onClick={onClose}>
          Volver
        </Button>
        <Button type="button" loading={saving} onClick={() => void handleSubmit()}>
          Guardar corrección
        </Button>
      </div>
    </div>
  );
}

export function SaleManagePanel({ sale, onUpdated }: { sale: Sale; onUpdated: (sale: Sale) => void }) {
  const [action, setAction] = useState<Action>('none');
  const actions = availableActions(sale.status);

  function handleDone(updated: Sale) {
    onUpdated(updated);
    setAction('none');
  }

  if (actions.length === 0) return null;

  return (
    <Card className="sale-manage">
      <h2>Gestionar venta</h2>
      {action === 'none' ? (
        <div className="sale-manage__actions">
          {actions.map((a) => (
            <Button key={a} type="button" variant="secondary" onClick={() => setAction(a)}>
              {ACTION_LABELS[a]}
            </Button>
          ))}
        </div>
      ) : null}
      {action === 'cancel' ? (
        <CancelForm sale={sale} onDone={handleDone} onClose={() => setAction('none')} />
      ) : null}
      {action === 'return' ? (
        <ReturnForm sale={sale} onDone={handleDone} onClose={() => setAction('none')} />
      ) : null}
      {action === 'exchange' ? (
        <ExchangeForm sale={sale} onDone={handleDone} onClose={() => setAction('none')} />
      ) : null}
      {action === 'correct' ? (
        <CorrectForm sale={sale} onDone={handleDone} onClose={() => setAction('none')} />
      ) : null}
    </Card>
  );
}
