import { NavLink } from 'react-router-dom';
import { PlusIcon } from '../components/icons';
import { MOBILE_NAV } from './nav-items';
import './MobileNavigation.css';

export function MobileNavigation() {
  return (
    <nav className="mobile-nav" aria-label="Navegación principal">
      <div className="mobile-nav__side">
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
      </div>

      <NavLink to="/ventas/nueva" className="mobile-nav__quick-action" aria-label="Nueva venta">
        <PlusIcon />
      </NavLink>

      <div className="mobile-nav__side">
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
      </div>
    </nav>
  );
}
