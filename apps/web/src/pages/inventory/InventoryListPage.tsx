import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createColor, createSize, listColors, listSizes } from '../../api/catalog';
import { adjustInventoryVariant, listGroupedInventory } from '../../api/inventory';
import { addProductVariants } from '../../api/products';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { useNotify } from '../../notifications/useNotify';
import type { Color, Size } from '../../types/catalog';
import { ADJUSTMENT_REASONS } from '../../types/inventory';
import type { InventoryGroupedItem, InventoryStatus } from '../../types/inventory';
import './InventoryListPage.css';

const SEARCH_DEBOUNCE_MS = 350;

const STATUS_LABEL: Record<InventoryStatus, string> = {
  DISPONIBLE: 'Disponible',
  STOCK_BAJO: 'Stock bajo',
  AGOTADO: 'Agotado',
};

function comboKey(productId: string, sizeId: string, colorId: string): string {
  return `${productId}-${sizeId}-${colorId}`;
}

/** Inventario agrupado por producto (mismo estilo que Disponibilidad), pero
 * editable: cada combinación —tenga o no ya una fila de inventario— se puede
 * ajustar aquí mismo, sin pasar por una compra. */
export function InventoryListPage() {
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<InventoryGroupedItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  const [adjustingKey, setAdjustingKey] = useState<string | null>(null);
  const [quantityChange, setQuantityChange] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Agregar una combinación nueva (talla/color que el producto nunca manejó).
  const [sizes, setSizes] = useState<Size[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [addingToProductId, setAddingToProductId] = useState<string | null>(null);
  const [newSizeId, setNewSizeId] = useState<number | ''>('');
  const [newColorId, setNewColorId] = useState<number | ''>('');
  const [newQuantity, setNewQuantity] = useState('');
  const [showNewSize, setShowNewSize] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [creatingSize, setCreatingSize] = useState(false);
  const [showNewColor, setShowNewColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [creatingColor, setCreatingColor] = useState(false);
  const [addingVariant, setAddingVariant] = useState(false);

  useEffect(() => {
    Promise.all([listSizes(), listColors()])
      .then(([szs, cols]) => {
        setSizes(szs);
        setColors(cols);
      })
      .catch(() => undefined);
  }, []);

  function load() {
    setLoading(true);
    listGroupedInventory({ search: search.trim() || undefined })
      .then((res) => setItems(res))
      .catch((error: unknown) => {
        notify.error(error instanceof ApiError ? error.message : 'No se pudo cargar el inventario.');
        setItems([]);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      listGroupedInventory({ search: search.trim() || undefined })
        .then((res) => {
          if (!cancelled) setItems(res);
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          notify.error(error instanceof ApiError ? error.message : 'No se pudo cargar el inventario.');
          setItems([]);
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

  const groups = useMemo(() => {
    const byProduct = new Map<
      string,
      { productName: string; productCode: string; items: InventoryGroupedItem[] }
    >();
    for (const item of items ?? []) {
      const group = byProduct.get(item.productId) ?? {
        productName: item.productName,
        productCode: item.productCode,
        items: [],
      };
      group.items.push(item);
      byProduct.set(item.productId, group);
    }
    return [...byProduct.entries()].map(([productId, group]) => {
      const bySize = new Map<string, { sizeName: string; items: InventoryGroupedItem[] }>();
      for (const item of group.items) {
        const sizeGroup = bySize.get(item.sizeId) ?? { sizeName: item.sizeName, items: [] };
        sizeGroup.items.push(item);
        bySize.set(item.sizeId, sizeGroup);
      }
      return { productId, ...group, sizes: [...bySize.values()] };
    });
  }, [items]);

  function startAdjusting(item: InventoryGroupedItem) {
    setAdjustingKey(comboKey(item.productId, item.sizeId, item.colorId));
    setQuantityChange('');
    setReason('');
    setNotes('');
  }

  function cancelAdjusting() {
    setAdjustingKey(null);
  }

  async function submitAdjustment(item: InventoryGroupedItem) {
    const delta = Number(quantityChange);
    if (!delta || Number.isNaN(delta)) {
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
      await adjustInventoryVariant({
        productId: Number(item.productId),
        sizeId: Number(item.sizeId),
        colorId: Number(item.colorId),
        quantityChange: delta,
        reason,
        notes: notes.trim() || undefined,
      });
      notify.success('Inventario actualizado.');
      setAdjustingKey(null);
      load();
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo ajustar el inventario.');
    } finally {
      setSaving(false);
    }
  }

  function startAddingVariant(productId: string) {
    setAddingToProductId(productId);
    setNewSizeId('');
    setNewColorId('');
    setNewQuantity('');
    setShowNewSize(false);
    setShowNewColor(false);
  }

  function cancelAddingVariant() {
    setAddingToProductId(null);
  }

  async function handleCreateSize() {
    if (!newSizeName.trim()) return;
    setCreatingSize(true);
    try {
      const size = await createSize(newSizeName.trim());
      setSizes((prev) => [...prev, size]);
      setNewSizeId(Number(size.id));
      setShowNewSize(false);
      setNewSizeName('');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo crear la talla.');
    } finally {
      setCreatingSize(false);
    }
  }

  async function handleCreateColor() {
    if (!newColorName.trim()) return;
    setCreatingColor(true);
    try {
      const color = await createColor(newColorName.trim());
      setColors((prev) => [...prev, color]);
      setNewColorId(Number(color.id));
      setShowNewColor(false);
      setNewColorName('');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo crear el color.');
    } finally {
      setCreatingColor(false);
    }
  }

  async function submitNewVariant(productId: string) {
    if (!newSizeId || !newColorId) {
      notify.error('Selecciona una talla y un color.');
      return;
    }
    setAddingVariant(true);
    try {
      await addProductVariants(productId, [{ sizeId: Number(newSizeId), colorId: Number(newColorId) }]);
      const initialQty = Number(newQuantity);
      if (initialQty > 0) {
        await adjustInventoryVariant({
          productId: Number(productId),
          sizeId: Number(newSizeId),
          colorId: Number(newColorId),
          quantityChange: initialQty,
          reason: 'Corrección de inventario',
          notes: 'Stock inicial de una combinación nueva.',
        });
      }
      notify.success('Combinación agregada.');
      setAddingToProductId(null);
      load();
    } catch (error) {
      notify.error(
        error instanceof ApiError ? error.message : 'No se pudo agregar la combinación.',
      );
    } finally {
      setAddingVariant(false);
    }
  }

  return (
    <div className="inventory-list">
      <header className="inventory-list__header">
        <div>
          <h1>Inventario</h1>
          <p>Existencias por producto, talla y color — edítalas aquí sin necesidad de una compra.</p>
        </div>
        <Link to="/inventario" className="inventory-list__back">
          ← Ver catálogo de productos
        </Link>
      </header>

      <Input
        label="Buscar"
        placeholder="Producto, código, talla o color"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      {loading ? (
        <Loading label="Buscando inventario…" />
      ) : groups.length === 0 ? (
        <Card>
          <EmptyState
            title="Sin productos para mostrar"
            description="Crea un producto con al menos una combinación para empezar a manejar su inventario."
          />
        </Card>
      ) : (
        <div className="inventory-list__groups">
          {groups.map((group) => (
            <Card key={group.productId} className="inventory-group">
              <div className="inventory-group__header">
                <span className="inventory-group__name">{group.productName}</span>
                <span className="inventory-group__code">{group.productCode}</span>
              </div>
              <button
                type="button"
                className="inventory-group__add-variant-toggle"
                onClick={() =>
                  addingToProductId === group.productId
                    ? cancelAddingVariant()
                    : startAddingVariant(group.productId)
                }
              >
                {addingToProductId === group.productId ? 'Cancelar' : '+ Agregar talla/color nuevo'}
              </button>

              {addingToProductId === group.productId ? (
                <div className="inventory-adjust-form">
                  <div className="inventory-group__size-color-header">
                    <Button type="button" variant="ghost" onClick={() => setShowNewSize((v) => !v)}>
                      + Nueva talla
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setShowNewColor((v) => !v)}>
                      + Nuevo color
                    </Button>
                  </div>
                  {showNewSize ? (
                    <div className="inventory-inline-create">
                      <Input
                        label="Nombre de la talla"
                        value={newSizeName}
                        onChange={(event) => setNewSizeName(event.target.value)}
                        autoFocus
                      />
                      <Button type="button" loading={creatingSize} onClick={() => void handleCreateSize()}>
                        Agregar talla
                      </Button>
                    </div>
                  ) : null}
                  {showNewColor ? (
                    <div className="inventory-inline-create">
                      <Input
                        label="Nombre del color"
                        placeholder="Ej. Verde musgo"
                        value={newColorName}
                        onChange={(event) => setNewColorName(event.target.value)}
                        autoFocus
                      />
                      <Button type="button" loading={creatingColor} onClick={() => void handleCreateColor()}>
                        Agregar color
                      </Button>
                    </div>
                  ) : null}

                  <div className="field">
                    <label className="field__label" htmlFor={`new-size-${group.productId}`}>
                      Talla
                    </label>
                    <select
                      id={`new-size-${group.productId}`}
                      className="field__input"
                      value={newSizeId}
                      onChange={(event) =>
                        setNewSizeId(event.target.value ? Number(event.target.value) : '')
                      }
                    >
                      <option value="">Selecciona una talla</option>
                      {sizes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor={`new-color-${group.productId}`}>
                      Color
                    </label>
                    <select
                      id={`new-color-${group.productId}`}
                      className="field__input"
                      value={newColorId}
                      onChange={(event) =>
                        setNewColorId(event.target.value ? Number(event.target.value) : '')
                      }
                    >
                      <option value="">Selecciona un color</option>
                      {colors.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Input
                    label="Cantidad inicial (opcional)"
                    type="number"
                    min="0"
                    value={newQuantity}
                    onChange={(event) => setNewQuantity(event.target.value)}
                  />
                  <div className="inventory-adjust-form__actions">
                    <Button type="button" variant="ghost" onClick={cancelAddingVariant}>
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      loading={addingVariant}
                      onClick={() => void submitNewVariant(group.productId)}
                    >
                      Agregar combinación
                    </Button>
                  </div>
                </div>
              ) : null}

              {group.sizes.map((sizeGroup) => (
                <div key={sizeGroup.sizeName} className="inventory-size-row">
                  <span className="inventory-size-row__label">{sizeGroup.sizeName}</span>
                  <div className="inventory-size-row__colors">
                    {sizeGroup.items.map((item) => {
                      const key = comboKey(item.productId, item.sizeId, item.colorId);
                      const isAdjusting = adjustingKey === key;
                      return (
                        <div key={key} className="inventory-combo">
                          <button
                            type="button"
                            className="inventory-combo__chip"
                            onClick={() => (isAdjusting ? cancelAdjusting() : startAdjusting(item))}
                          >
                            <span
                              className={`inventory-dot inventory-dot--${item.status.toLowerCase()}`}
                              aria-hidden="true"
                            />
                            {item.colorName} · {item.quantity} u.
                            <span className="inventory-combo__status">{STATUS_LABEL[item.status]}</span>
                          </button>
                          {item.inventoryItemId ? (
                            <Link
                              to={`/inventario/stock/${item.inventoryItemId}`}
                              className="inventory-combo__history"
                            >
                              Historial →
                            </Link>
                          ) : null}

                          {isAdjusting ? (
                            <div className="inventory-adjust-form">
                              <div className="field">
                                <label className="field__label" htmlFor={`qty-${key}`}>
                                  Ajuste (ej. -2 o 3)
                                </label>
                                <input
                                  id={`qty-${key}`}
                                  className="field__input"
                                  type="number"
                                  step="1"
                                  value={quantityChange}
                                  onChange={(event) => setQuantityChange(event.target.value)}
                                  autoFocus
                                />
                              </div>
                              <div className="field">
                                <label className="field__label" htmlFor={`reason-${key}`}>
                                  Motivo
                                </label>
                                <select
                                  id={`reason-${key}`}
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
                                <label className="field__label" htmlFor={`notes-${key}`}>
                                  Notas {reason === 'Otro' ? '(obligatorio)' : '(opcional)'}
                                </label>
                                <textarea
                                  id={`notes-${key}`}
                                  className="field__input"
                                  rows={2}
                                  value={notes}
                                  onChange={(event) => setNotes(event.target.value)}
                                />
                              </div>
                              <div className="inventory-adjust-form__actions">
                                <Button type="button" variant="ghost" onClick={cancelAdjusting}>
                                  Cancelar
                                </Button>
                                <Button
                                  type="button"
                                  loading={saving}
                                  onClick={() => void submitAdjustment(item)}
                                >
                                  Confirmar ajuste
                                </Button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
