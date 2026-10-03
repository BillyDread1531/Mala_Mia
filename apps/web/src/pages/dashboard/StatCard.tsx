import { Card } from '../../components/Card';
import './StatCard.css';

interface StatCardProps {
  label: string;
  value?: string;
  hint?: string;
  loading?: boolean;
  error?: boolean;
}

export function StatCard({ label, value, hint, loading = false, error = false }: StatCardProps) {
  return (
    <Card className="stat-card">
      <span className="stat-card__label">{label}</span>
      {loading ? (
        <span className="stat-card__skeleton" aria-hidden="true" />
      ) : (
        <span className="stat-card__value">{error ? '—' : (value ?? '—')}</span>
      )}
      {!loading && hint ? (
        <span className={`stat-card__hint${error ? ' stat-card__hint--error' : ''}`}>{hint}</span>
      ) : null}
    </Card>
  );
}
