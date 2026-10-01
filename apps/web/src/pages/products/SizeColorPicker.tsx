import type { Color, Size } from '../../types/catalog';
import { comboKey } from './variantCombo';
import './SizeColorPicker.css';

interface SizeColorPickerProps {
  sizes: Size[];
  colors: Color[];
  selectedSizeIds: Set<number>;
  selectedColorIds: Set<number>;
  disabledCombos: Set<string>;
  onToggleSize: (sizeId: number) => void;
  onToggleColor: (colorId: number) => void;
  onToggleCombo: (sizeId: number, colorId: number) => void;
}

/** Selector compacto de tallas/colores + rejilla de combinaciones (por
 * excepción: todo lo que cruza queda activo salvo lo que se desmarque). */
export function SizeColorPicker({
  sizes,
  colors,
  selectedSizeIds,
  selectedColorIds,
  disabledCombos,
  onToggleSize,
  onToggleColor,
  onToggleCombo,
}: SizeColorPickerProps) {
  return (
    <div className="size-color-picker">
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

      <div className="product-form__chips">
        {colors.map((color) => (
          <button
            key={color.id}
            type="button"
            className={`chip${selectedColorIds.has(Number(color.id)) ? ' is-active' : ''}`}
            onClick={() => onToggleColor(Number(color.id))}
          >
            {color.name}
          </button>
        ))}
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
