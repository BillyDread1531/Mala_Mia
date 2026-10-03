import './RankedBars.css';

export interface RankedBarItem {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
}

interface RankedBarsProps {
  items: RankedBarItem[];
  formatValue?: (value: number) => string;
}

/** Barras horizontales simples (div + ancho %) para rankings cortos:
 * productos más vendidos, ventas por método de pago, compras por proveedor.
 * Más legible que una dona para 3-10 elementos y cero dependencias nuevas. */
export function RankedBars({ items, formatValue = String }: RankedBarsProps) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.value), 1);

  return (
    <div className="ranked-bars">
      {items.map((item) => (
        <div key={item.key} className="ranked-bars__row">
          <div className="ranked-bars__info">
            <span className="ranked-bars__label">{item.label}</span>
            {item.sublabel ? (
              <span className="ranked-bars__sublabel">{item.sublabel}</span>
            ) : null}
          </div>
          <div className="ranked-bars__track">
            <div
              className="ranked-bars__fill"
              style={{ width: `${Math.max((item.value / max) * 100, 4)}%` }}
            />
          </div>
          <span className="ranked-bars__value">{formatValue(item.value)}</span>
        </div>
      ))}
    </div>
  );
}
