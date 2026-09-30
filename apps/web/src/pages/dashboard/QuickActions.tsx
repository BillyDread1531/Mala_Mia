import { ExpensesIcon, InventoryIcon, PurchasesIcon, SalesIcon } from '../../components/icons';
import { useNotify } from '../../notifications/useNotify';
import './QuickActions.css';

const ACTIONS = [
  { label: 'Nueva venta', icon: SalesIcon },
  { label: 'Agregar producto', icon: InventoryIcon },
  { label: 'Registrar gasto', icon: ExpensesIcon },
  { label: 'Registrar compra', icon: PurchasesIcon },
];

export function QuickActions() {
  const notify = useNotify();

  return (
    <div className="quick-actions">
      {ACTIONS.map((action) => (
        <button
          key={action.label}
          type="button"
          className="quick-actions__item"
          onClick={() => notify.info(`"${action.label}" estará disponible próximamente.`)}
        >
          <action.icon className="quick-actions__icon" />
          <span>{action.label}</span>
        </button>
      ))}
    </div>
  );
}
