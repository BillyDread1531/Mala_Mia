import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { listCategories, listColors, listSizes } from '../../api/catalog';
import { ApiError } from '../../api/client';
import {
  checkDuplicates,
  createProduct,
  generateCode,
  getProduct,
  previewRecommendedPrice,
  updateProduct,
} from '../../api/products';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Loading } from '../../components/Loading';
import { useNotify } from '../../notifications/useNotify';
import type { Category, Color, Size } from '../../types/catalog';
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
  const [fetchedRecommendedPrice, setFetchedRecommendedPrice] = useState<string | null>(null);

  const [selectedSizeIds, setSelectedSizeIds] = useState<Set<number>>(new Set());
  const [selectedColorIds, setSelectedColorIds] = useState<Set<number>>(new Set());
  const [disabledCombos, setDisabledCombos] = useState<Set<string>>(new Set());

  const [nameError, setNameError] = useState<string | null>(null);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<Product[]>([]);
  const [duplicatesDismissed, setDuplicatesDismissed] = useState(false);

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
    getProduct(id)
      .then((product) => {
        setName(product.name);
        setCategoryId(Number(product.category.id));
        setCode(product.code);
        setCodeTouched(true);
        setDescription(product.description ?? '');
        setCost(product.cost ?? '');
        setSalePrice(product.salePrice ?? '');
        setFetchedRecommendedPrice(product.recommendedPrice);

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
        variants: activeVariants,
      };

      if (isEditMode && id) {
        await updateProduct(id, payload);
        notify.success('Producto actualizado.');
      } else {
        await createProduct(payload);
        notify.success('Producto creado.');
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

  if (loading) {
    return <Loading fullPage label="Cargando producto…" />;
  }

  return (
    <div className="product-form">
      <header className="product-form__header">
        <h1>{isEditMode ? 'Editar producto' : 'Nuevo producto'}</h1>
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
          />
        </Card>

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
