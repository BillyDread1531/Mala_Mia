import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listCategories, listColors, listPaymentMethods, listSizes } from '../../api/catalog';
import { ApiError } from '../../api/client';
import { createPurchase } from '../../api/purchases';
import {
  addProductVariants,
  checkDuplicates,
  createProduct,
  generateCode,
  listProducts,
  previewRecommendedPrice,
  updateProduct,
} from '../../api/products';
import { createSupplier, listSuppliers } from '../../api/suppliers';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { formatMoney } from '../../lib/money';
import { useNotify } from '../../notifications/useNotify';
import type { Category, Color, PaymentMethod, Size } from '../../types/catalog';
import type { Product } from '../../types/product';
import type { Supplier } from '../../types/supplier';
import { SizeColorPicker } from '../products/SizeColorPicker';
import { comboKey, computeActiveVariants } from '../products/variantCombo';
import './PurchaseFormPage.css';

const PRODUCT_SEARCH_DEBOUNCE_MS = 300;
const RECOMMENDED_PRICE_DEBOUNCE_MS = 300;

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

  // Picker de tallas/colores para el producto seleccionado: cada compra es
  // su propia factura, así que aquí se puede declarar cualquier combinación
  // (no solo las que el producto ya tenía), incluyendo tallas/colores
  // creados al vuelo. No afecta combinaciones de compras anteriores: solo se
  // agregan las que terminan con cantidad > 0 (ver `addProductVariants`).
  const [pickerSizeIds, setPickerSizeIds] = useState<Set<number>>(new Set());
  const [pickerColorIds, setPickerColorIds] = useState<Set<number>>(new Set());
  const [pickerDisabledCombos, setPickerDisabledCombos] = useState<Set<string>>(new Set());
  const [addingToCart, setAddingToCart] = useState(false);

  // Medidas del producto seleccionado (opcional, sobre todo pantalones):
  // se editan aquí mismo para no tener que salir a Inventario a cada rato.
  const [waistMeasurement, setWaistMeasurement] = useState('');
  const [lengthMeasurement, setLengthMeasurement] = useState('');
  const [savingMeasurements, setSavingMeasurements] = useState(false);

  const [shippingCost, setShippingCost] = useState('');

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
  const [newProductRecommendedPrice, setNewProductRecommendedPrice] = useState<string | null>(
    null,
  );

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

  // Precio recomendado en vivo, igual que en el formulario de Productos.
  useEffect(() => {
    const costNumber = Number(newProductCost);
    if (newProductCost.trim() === '' || Number.isNaN(costNumber)) return;

    const timer = setTimeout(() => {
      previewRecommendedPrice(costNumber)
        .then((res) => setNewProductRecommendedPrice(res.recommendedPrice))
        .catch(() => undefined);
    }, RECOMMENDED_PRICE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [newProductCost]);

  const newProductRecommended =
    newProductCost.trim() === '' || Number.isNaN(Number(newProductCost))
      ? null
      : newProductRecommendedPrice;

  function selectProduct(product: Product) {
    setSelectedProduct(product);
    setProductSearch('');

    // Precarga el picker con las combinaciones que el producto ya maneja
    // (comodidad para compras repetidas); se pueden agregar más tallas,
    // colores o combinaciones sueltas sin perder esto.
    const sizeIds = new Set(product.variants.map((v) => Number(v.sizeId)));
    const colorIds = new Set(product.variants.map((v) => Number(v.colorId)));
    const enabledKeys = new Set(
      product.variants.map((v) => comboKey(Number(v.sizeId), Number(v.colorId))),
    );
    const disabled = new Set<string>();
    for (const sizeId of sizeIds) {
      for (const colorId of colorIds) {
        const key = comboKey(sizeId, colorId);
        if (!enabledKeys.has(key)) disabled.add(key);
      }
    }
    setPickerSizeIds(sizeIds);
    setPickerColorIds(colorIds);
    setPickerDisabledCombos(disabled);
    setWaistMeasurement(product.waistMeasurement ?? '');
    setLengthMeasurement(product.lengthMeasurement ?? '');

    const initial: Record<string, VariantEntry> = {};
    for (const variant of product.variants) {
      initial[comboKey(Number(variant.sizeId), Number(variant.colorId))] = {
        quantity: '',
        unitCost: product.cost ?? '',
      };
    }
    setVariantEntries(initial);
  }

  function clearProductSelection() {
    setSelectedProduct(null);
    setVariantEntries({});
    setPickerSizeIds(new Set());
    setPickerColorIds(new Set());
    setPickerDisabledCombos(new Set());
    setWaistMeasurement('');
    setLengthMeasurement('');
  }

  async function handleSaveMeasurements() {
    if (!selectedProduct) return;
    setSavingMeasurements(true);
    try {
      const updated = await updateProduct(String(selectedProduct.id), {
        waistMeasurement: waistMeasurement.trim() ? Number(waistMeasurement) : null,
        lengthMeasurement: lengthMeasurement.trim() ? Number(lengthMeasurement) : null,
      });
      setSelectedProduct(updated);
      notify.success('Medidas guardadas.');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudieron guardar las medidas.');
    } finally {
      setSavingMeasurements(false);
    }
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

  const activeCombos = useMemo(
    () => computeActiveVariants(pickerSizeIds, pickerColorIds, pickerDisabledCombos),
    [pickerSizeIds, pickerColorIds, pickerDisabledCombos],
  );

  function sizeName(id: number): string {
    return sizes.find((s) => Number(s.id) === id)?.name ?? '';
  }
  function colorName(id: number): string {
    return colors.find((c) => Number(c.id) === id)?.name ?? '';
  }

  async function addSelectedVariantsToCart() {
    if (!selectedProduct) return;
    const newLines: CartLine[] = [];
    const combosToDeclare: { sizeId: number; colorId: number }[] = [];
    for (const { sizeId, colorId } of activeCombos) {
      const key = comboKey(sizeId, colorId);
      const entry = variantEntries[key];
      const quantity = Number(entry?.quantity);
      const unitCost = Number(entry?.unitCost);
      if (!entry || !quantity || quantity <= 0 || Number.isNaN(unitCost) || unitCost < 0) continue;

      combosToDeclare.push({ sizeId, colorId });
      newLines.push({
        key: `${selectedProduct.id}-${key}`,
        productId: Number(selectedProduct.id),
        productName: selectedProduct.name,
        productCode: selectedProduct.code,
        sizeId,
        sizeName: sizeName(sizeId),
        colorId,
        colorName: colorName(colorId),
        quantity,
        unitCost,
      });
    }

    if (newLines.length === 0) {
      notify.error('Ingresa cantidad y costo para al menos una combinación.');
      return;
    }

    setAddingToCart(true);
    try {
      // No destructivo: solo agrega/reactiva estas combinaciones en el
      // producto, sin desactivar ninguna de compras anteriores.
      await addProductVariants(String(selectedProduct.id), combosToDeclare);
    } catch (error) {
      notify.error(
        error instanceof ApiError ? error.message : 'No se pudieron guardar las combinaciones.',
      );
      setAddingToCart(false);
      return;
    }
    setAddingToCart(false);

    setCart((prev) => {
      const map = new Map(prev.map((line) => [line.key, line]));
      for (const line of newLines) map.set(line.key, line);
      return [...map.values()];
    });
    clearProductSelection();
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
      const shippingCostNumber = Number(shippingCost);
      const created = await createPurchase({
        supplierId: Number(supplierId),
        paymentMethodId: Number(paymentMethodId),
        notes: notes.trim() || undefined,
        shippingCost:
          shippingCost.trim() && shippingCostNumber > 0 ? shippingCostNumber : undefined,
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
              <p className="purchase-form__recommended">
                Precio recomendado:{' '}
                <strong>{newProductRecommended ? `Q${newProductRecommended}` : '—'}</strong>
              </p>

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
                onSizeCreated={(size) => setSizes((prev) => [...prev, size])}
                onColorCreated={(color) => setColors((prev) => [...prev, color])}
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
            {selectedProduct.code} · Marca las tallas y colores que trae esta factura — puedes
            agregar combinaciones que el producto nunca había manejado.
          </p>

          <div className="purchase-form__measurements">
            <p className="purchase-form__measurements-label">
              Medidas (opcional) — sobre todo en pantalones
            </p>
            <div className="purchase-form__row">
              <Input
                label="Cintura (cm)"
                type="number"
                min="0"
                step="0.1"
                value={waistMeasurement}
                onChange={(event) => setWaistMeasurement(event.target.value)}
              />
              <Input
                label="Largo (cm)"
                type="number"
                min="0"
                step="0.1"
                value={lengthMeasurement}
                onChange={(event) => setLengthMeasurement(event.target.value)}
              />
            </div>
            <div className="purchase-form__inline-actions">
              <Button
                type="button"
                variant="ghost"
                loading={savingMeasurements}
                onClick={() => void handleSaveMeasurements()}
              >
                Guardar medidas
              </Button>
            </div>
          </div>

          <SizeColorPicker
            sizes={sizes}
            colors={colors}
            selectedSizeIds={pickerSizeIds}
            selectedColorIds={pickerColorIds}
            disabledCombos={pickerDisabledCombos}
            onToggleSize={(sizeId) =>
              setPickerSizeIds((prev) => {
                const next = new Set(prev);
                if (next.has(sizeId)) next.delete(sizeId);
                else next.add(sizeId);
                return next;
              })
            }
            onToggleColor={(colorId) =>
              setPickerColorIds((prev) => {
                const next = new Set(prev);
                if (next.has(colorId)) next.delete(colorId);
                else next.add(colorId);
                return next;
              })
            }
            onSizeCreated={(size) => setSizes((prev) => [...prev, size])}
            onColorCreated={(color) => setColors((prev) => [...prev, color])}
            onToggleCombo={(sizeId, colorId) => {
              const key = comboKey(sizeId, colorId);
              setPickerDisabledCombos((prev) => {
                const next = new Set(prev);
                if (next.has(key)) next.delete(key);
                else next.add(key);
                return next;
              });
            }}
          />

          {activeCombos.length === 0 ? (
            <p className="purchase-form__hint">
              Marca al menos una talla y un color arriba para ingresar cantidad y costo.
            </p>
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
                {activeCombos.map(({ sizeId, colorId }) => {
                  const key = comboKey(sizeId, colorId);
                  const entry = variantEntries[key] ?? { quantity: '', unitCost: selectedProduct.cost ?? '' };
                  return (
                    <tr key={key}>
                      <td>
                        {sizeName(sizeId)} / {colorName(colorId)}
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
            <Button type="button" variant="ghost" onClick={clearProductSelection}>
              Cancelar
            </Button>
            <Button type="button" loading={addingToCart} onClick={() => void addSelectedVariantsToCart()}>
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
                        {line.sizeName} / {line.colorName} → {line.quantity} × {formatMoney(line.unitCost)}
                      </span>
                      <span className="purchase-form__line-right">
                        {formatMoney(line.quantity * line.unitCost)}
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
                <p className="purchase-form__group-subtotal">Subtotal: {formatMoney(groupSubtotal)}</p>
              </div>
            );
          })}

          <div className="field purchase-form__shipping">
            <label className="field__label" htmlFor="purchase-shipping-cost">
              Costo de transporte (opcional)
            </label>
            <input
              id="purchase-shipping-cost"
              className="field__input"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={shippingCost}
              onChange={(event) => setShippingCost(event.target.value)}
            />
          </div>

          {Number(shippingCost) > 0 ? (
            <p className="purchase-form__subtotal-hint">
              Mercadería {formatMoney(total)} + transporte {formatMoney(Number(shippingCost))}
            </p>
          ) : null}
          <p className="purchase-form__total">
            Total: <strong>{formatMoney(total + (Number(shippingCost) || 0))}</strong>
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
