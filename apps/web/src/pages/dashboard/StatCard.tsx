import { Card } from '../../components/Card';
import './StatCard.css';

interface StatCardProps {
  label: string;
  hint?: string;
}

/**
 * Sin datos reales todavía (Fase 3 es solo estructura visual). El "—"
 * es deliberado para no simular una cifra real como haría un "0".
 */
export function StatCard({ label, hint }: StatCardProps) {
  return (
    <Card className="stat-card">
      <span className="stat-card__label">{label}</span>
      <span className="stat-card__value">—</span>
      {hint ? <span className="stat-card__hint">{hint}</span> : null}
    </Card>
  );
}
