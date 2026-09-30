import { NavLink } from 'react-router-dom';
import { PlusIcon } from '../components/icons';
import { useNotify } from '../notifications/useNotify';
import { MOBILE_NAV } from './nav-items';
import './MobileNavigation.css';

export function MobileNavigation() {
  const notify = useNotify();

  return (
    <nav className="mobile-nav" aria-label="Navegación principal">
      {MOBILE_NAV.slice(0, 2).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `mobile-nav__item${isActive ? ' is-active' : ''}`}
        >
          <item.icon />
          <span>{item.label}</span>
        </NavLink>
      ))}

      <button
        type="button"
        className="mobile-nav__quick-action"
        aria-label="Acción rápida"
        onClick={() => notify.info('Esta acción estará disponible próximamente.')}
      >
        <PlusIcon />
      </button>

      {MOBILE_NAV.slice(2).map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => `mobile-nav__item${isActive ? ' is-active' : ''}`}
        >
          <item.icon />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
