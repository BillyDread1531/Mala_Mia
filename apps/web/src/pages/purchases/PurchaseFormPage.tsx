import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCategories, listColors, listPaymentMethods, listSizes } from '../../api/catalog';
import { ApiError } from '../../api/client';
import { createPurchase } from '../../api/purchases';
import { checkDuplicates, createProduct, generateCode, listProducts } from '../../api/products';
import { createSupplier, listSuppliers } from '../../api/suppliers';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { useNotify } from '../../notifications/useNotify';
import type { Category, Color, PaymentMethod, Size } from '../../types/catalog';
import type { Product } from '../../types/product';
import type { Supplier } from '../../types/supplier';
import { SizeColorPicker } from '../products/SizeColorPicker';
import { comboKey, computeActiveVariants } from '../products/variantCombo';
import './PurchaseFormPage.css';

const PRODUCT_SEARCH_DEBOUNCE_MS = 300;

interface CartLine {
  key: string;
  productId: number;
  productName: string;
  productCode: string;
  sizeId: number;
  sizeName: string;
  colorId: number;
  colorName: string;
  quantity: number;
  unitCost: number;
}

interface VariantEntry {
  quantity: string;
  unitCost: string;
}

function formatMoney(value: number): string {
  return value.toFixed(2).replace(/\.00$/, '');
}

export function PurchaseFormPage() {
  const navigate = useNavigate();
  const notify = useNotify();

  const [saving, setSaving] = useState(false);

  // Proveedor
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  // Forma de pago
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodId, setPaymentMethodId] = useState<number | ''>('');

  const [notes, setNotes] = useState('');

  // Búsqueda / selección de producto
  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [colors, setColors] = useState<Color[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [fetchedSearchResults, setFetchedSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [variantEntries, setVariantEntries] = useState<Record<string, VariantEntry>>({});

  // Creación de producto inline
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategoryId, setNewProductCategoryId] = useState<number | ''>('');
  const [newProductCode, setNewProductCode] = useState('');
  const [newProductCost, setNewProductCost] = useState('');
  const [newProductSalePrice, setNewProductSalePrice] = useState('');
  const [newProductSizeIds, setNewProductSizeIds] = useState<Set<number>>(new Set());
  const [newProductColorIds, setNewProductColorIds] = useState<Set<number>>(new Set());
  const [newProductDisabledCombos, setNewProductDisabledCombos] = useState<Set<string>>(new Set());
  const [newProductDuplicates, setNewProductDuplicates] = useState<Product[]>([]);
  const [newProductDuplicatesDismissed, setNewProductDuplicatesDismissed] = useState(false);
  const [creatingProduct, setCreatingProduct] = useState(false);

  const [cart, setCart] = useState<CartLine[]>([]);

  useEffect(() => {
    Promise.all([listSuppliers(), listPaymentMethods(), listCategories(), listSizes(), listColors()])
      .then(([sup, pm, cats, szs, cols]) => {
        setSuppliers(sup);
        setPaymentMethods(pm);
        setCategories(cats);
        setSizes(szs);
        setColors(cols);
      })
      .catch(() => notify.error('No se pudieron cargar proveedores/formas de pago/categorías.'));
  }, [notify]);

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

  useEffect(() => {
    if (!newProductCategoryId) return;
    generateCode(Number(newProductCategoryId))
      .then((res) => setNewProductCode(res.code))
      .catch(() => undefined);
  }, [newProductCategoryId]);

  function selectProduct(product: Product) {
    setSelectedProduct(product);
    setProductSearch('');
    const initial: Record<string, VariantEntry> = {};
    for (const variant of product.variants) {
      initial[comboKey(Number(variant.sizeId), Number(variant.colorId))] = {
        quantity: '',
        unitCost: product.cost ?? '',
      };
    }
    setVariantEntries(initial);
  }

  function handleNewProductNameBlur() {
    const query = newProductName.trim();
    if (query.length < 2) {
      setNewProductDuplicates([]);
      return;
    }
    checkDuplicates(query)
      .then((matches) => {
        setNewProductDuplicates(matches);
        setNewProductDuplicatesDismissed(false);
      })
      .catch(() => undefined);
  }

  async function handleCreateSupplier() {
    if (!newSupplierName.trim()) return;
    setCreatingSupplier(true);
    try {
      const supplier = await createSupplier({ name: newSupplierName.trim() });
      setSuppliers((prev) => [...prev, supplier].sort((a, b) => a.name.localeCompare(b.name)));
      setSupplierId(Number(supplier.id));
      setShowNewSupplier(false);
      setNewSupplierName('');
      notify.success('Proveedor agregado.');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo crear el proveedor.');
    } finally {
      setCreatingSupplier(false);
    }
  }

  async function handleCreateProduct() {
    const trimmedName = newProductName.trim();
    if (trimmedName.length < 2 || !newProductCategoryId) {
      notify.error('Escribe un nombre y selecciona una categoría para el producto nuevo.');
      return;
    }
    setCreatingProduct(true);
    try {
      const created = await createProduct({
        name: trimmedName,
        categoryId: Number(newProductCategoryId),
        code: newProductCode.trim() || undefined,
        cost: newProductCost.trim() ? Number(newProductCost) : undefined,
        salePrice: newProductSalePrice.trim() ? Number(newProductSalePrice) : undefined,
        variants: computeActiveVariants(newProductSizeIds, newProductColorIds, newProductDisabledCombos),
      });
      notify.success('Producto creado.');
      selectProduct(created);
      setShowNewProduct(false);
      setNewProductName('');
      setNewProductCategoryId('');
      setNewProductCode('');
      setNewProductCost('');
      setNewProductSalePrice('');
      setNewProductSizeIds(new Set());
      setNewProductColorIds(new Set());
      setNewProductDisabledCombos(new Set());
      setNewProductDuplicates([]);
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo crear el producto.');
    } finally {
      setCreatingProduct(false);
    }
  }

  function addSelectedVariantsToCart() {
    if (!selectedProduct) return;
    const newLines: CartLine[] = [];
    for (const variant of selectedProduct.variants) {
      const key = comboKey(Number(variant.sizeId), Number(variant.colorId));
      const entry = variantEntries[key];
      const quantity = Number(entry?.quantity);
      const unitCost = Number(entry?.unitCost);
      if (!entry || !quantity || quantity <= 0 || Number.isNaN(unitCost) || unitCost < 0) continue;

      newLines.push({
        key: `${selectedProduct.id}-${key}`,
        productId: Number(selectedProduct.id),
        productName: selectedProduct.name,
        productCode: selectedProduct.code,
        sizeId: Number(variant.sizeId),
        sizeName: variant.sizeName,
        colorId: Number(variant.colorId),
        colorName: variant.colorName,
        quantity,
        unitCost,
      });
    }

    if (newLines.length === 0) {
      notify.error('Ingresa cantidad y costo para al menos una combinación.');
      return;
    }

    setCart((prev) => {
      const map = new Map(prev.map((line) => [line.key, line]));
      for (const line of newLines) map.set(line.key, line);
      return [...map.values()];
    });
    setSelectedProduct(null);
    setVariantEntries({});
  }

  function removeCartLine(key: string) {
    setCart((prev) => prev.filter((line) => line.key !== key));
  }

  const cartGroups = useMemo(() => {
    const groups = new Map<number, { productName: string; productCode: string; lines: CartLine[] }>();
    for (const line of cart) {
      const group = groups.get(line.productId) ?? {
        productName: line.productName,
        productCode: line.productCode,
        lines: [],
      };
      group.lines.push(line);
      groups.set(line.productId, group);
    }
    return [...groups.values()];
  }, [cart]);

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.quantity * line.unitCost, 0),
    [cart],
  );

  async function handleConfirm() {
    if (!supplierId) {
      notify.error('Selecciona un proveedor.');
      return;
    }
    if (!paymentMethodId) {
      notify.error('Selecciona una forma de pago.');
      return;
    }
    if (cart.length === 0) {
      notify.error('Agrega al menos un producto a la compra.');
      return;
    }

    setSaving(true);
    try {
      const created = await createPurchase({
        supplierId: Number(supplierId),
        paymentMethodId: Number(paymentMethodId),
        notes: notes.trim() || undefined,
        items: cart.map((line) => ({
          productId: line.productId,
          sizeId: line.sizeId,
          colorId: line.colorId,
          quantity: line.quantity,
          unitCost: line.unitCost,
        })),
      });
      notify.success('Compra registrada.');
      navigate(`/compras/${created.id}`);
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo registrar la compra.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="purchase-form">
      <header className="purchase-form__header">
        <h1>Nueva compra</h1>
      </header>

      <Card className="purchase-form__section">
        <div className="purchase-form__row">
          <div className="field">
            <label className="field__label" htmlFor="purchase-supplier">
              Proveedor
            </label>
            <select
              id="purchase-supplier"
              className="field__input"
              value={supplierId}
              onChange={(event) => {
                if (event.target.value === '__new__') {
                  setShowNewSupplier(true);
                  return;
                }
                setSupplierId(event.target.value ? Number(event.target.value) : '');
              }}
            >
              <option value="">Selecciona un proveedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
              <option value="__new__">+ Nuevo proveedor</option>
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="purchase-payment-method">
              Forma de pago
            </label>
            <select
              id="purchase-payment-method"
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
        </div>

        {showNewSupplier ? (
          <div className="purchase-form__inline-create">
            <Input
              label="Nombre del proveedor"
              value={newSupplierName}
              onChange={(event) => setNewSupplierName(event.target.value)}
              autoFocus
            />
            <div className="purchase-form__inline-actions">
              <Button type="button" variant="ghost" onClick={() => setShowNewSupplier(false)}>
                Cancelar
              </Button>
              <Button type="button" loading={creatingSupplier} onClick={() => void handleCreateSupplier()}>
                Agregar proveedor
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      {!selectedProduct ? (
        <Card className="purchase-form__section">
          <h2 className="purchase-form__section-title">Buscar producto</h2>
          <Input
            label="Producto"
            placeholder="Nombre o código, ej. blusa satin"
            value={productSearch}
            onChange={(event) => setProductSearch(event.target.value)}
          />

          {searching ? <p className="purchase-form__hint">Buscando…</p> : null}

          {searchResults.length > 0 ? (
            <ul className="purchase-form__results">
              {searchResults.map((product) => (
                <li key={product.id}>
                  <button type="button" onClick={() => selectProduct(product)}>
                    <strong>{product.name}</strong>
                    <span>
                      {product.code} · {product.category.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {!showNewProduct ? (
            <Button type="button" variant="secondary" onClick={() => setShowNewProduct(true)}>
              + Crear producto nuevo
            </Button>
          ) : (
            <div className="purchase-form__inline-create">
              {newProductDuplicates.length > 0 && !newProductDuplicatesDismissed ? (
                <Card className="purchase-form__duplicates">
                  <h3>Producto posiblemente duplicado</h3>
                  <ul>
                    {newProductDuplicates.map((duplicate) => (
                      <li key={duplicate.id}>
                        <div>
                          <strong>{duplicate.name}</strong>
                          <span>
                            Código: {duplicate.code} · Categoría: {duplicate.category.name}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => {
                            selectProduct(duplicate);
                            setShowNewProduct(false);
                            setNewProductDuplicates([]);
                          }}
                        >
                          Usar existente
                        </Button>
                      </li>
                    ))}
                  </ul>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setNewProductDuplicatesDismissed(true)}
                  >
                    Crear de todas formas
                  </Button>
                </Card>
              ) : null}

              <Input
                label="Nombre"
                value={newProductName}
                onChange={(event) => setNewProductName(event.target.value)}
                onBlur={handleNewProductNameBlur}
                autoFocus
              />
              <div className="purchase-form__row">
                <div className="field">
                  <label className="field__label" htmlFor="new-product-category">
                    Categoría
                  </label>
                  <select
                    id="new-product-category"
                    className="field__input"
                    value={newProductCategoryId}
                    onChange={(event) =>
                      setNewProductCategoryId(event.target.value ? Number(event.target.value) : '')
                    }
                  >
                    <option value="">Selecciona una categoría</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  label="Código"
                  value={newProductCode}
                  onChange={(event) => setNewProductCode(event.target.value)}
                  placeholder="Se genera automáticamente"
                />
              </div>
              <div className="purchase-form__row">
                <Input
                  label="Costo actual (Q)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProductCost}
                  onChange={(event) => setNewProductCost(event.target.value)}
                />
                <Input
                  label="Precio de venta (Q)"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newProductSalePrice}
                  onChange={(event) => setNewProductSalePrice(event.target.value)}
                />
              </div>

              <SizeColorPicker
                sizes={sizes}
                colors={colors}
                selectedSizeIds={newProductSizeIds}
                selectedColorIds={newProductColorIds}
                disabledCombos={newProductDisabledCombos}
                onToggleSize={(sizeId) =>
                  setNewProductSizeIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(sizeId)) next.delete(sizeId);
                    else next.add(sizeId);
                    return next;
                  })
                }
                onToggleColor={(colorId) =>
                  setNewProductColorIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(colorId)) next.delete(colorId);
                    else next.add(colorId);
                    return next;
                  })
                }
                onToggleCombo={(sizeId, colorId) => {
                  const key = comboKey(sizeId, colorId);
                  setNewProductDisabledCombos((prev) => {
                    const next = new Set(prev);
                    if (next.has(key)) next.delete(key);
                    else next.add(key);
                    return next;
                  });
                }}
              />

              <div className="purchase-form__inline-actions">
                <Button type="button" variant="ghost" onClick={() => setShowNewProduct(false)}>
                  Cancelar
                </Button>
                <Button type="button" loading={creatingProduct} onClick={() => void handleCreateProduct()}>
                  Crear y seleccionar
                </Button>
              </div>
            </div>
          )}
        </Card>
      ) : (
        <Card className="purchase-form__section">
          <h2 className="purchase-form__section-title">{selectedProduct.name}</h2>
          <p className="purchase-form__hint">
            {selectedProduct.code} · Registra cantidad y costo de las combinaciones que compraste.
          </p>

          {selectedProduct.variants.length === 0 ? (
            <p className="purchase-form__hint">Este producto no tiene combinaciones activas.</p>
          ) : (
            <table className="purchase-form__variant-table">
              <thead>
                <tr>
                  <th>Combinación</th>
                  <th>Cantidad</th>
                  <th>Costo unitario (Q)</th>
                </tr>
              </thead>
              <tbody>
                {selectedProduct.variants.map((variant) => {
                  const key = comboKey(Number(variant.sizeId), Number(variant.colorId));
                  const entry = variantEntries[key] ?? { quantity: '', unitCost: '' };
                  return (
                    <tr key={key}>
                      <td>
                        {variant.sizeName} / {variant.colorName}
                      </td>
                      <td>
                        <input
                          className="field__input"
                          type="number"
                          min="0"
                          value={entry.quantity}
                          onChange={(event) =>
                            setVariantEntries((prev) => ({
                              ...prev,
                              [key]: { ...entry, quantity: event.target.value },
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
                          value={entry.unitCost}
                          onChange={(event) =>
                            setVariantEntries((prev) => ({
                              ...prev,
                              [key]: { ...entry, unitCost: event.target.value },
                            }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <div className="purchase-form__inline-actions">
            <Button type="button" variant="ghost" onClick={() => setSelectedProduct(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={addSelectedVariantsToCart}>
              Agregar a la compra
            </Button>
          </div>
        </Card>
      )}

      {cartGroups.length > 0 ? (
        <Card className="purchase-form__section">
          <h2 className="purchase-form__section-title">Resumen de la compra</h2>
          {cartGroups.map((group) => {
            const groupSubtotal = group.lines.reduce((sum, l) => sum + l.quantity * l.unitCost, 0);
            return (
              <div key={group.productCode} className="purchase-form__cart-group">
                <strong>{group.productName}</strong>
                <ul>
                  {group.lines.map((line) => (
                    <li key={line.key}>
                      <span>
                        {line.sizeName} / {line.colorName} → {line.quantity} × Q{formatMoney(line.unitCost)}
                      </span>
                      <span className="purchase-form__line-right">
                        Q{formatMoney(line.quantity * line.unitCost)}
                        <button
                          type="button"
                          className="purchase-form__remove-line"
                          aria-label="Quitar línea"
                          onClick={() => removeCartLine(line.key)}
                        >
                          ×
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="purchase-form__group-subtotal">Subtotal: Q{formatMoney(groupSubtotal)}</p>
              </div>
            );
          })}

          <p className="purchase-form__total">
            Total: <strong>Q{formatMoney(total)}</strong>
          </p>
        </Card>
      ) : null}

      <Card className="purchase-form__section">
        <div className="field">
          <label className="field__label" htmlFor="purchase-notes">
            Notas (opcional)
          </label>
          <textarea
            id="purchase-notes"
            className="field__input product-form__textarea"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
          />
        </div>
      </Card>

      <div className="purchase-form__actions">
        <Button type="button" variant="ghost" onClick={() => navigate('/compras')}>
          Cancelar
        </Button>
        <Button type="button" loading={saving} onClick={() => void handleConfirm()}>
          Confirmar compra
        </Button>
      </div>
    </div>
  );
}
