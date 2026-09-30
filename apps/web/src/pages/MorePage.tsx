import { LogoutIcon } from '../components/icons';
import { useAuth } from '../auth/useAuth';
import { useNotify } from '../notifications/useNotify';
import { MORE_ENTRIES } from '../layouts/nav-items';
import './MorePage.css';

export function MorePage() {
  const { logout } = useAuth();
  const notify = useNotify();

  async function handleLogout() {
    try {
      await logout();
    } catch {
      notify.error('No se pudo cerrar sesión. Intenta de nuevo.');
    }
  }

  return (
    <div className="more-page">
      {MORE_ENTRIES.map((entry) => (
        <button
          key={entry.label}
          type="button"
          className="more-page__item"
          onClick={() => notify.info(`"${entry.label}" estará disponible próximamente.`)}
        >
          <strong>{entry.label}</strong>
          <span>{entry.description}</span>
        </button>
      ))}

      <button type="button" className="more-page__logout" onClick={handleLogout}>
        <LogoutIcon /> Cerrar sesión
      </button>
    </div>
  );
}
