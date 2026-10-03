import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPaymentMethods } from '../../api/catalog';
import { ApiError } from '../../api/client';
import { listInventory } from '../../api/inventory';
import { listProducts } from '../../api/products';
import { createSale } from '../../api/sales';
import { getGeneralSettings } from '../../api/settings';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { renderReceiptJpgDataUrl, shareOrDownloadDataUrl } from '../../lib/receipt';
import { formatMoney } from '../../lib/money';
import { useNotify } from '../../notifications/useNotify';
import type { PaymentMethod } from '../../types/catalog';
import type { InventoryItem } from '../../types/inventory';
import type { Product } from '../../types/product';
import type { Sale } from '../../types/sale';
import './SaleFormPage.css';

const PRODUCT_SEARCH_DEBOUNCE_MS = 300;

interface CartLine {
  key: string;
  inventoryItemId: number;
  productId: string;
  productName: string;
  sizeName: string;
  colorName: string;
  quantity: number;
  unitPrice: number;
  originalPrice: number;
  maxStock: number;
}

interface VariantEntry {
  quantity: string;
  price: string;
}

export function SaleFormPage() {
  const notify = useNotify();

  const [saving, setSaving] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [includeShipping, setIncludeShipping] = useState(false);
  const [shippingFee, setShippingFee] = useState('35');

  const [productSearch, setProductSearch] = useState('');
  const [fetchedSearchResults, setFetchedSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<InventoryItem[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantEntries, setVariantEntries] = useState<Record<string, VariantEntry>>({});
  // Con muchas combinaciones (ej. 5 tallas × 10 colores) una sola tabla
  // plana se vuelve inmanejable, sobre todo con colores parecidos entre sí.
  // Primero se elige la talla, luego los colores de esa talla — y lo ya
  // elegido en otras tallas no se pierde al cambiar de pestaña.
  const [activeSizeName, setActiveSizeName] = useState<string | null>(null);
  const [selectedComboIds, setSelectedComboIds] = useState<Set<string>>(new Set());

  const [cart, setCart] = useState<CartLine[]>([]);

  const [createdSale, setCreatedSale] = useState<Sale | null>(null);
  const [receiptDataUrl, setReceiptDataUrl] = useState<string | null>(null);

  useEffect(() => {
    listPaymentMethods('sales')
      .then(setPaymentMethods)
      .catch(() => notify.error('No se pudieron cargar las formas de pago.'));
  }, [notify]);

  useEffect(() => {
    getGeneralSettings()
      .then((settings) => setShippingFee(String(settings.defaultShippingFee)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (productSearch.trim().length < 2) return;

    const timer = setTimeout(() => {
      setSearching(true);
      listProducts({ search: productSearch.trim() })
        .then((res) => setFetchedSearchResults(res.items))
        .catch(() => notify.error('No se pudo buscar productos.'))
        .finally(() => setSearching(false));
    }, PRODUCT_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [productSearch, notify]);

  const searchResults = productSearch.trim().length < 2 ? [] : fetchedSearchResults;

  function selectProduct(product: Product) {
    setSelectedProduct(product);
    setProductSearch('');
    setActiveSizeName(null);
    setSelectedComboIds(new Set());
    setLoadingVariants(true);
    listInventory({ productId: Number(product.id), available: 'true' })
      .then((res) => {
        setVariants(res.items);
        const initial: Record<string, VariantEntry> = {};
        for (const variant of res.items) {
          initial[variant.id] = { quantity: '', price: product.salePrice ?? '' };
        }
        setVariantEntries(initial);
      })
      .catch(() => notify.error('No se pudieron cargar las existencias del producto.'))
      .finally(() => setLoadingVariants(false));
  }

  // Tallas disponibles, en el orden en que aparecen las existencias.
  const availableSizes = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const v of variants) {
      if (!seen.has(v.sizeName)) {
        seen.add(v.sizeName);
        ordered.push(v.sizeName);
      }
    }
    return ordered;
  }, [variants]);

  // Colores de la talla actualmente abierta en el picker.
  const colorsForActiveSize = useMemo(
    () => variants.filter((v) => v.sizeName === activeSizeName),
    [variants, activeSizeName],
  );

  // Combinaciones elegidas para esta venta, sin importar en qué talla se
  // seleccionaron — es lo que efectivamente se va a pedir cantidad/precio.
  const selectedVariants = useMemo(
    () => variants.filter((v) => selectedComboIds.has(v.id)),
    [variants, selectedComboIds],
  );

  function toggleCombo(id: string) {
    setSelectedComboIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addSelectedVariantsToCart() {
    if (!selectedProduct) return;
    const newLines: CartLine[] = [];
    for (const variant of selectedVariants) {
      const entry = variantEntries[variant.id];
      const quantity = Number(entry?.quantity);
      const price = Number(entry?.price);
      if (!entry || !quantity || quantity <= 0 || Number.isNaN(price) || price < 0) continue;
      if (quantity > variant.quantity) {
        notify.error(
          `${variant.sizeName}/${variant.colorName}: solo hay ${variant.quantity} disponibles.`,
        );
        return;
      }

      newLines.push({
        key: String(variant.id),
        inventoryItemId: Number(variant.id),
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sizeName: variant.sizeName,
        colorName: variant.colorName,
        quantity,
        unitPrice: price,
        originalPrice: selectedProduct.salePrice ? Number(selectedProduct.salePrice) : price,
        maxStock: variant.quantity,
      });
    }

    if (newLines.length === 0) {
      notify.error('Ingresa cantidad y precio para al menos una combinación.');
      return;
    }

    setCart((prev) => {
      const map = new Map(prev.map((line) => [line.key, line]));
      for (const line of newLines) map.set(line.key, line);
      return [...map.values()];
    });
    setSelectedProduct(null);
    setVariants([]);
    setVariantEntries({});
    setActiveSizeName(null);
    setSelectedComboIds(new Set());
  }

  function updateCartLine(key: string, patch: Partial<Pick<CartLine, 'quantity' | 'unitPrice'>>) {
    setCart((prev) =>
      prev.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  }

  function removeCartLine(key: string) {
    setCart((prev) => prev.filter((line) => line.key !== key));
  }

  const cartGroups = useMemo(() => {
    const groups = new Map<string, { productName: string; lines: CartLine[] }>();
    for (const line of cart) {
      const group = groups.get(line.productId) ?? { productName: line.productName, lines: [] };
      group.lines.push(line);
      groups.set(line.productId, group);
    }
    return [...groups.values()];
  }, [cart]);

  const shippingAmount = includeShipping ? Number(shippingFee) || 0 : 0;

  const subtotal = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [cart],
  );
  const total = subtotal + shippingAmount;

  function resetForNewSale() {
    setCreatedSale(null);
    setReceiptDataUrl(null);
    setCart([]);
    setNotes('');
    setPaymentMethodId('');
    setIncludeShipping(false);
  }

  async function handleConfirm() {
    if (!paymentMethodId) {
      notify.error('Selecciona una forma de pago.');
      return;
    }
    if (cart.length === 0) {
      notify.error('Agrega al menos un producto a la venta.');
      return;
    }
    for (const line of cart) {
      if (line.quantity > line.maxStock) {
        notify.error(`${line.productName}: la cantidad supera el stock disponible.`);
        return;
      }
    }

    setSaving(true);
    try {
      const sale = await createSale({
        paymentMethodId: Number(paymentMethodId),
        notes: notes.trim() || undefined,
        shippingAmount: shippingAmount > 0 ? shippingAmount : undefined,
        items: cart.map((line) => ({
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
          unitSalePrice: line.unitPrice,
        })),
      });
      notify.success('Venta registrada.');
      setCreatedSale(sale);
      const settings = await getGeneralSettings().catch(() => undefined);
      const dataUrl = await renderReceiptJpgDataUrl(
        sale,
        settings
          ? { businessName: settings.businessName, receiptMessage: settings.receiptMessage }
          : undefined,
      );
      setReceiptDataUrl(dataUrl);
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo registrar la venta.');
    } finally {
      setSaving(false);
    }
  }

  if (createdSale) {
    return (
      <div className="sale-form">
        <Card className="sale-form__success">
          <img src="/mala-mia-heart.png" alt="Venta registrada" className="sale-form__success-heart" />
          <h1>¡Venta #{createdSale.saleNumber} registrada!</h1>
          <p className="sale-form__hint">
            Total: {formatMoney(Number(createdSale.total))} · {createdSale.paymentMethod.name}
          </p>
          {receiptDataUrl ? (
            <img
              src={receiptDataUrl}
              alt={`Comprobante de la venta ${createdSale.saleNumber}`}
              className="sale-form__receipt-image"
            />
          ) : (
            <p className="sale-form__hint">Generando comprobante…</p>
          )}
          <div className="sale-form__success-actions">
            {receiptDataUrl ? (
              <Button
                type="button"
                onClick={() =>
                  void shareOrDownloadDataUrl(
                    receiptDataUrl,
                    `venta-${createdSale.saleNumber}.jpg`,
                    `Venta #${createdSale.saleNumber}`,
                  )
                }
              >
                Compartir comprobante
              </Button>
            ) : null}
            <Button type="button" variant="secondary" onClick={resetForNewSale}>
              Nueva venta
            </Button>
            <Link to={`/ventas/${createdSale.id}`}>
              <Button type="button" variant="ghost">
                Ver venta
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="sale-form">
      <header className="sale-form__header">
        <h1>Nueva venta</h1>
      </header>

      {!selectedProduct ? (
        <Card className="sale-form__section">
          <h2 className="sale-form__section-title">Buscar producto</h2>
          <Input
            label="Producto"
            placeholder="Nombre o código, ej. blusa satin"
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
          />

          {searching ? <p className="sale-form__hint">Buscando…</p> : null}

          {searchResults.length > 0 ? (
            <ul className="sale-form__results">
              {searchResults.map((product) => (
                <li key={product.id}>
                  <button type="button" onClick={() => selectProduct(product)}>
                    <strong>{product.name}</strong>
                    <span>
                      {product.code}
                      {product.salePrice ? ` · Q${product.salePrice}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : (
        <Card className="sale-form__section">
          <h2 className="sale-form__section-title">{selectedProduct.name}</h2>
          <p className="sale-form__hint">{selectedProduct.code} · Solo se muestran combinaciones con stock.</p>

          {loadingVariants ? (
            <p className="sale-form__hint">Cargando existencias…</p>
          ) : variants.length === 0 ? (
            <p className="sale-form__hint">Este producto no tiene stock disponible.</p>
          ) : (
            <>
              <div className="sale-form__size-chips">
                {availableSizes.map((sizeName) => (
                  <button
                    key={sizeName}
                    type="button"
                    className={`chip${activeSizeName === sizeName ? ' is-active' : ''}`}
                    onClick={() => setActiveSizeName(sizeName)}
                  >
                    {sizeName}
                  </button>
                ))}
              </div>

              {activeSizeName ? (
                <div className="sale-form__color-chips">
                  {colorsForActiveSize.map((variant) => {
                    const isSelected = selectedComboIds.has(variant.id);
                    return (
                      <button
                        key={variant.id}
                        type="button"
                        className={`chip chip--sm${isSelected ? ' is-active' : ''}`}
                        onClick={() => toggleCombo(variant.id)}
                      >
                        {variant.colorName} · {variant.quantity}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="sale-form__hint">Elige una talla para ver sus colores disponibles.</p>
              )}

              {selectedVariants.length > 0 ? (
                <table className="sale-form__variant-table">
                  <thead>
                    <tr>
                      <th>Combinación</th>
                      <th>Cantidad</th>
                      <th>Precio (Q)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedVariants.map((variant) => {
                      const entry = variantEntries[variant.id] ?? { quantity: '', price: '' };
                      return (
                        <tr key={variant.id}>
                          <td>
                            {variant.sizeName} / {variant.colorName}
                            <div className="sale-form__stock">{variant.quantity} disponibles</div>
                          </td>
                          <td>
                            <input
                              className="field__input"
                              type="number"
                              min="0"
                              max={variant.quantity}
                              value={entry.quantity}
                              onChange={(event) =>
                                setVariantEntries((prev) => ({
                                  ...prev,
                                  [variant.id]: { ...entry, quantity: event.target.value },
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="field__input"
                              type="number"
                              min="0"
                              step="0.01"
                              value={entry.price}
                              onChange={(event) =>
                                setVariantEntries((prev) => ({
                                  ...prev,
                                  [variant.id]: { ...entry, price: event.target.value },
                                }))
                              }
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : null}
            </>
          )}

          <div className="sale-form__inline-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSelectedProduct(null);
                setVariants([]);
                setActiveSizeName(null);
                setSelectedComboIds(new Set());
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={addSelectedVariantsToCart}
              disabled={selectedVariants.length === 0}
            >
              Agregar a la venta
            </Button>
          </div>
        </Card>
      )}

      {cartGroups.length > 0 ? (
        <Card className="sale-form__section">
          <h2 className="sale-form__section-title">Resumen de la venta</h2>
          {cartGroups.map((group) => (
            <div key={group.productName} className="sale-form__cart-group">
              <strong>{group.productName}</strong>
              {group.lines.map((line) => (
                <div key={line.key} className="sale-form__cart-line">
                  <div className="sale-form__cart-line-info">
                    <span>
                      {line.sizeName} / {line.colorName}
                    </span>
                    {line.unitPrice < line.originalPrice ? (
                      <span className="sale-form__discount-badge">Precio con descuento</span>
                    ) : null}
                  </div>
                  <div className="sale-form__cart-line-controls">
                    <input
                      type="number"
                      min="1"
                      max={line.maxStock}
                      value={line.quantity}
                      aria-label={`Cantidad de ${line.productName} ${line.sizeName}/${line.colorName}`}
                      onChange={(event) =>
                        updateCartLine(line.key, { quantity: Number(event.target.value) })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.unitPrice}
                      aria-label={`Precio de ${line.productName} ${line.sizeName}/${line.colorName}`}
                      onChange={(event) =>
                        updateCartLine(line.key, { unitPrice: Number(event.target.value) })
                      }
                    />
                    <span className="sale-form__cart-line-subtotal">
                      {formatMoney(line.quantity * line.unitPrice)}
                    </span>
                    <button
                      type="button"
                      className="sale-form__remove-line"
                      aria-label="Quitar línea"
                      onClick={() => removeCartLine(line.key)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}

          <label className="sale-form__shipping-toggle">
            <input
              type="checkbox"
              checked={includeShipping}
              onChange={(event) => setIncludeShipping(event.target.checked)}
            />
            Cobrar envío
            {includeShipping ? (
              <input
                type="number"
                min="0"
                step="0.01"
                className="sale-form__shipping-amount"
                aria-label="Monto del envío"
                value={shippingFee}
                onChange={(event) => setShippingFee(event.target.value)}
              />
            ) : null}
          </label>

          {includeShipping ? (
            <p className="sale-form__subtotal-hint">
              Subtotal {formatMoney(subtotal)} + envío {formatMoney(shippingAmount)}
            </p>
          ) : null}
          <p className="sale-form__total">
            Total: <strong>{formatMoney(total)}</strong>
          </p>
        </Card>
      ) : null}

      <Card className="sale-form__section">
        <div className="field">
          <label className="field__label" htmlFor="sale-payment-method">
            Forma de pago
          </label>
          <select
            id="sale-payment-method"
            className="field__input"
            value={paymentMethodId}
            onChange={(event) =>
              setPaymentMethodId(event.target.value ? Number(event.target.value) : '')
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

        <div className="field">
          <label className="field__label" htmlFor="sale-notes">
            Notas (opcional)
          </label>
          <textarea
            id="sale-notes"
            className="field__input"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
          />
        </div>
      </Card>

      <div className="sale-form__actions">
        <Link to="/ventas">
          <Button type="button" variant="ghost">
            Cancelar
          </Button>
        </Link>
        <Button type="button" loading={saving} onClick={() => void handleConfirm()}>
          Confirmar venta
        </Button>
      </div>
    </div>
  );
}
