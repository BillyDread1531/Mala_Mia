import { Link } from 'react-router-dom';
import { ExpensesIcon, InventoryIcon, PurchasesIcon, SalesIcon } from '../../components/icons';
import { useNotify } from '../../notifications/useNotify';
import './QuickActions.css';

const ACTIONS = [
  { label: 'Ventas', icon: SalesIcon, to: '/ventas' },
  { label: 'Agregar producto', icon: InventoryIcon, to: '/inventario/nuevo' },
  { label: 'Registrar gasto', icon: ExpensesIcon, to: '/finanzas/gastos/nuevo' },
  { label: 'Registrar compra', icon: PurchasesIcon, to: '/compras/nueva' },
];

export function QuickActions() {
  const notify = useNotify();

  return (
    <div className="quick-actions">
      {ACTIONS.map((action) =>
        action.to ? (
          <Link key={action.label} to={action.to} className="quick-actions__item">
            <action.icon className="quick-actions__icon" />
            <span>{action.label}</span>
          </Link>
        ) : (
          <button
            key={action.label}
            type="button"
            className="quick-actions__item"
            onClick={() => notify.info(`"${action.label}" estará disponible próximamente.`)}
          >
            <action.icon className="quick-actions__icon" />
            <span>{action.label}</span>
          </button>
        ),
      )}
    </div>
  );
}
