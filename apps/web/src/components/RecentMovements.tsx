import { Link } from 'react-router-dom';
import { formatMoney } from '../lib/money';
import type { FinanceMovement } from '../types/finance';
import { MOVEMENT_TYPE_LABELS } from '../types/finance';
import { Button } from './Button';
import { Card } from './Card';
import './RecentMovements.css';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-GT', { day: '2-digit', month: 'short' });
}

interface RecentMovementsProps {
  movements: FinanceMovement[];
  title?: string;
  emptyLabel?: string;
}

/** Feed de actividad reciente reutilizado por Finanzas y el Dashboard: ambos
 * muestran el mismo libro unificado (`/finance/movements`), solo cambia el
 * título de la tarjeta. */
export function RecentMovements({
  movements,
  title = 'Movimientos recientes',
  emptyLabel = 'Todavía no hay movimientos registrados.',
}: RecentMovementsProps) {
  return (
    <Card className="recent-movements">
      <h2>{title}</h2>
      {movements.length === 0 ? (
        <p className="recent-movements__empty">{emptyLabel}</p>
      ) : (
        <div className="recent-movements__list">
          {movements.map((m) => (
            <div key={m.id} className="recent-movements__row">
              <div className="recent-movements__info">
                <span className="recent-movements__type">
                  {MOVEMENT_TYPE_LABELS[m.movementType] ?? m.movementType}
                </span>
                <span className="recent-movements__description">
                  {m.description} · {formatDate(m.movementDate)}
                </span>
              </div>
              <span
                className={`recent-movements__amount recent-movements__amount--${m.direction.toLowerCase()}`}
              >
                {m.direction === 'IN' ? '+' : '−'} {formatMoney(m.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="recent-movements__footer">
        <Link to="/finanzas/movimientos">
          <Button type="button" variant="ghost">
            Ver todos
          </Button>
        </Link>
      </div>
    </Card>
  );
}
