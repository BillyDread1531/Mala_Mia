import './BarChart.css';

export interface BarChartPoint {
  label: string;
  value: number;
}

interface BarChartProps {
  data: BarChartPoint[];
  formatValue?: (value: number) => string;
}

const HEIGHT = 140;
const BAR_GAP = 8;

/** Gráfico de barras minimalista en SVG puro: evita instalar una librería de
 * gráficos para un solo caso de uso (ventas por día). Sin dependencias
 * nuevas, igual que el comprobante en Canvas de la Fase 12. */
export function BarChart({ data, formatValue = String }: BarChartProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => d.value), 1);
  const barWidth = 100 / data.length;

  return (
    <div className="bar-chart">
      <svg
        className="bar-chart__svg"
        viewBox={`0 0 100 ${HEIGHT}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Gráfico de barras"
      >
        {data.map((point, index) => {
          const barHeight = (point.value / max) * (HEIGHT - 24);
          const x = index * barWidth + BAR_GAP / 4;
          const width = barWidth - BAR_GAP / 2;
          return (
            <rect
              key={point.label}
              x={x}
              y={HEIGHT - 20 - barHeight}
              width={Math.max(width, 1)}
              height={Math.max(barHeight, 1)}
              rx="2"
              className="bar-chart__bar"
            />
          );
        })}
      </svg>
      <div className="bar-chart__labels">
        {data.map((point) => (
          <div key={point.label} className="bar-chart__label-col">
            <span className="bar-chart__value">{formatValue(point.value)}</span>
            <span className="bar-chart__label">{point.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
