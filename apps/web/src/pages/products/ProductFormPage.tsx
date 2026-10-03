import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listCategories, listColors, listSizes } from '../../api/catalog';
import { ApiError } from '../../api/client';
import { adjustInventoryVariant, listGroupedInventory } from '../../api/inventory';
import {
  checkDuplicates,
  createProduct,
  generateCode,
  getProduct,
  previewRecommendedPrice,
  setProductActive,
  updateProduct,
} from '../../api/products';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { useNotify } from '../../notifications/useNotify';
import type { Category, Color, Size } from '../../types/catalog';
import { ADJUSTMENT_REASONS } from '../../types/inventory';
import type { Product } from '../../types/product';
import { SizeColorPicker } from './SizeColorPicker';
import { comboKey, computeActiveVariants } from './variantCombo';
import './ProductFormPage.css';

const RECOMMENDED_PRICE_DEBOUNCE_MS = 300;
const CODE_PREVIEW_DEBOUNCE_MS = 300;

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const navigate = useNavigate();
  const notify = useNotify();

  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [sizes, setSizes] = useState<Size[]>([]);
  const [colors, setColors] = useState<Color[]>([]);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [code, setCode] = useState('');
  const [codeTouched, setCodeTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [waistMeasurement, setWaistMeasurement] = useState('');
  const [lengthMeasurement, setLengthMeasurement] = useState('');
  const [fetchedRecommendedPrice, setFetchedRecommendedPrice] = useState<string | null>(null);

  const [selectedSizeIds, setSelectedSizeIds] = useState<Set<number>>(new Set());
  const [selectedColorIds, setSelectedColorIds] = useState<Set<number>>(new Set());
  const [disabledCombos, setDisabledCombos] = useState<Set<string>>(new Set());
  // Solo al crear: cada combinación es nueva, así que la cantidad ingresada
  // es inequívocamente el stock inicial (en edición sería ambiguo, porque
  // ajustar una combinación ya existente suma en vez de fijar el total).
  const [initialQuantities, setInitialQuantities] = useState<Record<string, string>>({});

  // Solo al editar: existencias actuales de las combinaciones que el
  // producto ya tenía declaradas al cargar (las que se agreguen en esta
  // misma sesión de edición no tienen stock que ajustar todavía — se hace
  // desde Inventario después de guardar).
  const [existingQuantities, setExistingQuantities] = useState<Record<string, number>>({});
  const [declaredComboKeys, setDeclaredComboKeys] = useState<Set<string>>(new Set());
  const [adjustingKey, setAdjustingKey] = useState<string | null>(null);
  const [adjustQuantityChange, setAdjustQuantityChange] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustingQuantity, setAdjustingQuantity] = useState(false);

  const [nameError, setNameError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Product[]>([]);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);
  const [isAvailableForSale, setIsAvailableForSale] = useState(true);
  const [togglingActive, setTogglingActive] = useState(false);

  // Catálogos base (siempre necesarios para el formulario).
  useEffect(() => {
    Promise.all([listCategories(), listSizes(), listColors()])
      .then(([cats, szs, cols]) => {
        setCategories(cats);
        setSizes(szs);
        setColors(cols);
      })
      .catch(() => notify.error('No se pudieron cargar categorías, tallas o colores.'));
  }, [notify]);

  // Cargar el producto existente en modo edición.
  useEffect(() => {
    if (!id) return;
    Promise.all([getProduct(id), listGroupedInventory({ productId: Number(id) })])
      .then(([product, grouped]) => {
        setName(product.name);
        setCategoryId(Number(product.category.id));
        setCode(product.code);
        setCodeTouched(true);
        setDescription(product.description ?? '');
        setCost(product.cost ?? '');
        setSalePrice(product.salePrice ?? '');
        setWaistMeasurement(product.waistMeasurement ?? '');
        setLengthMeasurement(product.lengthMeasurement ?? '');
        setFetchedRecommendedPrice(product.recommendedPrice);
        setIsAvailableForSale(product.isAvailableForSale);

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
        setSelectedSizeIds(sizeIds);
        setSelectedColorIds(colorIds);
        setDisabledCombos(disabled);
        setDeclaredComboKeys(enabledKeys);

        const quantities: Record<string, number> = {};
        for (const item of grouped) {
          quantities[comboKey(Number(item.sizeId), Number(item.colorId))] = item.quantity;
        }
        setExistingQuantities(quantities);
      })
      .catch(() => notify.error('No se pudo cargar el producto.'))
      .finally(() => setLoading(false));
  }, [id, notify]);

  // Autogenerar código al elegir categoría, solo mientras el usuario no lo
  // haya editado a mano (y solo al crear: en edición el código ya existe).
  useEffect(() => {
    if (isEditMode || codeTouched || categoryId === '') return;
    const timer = setTimeout(() => {
      generateCode(Number(categoryId))
        .then((res) => setCode(res.code))
        .catch(() => undefined);
    }, CODE_PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [categoryId, isEditMode, codeTouched]);

  // Precio recomendado en vivo, según el margen configurado del negocio.
  // El estado solo se actualiza desde la respuesta async; si el costo actual
  // no es válido, se deriva `null` directamente al renderizar (más abajo)
  // en vez de limpiar el estado sincrónicamente dentro del efecto.
  useEffect(() => {
    const costNumber = Number(cost);
    if (cost.trim() === '' || Number.isNaN(costNumber)) return;

    const timer = setTimeout(() => {
      previewRecommendedPrice(costNumber)
        .then((res) => setFetchedRecommendedPrice(res.recommendedPrice))
        .catch(() => undefined);
    }, RECOMMENDED_PRICE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [cost]);

  const recommendedPrice =
    cost.trim() === '' || Number.isNaN(Number(cost)) ? null : fetchedRecommendedPrice;

  const activeVariants = useMemo(
    () => computeActiveVariants(selectedSizeIds, selectedColorIds, disabledCombos),
    [selectedSizeIds, selectedColorIds, disabledCombos],
  );

  // Solo las combinaciones que el producto ya tenía al cargar la pantalla
  // tienen existencias que ajustar; una combinación recién marcada en esta
  // misma edición todavía no existe en el backend hasta guardar.
  const declaredActiveVariants = useMemo(
    () => activeVariants.filter((v) => declaredComboKeys.has(comboKey(v.sizeId, v.colorId))),
    [activeVariants, declaredComboKeys],
  );

  function toggleSize(sizeId: number) {
    setSelectedSizeIds((prev) => {
      const next = new Set(prev);
      if (next.has(sizeId)) next.delete(sizeId);
      else next.add(sizeId);
      return next;
    });
  }

  function toggleColor(colorId: number) {
    setSelectedColorIds((prev) => {
      const next = new Set(prev);
      if (next.has(colorId)) next.delete(colorId);
      else next.add(colorId);
      return next;
    });
  }

  function toggleCombo(sizeId: number, colorId: number) {
    const key = comboKey(sizeId, colorId);
    setDisabledCombos((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function startAdjusting(key: string) {
    setAdjustingKey(key);
    setAdjustQuantityChange('');
    setAdjustReason('');
    setAdjustNotes('');
  }

  function cancelAdjusting() {
    setAdjustingKey(null);
  }

  async function submitAdjustment(sizeId: number, colorId: number) {
    const key = comboKey(sizeId, colorId);
    const delta = Number(adjustQuantityChange);
    if (!delta || Number.isNaN(delta)) {
      notify.error('Ingresa una cantidad distinta de cero.');
      return;
    }
    if (!adjustReason) {
      notify.error('Selecciona un motivo.');
      return;
    }
    if (adjustReason === 'Otro' && !adjustNotes.trim()) {
      notify.error('Explica el motivo cuando selecciones "Otro".');
      return;
    }

    setAdjustingQuantity(true);
    try {
      const updated = await adjustInventoryVariant({
        productId: Number(id),
        sizeId,
        colorId,
        quantityChange: delta,
        reason: adjustReason,
        notes: adjustNotes.trim() || undefined,
      });
      setExistingQuantities((prev) => ({ ...prev, [key]: updated.quantity }));
      notify.success('Existencias actualizadas.');
      setAdjustingKey(null);
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo ajustar el stock.');
    } finally {
      setAdjustingQuantity(false);
    }
  }

  function handleNameBlur() {
    if (isEditMode) return;
    const query = name.trim();
    if (query.length < 2) {
      setDuplicates([]);
      return;
    }
    checkDuplicates(query)
      .then((matches) => {
        setDuplicates(matches);
        setDuplicatesDismissed(false);
      })
      .catch(() => undefined);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedName = name.trim();
    let hasError = false;
    if (trimmedName.length < 2) {
      setNameError('Escribe un nombre de al menos 2 letras.');
      hasError = true;
    } else {
      setNameError(null);
    }
    if (categoryId === '') {
      setCategoryError('Selecciona una categoría.');
      hasError = true;
    } else {
      setCategoryError(null);
    }
    if (hasError) return;

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        categoryId: Number(categoryId),
        code: code.trim() || undefined,
        description: description.trim() || undefined,
        cost: cost.trim() ? Number(cost) : undefined,
        salePrice: salePrice.trim() ? Number(salePrice) : undefined,
        // En edición, un campo vacío borra la medida ya guardada; al crear,
        // simplemente no se manda (no hay nada que borrar todavía).
        waistMeasurement: waistMeasurement.trim()
          ? Number(waistMeasurement)
          : isEditMode
            ? null
            : undefined,
        lengthMeasurement: lengthMeasurement.trim()
          ? Number(lengthMeasurement)
          : isEditMode
            ? null
            : undefined,
        variants: activeVariants,
      };

      if (isEditMode && id) {
        await updateProduct(id, payload);
        notify.success('Producto actualizado.');
      } else {
        const created = await createProduct(payload);
        notify.success('Producto creado.');

        const stockEntries = activeVariants
          .map(({ sizeId, colorId }) => ({
            sizeId,
            colorId,
            quantity: Number(initialQuantities[comboKey(sizeId, colorId)]),
          }))
          .filter((entry) => entry.quantity > 0);

        if (stockEntries.length > 0) {
          try {
            await Promise.all(
              stockEntries.map((entry) =>
                adjustInventoryVariant({
                  productId: Number(created.id),
                  sizeId: entry.sizeId,
                  colorId: entry.colorId,
                  quantityChange: entry.quantity,
                  reason: 'Corrección de inventario',
                  notes: 'Stock inicial al crear el producto.',
                }),
              ),
            );
            notify.success('Existencias iniciales guardadas.');
          } catch (stockError) {
            notify.error(
              stockError instanceof ApiError
                ? stockError.message
                : 'El producto se creó, pero no se pudo guardar el stock inicial. Agrégalo desde Inventario.',
            );
          }
        }
      }
      navigate('/inventario');
    } catch (error) {
      notify.error(
        error instanceof ApiError ? error.message : 'No se pudo guardar el producto.',
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive() {
    if (!id) return;
    const nextActive = !isAvailableForSale;
    if (
      !nextActive &&
      !window.confirm(
        `¿Desactivar "${name}"? Dejará de aparecer para vender o comprar, pero su historial se conserva.`,
      )
    ) {
      return;
    }
    setTogglingActive(true);
    try {
      const updated = await setProductActive(id, nextActive);
      setIsAvailableForSale(updated.isAvailableForSale);
      notify.success(nextActive ? 'Producto reactivado.' : 'Producto desactivado.');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo actualizar el estado.');
    } finally {
      setTogglingActive(false);
    }
  }

  if (loading) {
    return <Loading fullPage label="Cargando producto…" />;
  }

  return (
    <div className="product-form">
      <header className="product-form__header">
        <h1>{isEditMode ? 'Editar producto' : 'Nuevo producto'}</h1>
        {isEditMode ? (
          <Button
            type="button"
            variant={isAvailableForSale ? 'ghost' : 'secondary'}
            loading={togglingActive}
            onClick={() => void handleToggleActive()}
          >
            {isAvailableForSale ? 'Desactivar' : 'Reactivar'}
          </Button>
        ) : null}
      </header>

      {duplicates.length > 0 && !duplicatesDismissed ? (
        <Card className="product-form__duplicates">
          <h2>Producto posiblemente duplicado</h2>
          <p>Ya existe un producto que podría coincidir:</p>
          <ul>
            {duplicates.map((duplicate) => (
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
                  onClick={() => navigate(`/inventario/${duplicate.id}`)}
                >
                  Usar existente
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="ghost" onClick={() => setDuplicatesDismissed(true)}>
            Crear de todas formas
          </Button>
        </Card>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <Card className="product-form__section">
          <Input
            label="Nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onBlur={handleNameBlur}
            error={nameError ?? undefined}
            required
            autoFocus
          />

          <div className="product-form__row">
            <div className="field">
              <label className="field__label" htmlFor="product-category">
                Categoría
              </label>
              <select
                id="product-category"
                className="field__input"
                value={categoryId}
                onChange={(event) =>
                  setCategoryId(event.target.value ? Number(event.target.value) : '')
                }
              >
                <option value="">Selecciona una categoría</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              {categoryError ? <p className="field__error">{categoryError}</p> : null}
            </div>

            <Input
              label="Código"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                setCodeTouched(true);
              }}
              placeholder="Se genera automáticamente"
            />
          </div>

          <div className="field">
            <label className="field__label" htmlFor="product-description">
              Descripción (opcional)
            </label>
            <textarea
              id="product-description"
              className="field__input product-form__textarea"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
            />
          </div>
        </Card>

        <Card className="product-form__section">
          <div className="product-form__row">
            <Input
              label="Costo actual (Q)"
              type="number"
              min="0"
              step="0.01"
              value={cost}
              onChange={(event) => setCost(event.target.value)}
            />
            <Input
              label="Precio de venta (Q)"
              type="number"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(event) => setSalePrice(event.target.value)}
            />
          </div>
          <p className="product-form__recommended">
            Precio recomendado:{' '}
            <strong>{recommendedPrice ? `Q${recommendedPrice}` : '—'}</strong>
            <span> (referencia, puedes usar el precio que prefieras)</span>
          </p>
        </Card>

        <Card className="product-form__section">
          <h2 className="product-form__section-title">Medidas (opcional)</h2>
          <p className="product-form__hint">
            Usadas sobre todo en pantalones y pantalones de conjunto. Déjalas en blanco si no aplican.
          </p>
          <div className="product-form__row">
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
        </Card>

        <Card className="product-form__section">
          <h2 className="product-form__section-title">Tallas y colores</h2>
          <p className="product-form__hint">
            Elige qué tallas y colores maneja este producto.
          </p>

          <SizeColorPicker
            sizes={sizes}
            colors={colors}
            selectedSizeIds={selectedSizeIds}
            selectedColorIds={selectedColorIds}
            disabledCombos={disabledCombos}
            onToggleSize={toggleSize}
            onToggleColor={toggleColor}
            onToggleCombo={toggleCombo}
            onSizeCreated={(size) => setSizes((prev) => [...prev, size])}
            onColorCreated={(color) => setColors((prev) => [...prev, color])}
          />
        </Card>

        {isEditMode && declaredActiveVariants.length > 0 ? (
          <Card className="product-form__section">
            <h2 className="product-form__section-title">Existencias</h2>
            <p className="product-form__hint">
              Ajusta el stock de cada combinación — por una prenda dañada, perdida, un regalo, etc.
              Las combinaciones nuevas que acabas de marcar arriba se ajustan desde Inventario
              después de guardar los cambios.
            </p>
            <ul className="product-form__stock-list">
              {declaredActiveVariants.map(({ sizeId, colorId }) => {
                const key = comboKey(sizeId, colorId);
                const sizeLabel = sizes.find((s) => Number(s.id) === sizeId)?.name ?? '';
                const colorLabel = colors.find((c) => Number(c.id) === colorId)?.name ?? '';
                const quantity = existingQuantities[key] ?? 0;
                const isAdjusting = adjustingKey === key;
                return (
                  <li key={key} className="product-form__stock-row">
                    <div className="product-form__stock-row-main">
                      <span>
                        {sizeLabel} / {colorLabel}
                      </span>
                      <span className="product-form__stock-qty">{quantity} u.</span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => (isAdjusting ? cancelAdjusting() : startAdjusting(key))}
                      >
                        {isAdjusting ? 'Cancelar' : 'Ajustar'}
                      </Button>
                    </div>
                    {isAdjusting ? (
                      <div className="product-form__stock-adjust-form">
                        <div className="field">
                          <label className="field__label" htmlFor={`adjust-qty-${key}`}>
                            Ajuste (ej. -1 o 1)
                          </label>
                          <input
                            id={`adjust-qty-${key}`}
                            className="field__input"
                            type="number"
                            step="1"
                            value={adjustQuantityChange}
                            onChange={(event) => setAdjustQuantityChange(event.target.value)}
                            autoFocus
                          />
                        </div>
                        <div className="field">
                          <label className="field__label" htmlFor={`adjust-reason-${key}`}>
                            Motivo
                          </label>
                          <select
                            id={`adjust-reason-${key}`}
                            className="field__input"
                            value={adjustReason}
                            onChange={(event) => setAdjustReason(event.target.value)}
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
                          <label className="field__label" htmlFor={`adjust-notes-${key}`}>
                            Notas {adjustReason === 'Otro' ? '(obligatorio)' : '(opcional)'}
                          </label>
                          <textarea
                            id={`adjust-notes-${key}`}
                            className="field__input"
                            rows={2}
                            value={adjustNotes}
                            onChange={(event) => setAdjustNotes(event.target.value)}
                          />
                        </div>
                        <div className="product-form__stock-adjust-actions">
                          <Button type="button" variant="ghost" onClick={cancelAdjusting}>
                            Cancelar
                          </Button>
                          <Button
                            type="button"
                            loading={adjustingQuantity}
                            onClick={() => void submitAdjustment(sizeId, colorId)}
                          >
                            Confirmar ajuste
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}

        {!isEditMode && activeVariants.length > 0 ? (
          <Card className="product-form__section">
            <h2 className="product-form__section-title">Cantidad inicial (opcional)</h2>
            <p className="product-form__hint">
              Si ya tienes estas prendas en bodega, ingresa cuántas de cada combinación. Déjalo en
              blanco si vas a comprarlas después — así lo registrarás desde Compras.
            </p>
            <table className="product-form__quantity-table">
              <thead>
                <tr>
                  <th>Combinación</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {activeVariants.map(({ sizeId, colorId }) => {
                  const key = comboKey(sizeId, colorId);
                  const sizeLabel = sizes.find((s) => Number(s.id) === sizeId)?.name ?? '';
                  const colorLabel = colors.find((c) => Number(c.id) === colorId)?.name ?? '';
                  return (
                    <tr key={key}>
                      <td>
                        {sizeLabel} / {colorLabel}
                      </td>
                      <td>
                        <input
                          className="field__input"
                          type="number"
                          min="0"
                          placeholder="0"
                          aria-label={`Cantidad ${sizeLabel} / ${colorLabel}`}
                          value={initialQuantities[key] ?? ''}
                          onChange={(event) =>
                            setInitialQuantities((prev) => ({ ...prev, [key]: event.target.value }))
                          }
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        ) : null}

        <div className="product-form__actions">
          <Button type="button" variant="ghost" onClick={() => navigate('/inventario')}>
            Cancelar
          </Button>
          <Button type="submit" loading={saving}>
            {isEditMode ? 'Guardar cambios' : 'Crear producto'}
          </Button>
        </div>
      </form>
    </div>
  );
}
