import { useState } from 'react';
import { createColor, createSize } from '../../api/catalog';
import { ApiError } from '../../api/client';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { useNotify } from '../../notifications/useNotify';
import type { Color, Size } from '../../types/catalog';
import { comboKey } from './variantCombo';
import './SizeColorPicker.css';

export interface SizeColorPickerProps {
  sizes: Size[];
  colors: Color[];
  selectedSizeIds: Set<number>;
  selectedColorIds: Set<number>;
  disabledCombos: Set<string>;
  onToggleSize: (sizeId: number) => void;
  onToggleColor: (colorId: number) => void;
  onToggleCombo: (sizeId: number, colorId: number) => void;
  /** Avisa al padre de una talla/color recién creada para que la agregue a
   * su propia lista de catálogo (compartida entre varios pickers en la
   * misma pantalla, ej. Compras tiene dos). */
  onSizeCreated?: (size: Size) => void;
  onColorCreated?: (color: Color) => void;
}

/** Selector compacto de tallas/colores + rejilla de combinaciones (por
 * excepción: todo lo que cruza queda activo salvo lo que se desmarque).
 * Incluye "+ Nueva talla"/"+ Nuevo color" para no tener que salir a
 * Configuración cada vez — disponible en cualquier pantalla que use este
 * picker (Productos, Compras). */
export function SizeColorPicker({
  sizes,
  colors,
  selectedSizeIds,
  selectedColorIds,
  disabledCombos,
  onToggleSize,
  onToggleColor,
  onToggleCombo,
  onSizeCreated,
  onColorCreated,
}: SizeColorPickerProps) {
  const notify = useNotify();
  const [colorQuery, setColorQuery] = useState('');

  const [showNewSize, setShowNewSize] = useState(false);
  const [newSizeName, setNewSizeName] = useState('');
  const [creatingSize, setCreatingSize] = useState(false);
  const [showNewColor, setShowNewColor] = useState(false);
  const [newColorName, setNewColorName] = useState('');
  const [creatingColor, setCreatingColor] = useState(false);

  async function handleCreateSize() {
    if (!newSizeName.trim()) return;
    setCreatingSize(true);
    try {
      const size = await createSize(newSizeName.trim());
      onSizeCreated?.(size);
      onToggleSize(Number(size.id));
      setShowNewSize(false);
      setNewSizeName('');
      notify.success('Talla agregada.');
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
      onColorCreated?.(color);
      onToggleColor(Number(color.id));
      setShowNewColor(false);
      setNewColorName('');
      notify.success('Color agregado.');
    } catch (error) {
      notify.error(error instanceof ApiError ? error.message : 'No se pudo crear el color.');
    } finally {
      setCreatingColor(false);
    }
  }

  // Buscador siempre visible: con 5 colores no estorba, y con 50 o 100 es
  // la diferencia entre escribir dos letras o desplazarse por una pared de
  // chips. Los ya marcados se quedan visibles aunque no calcen con la
  // búsqueda, para no "perder de vista" lo elegido mientras se sigue
  // buscando.
  const normalizedQuery = colorQuery.trim().toLowerCase();
  const visibleColors = normalizedQuery
    ? colors.filter(
        (color) =>
          selectedColorIds.has(Number(color.id)) ||
          color.name.toLowerCase().includes(normalizedQuery),
      )
    : colors;

  return (
    <div className="size-color-picker">
      <div className="size-color-picker__header">
        <Button type="button" variant="ghost" onClick={() => setShowNewSize((v) => !v)}>
          + Nueva talla
        </Button>
        <Button type="button" variant="ghost" onClick={() => setShowNewColor((v) => !v)}>
          + Nuevo color
        </Button>
      </div>

      {showNewSize ? (
        <div className="size-color-picker__inline-create">
          <Input
            label="Nombre de la talla"
            value={newSizeName}
            onChange={(event) => setNewSizeName(event.target.value)}
            autoFocus
          />
          <div className="size-color-picker__inline-actions">
            <Button type="button" variant="ghost" onClick={() => setShowNewSize(false)}>
              Cancelar
            </Button>
            <Button type="button" loading={creatingSize} onClick={() => void handleCreateSize()}>
              Agregar talla
            </Button>
          </div>
        </div>
      ) : null}
      {showNewColor ? (
        <div className="size-color-picker__inline-create">
          <Input
            label="Nombre del color"
            placeholder="Ej. Verde musgo"
            value={newColorName}
            onChange={(event) => setNewColorName(event.target.value)}
            autoFocus
          />
          <div className="size-color-picker__inline-actions">
            <Button type="button" variant="ghost" onClick={() => setShowNewColor(false)}>
              Cancelar
            </Button>
            <Button type="button" loading={creatingColor} onClick={() => void handleCreateColor()}>
              Agregar color
            </Button>
          </div>
        </div>
      ) : null}

      <div className="product-form__chips">
        {sizes.map((size) => (
          <button
            key={size.id}
            type="button"
            className={`chip${selectedSizeIds.has(Number(size.id)) ? ' is-active' : ''}`}
            onClick={() => onToggleSize(Number(size.id))}
          >
            {size.name}
          </button>
        ))}
      </div>

      <input
        type="text"
        className="field__input size-color-picker__search"
        placeholder="Buscar color…"
        value={colorQuery}
        onChange={(event) => setColorQuery(event.target.value)}
        aria-label="Buscar color"
      />

      <div className="product-form__chips">
        {visibleColors.map((color) => (
          <button
            key={color.id}
            type="button"
            className={`chip${selectedColorIds.has(Number(color.id)) ? ' is-active' : ''}`}
            onClick={() => onToggleColor(Number(color.id))}
          >
            {color.name}
          </button>
        ))}
        {visibleColors.length === 0 ? (
          <p className="size-color-picker__hint">Sin colores que coincidan con "{colorQuery}".</p>
        ) : null}
      </div>

      {selectedSizeIds.size > 0 && selectedColorIds.size > 0 ? (
        <div className="product-form__combinations">
          <p className="size-color-picker__hint">Desmarca las combinaciones que no manejas:</p>
          {[...selectedSizeIds].map((sizeId) => {
            const sizeName = sizes.find((s) => Number(s.id) === sizeId)?.name ?? '';
            return (
              <div key={sizeId} className="product-form__combo-row">
                <span className="product-form__combo-label">{sizeName}</span>
                <div className="product-form__chips">
                  {[...selectedColorIds].map((colorId) => {
                    const colorName = colors.find((c) => Number(c.id) === colorId)?.name ?? '';
                    const active = !disabledCombos.has(comboKey(sizeId, colorId));
                    return (
                      <button
                        key={colorId}
                        type="button"
                        className={`chip chip--sm${active ? ' is-active' : ' is-disabled'}`}
                        onClick={() => onToggleCombo(sizeId, colorId)}
                      >
                        {colorName}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
