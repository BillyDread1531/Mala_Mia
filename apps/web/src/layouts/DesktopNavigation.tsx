import { NavLink } from 'react-router-dom';
import type { NavItem } from './nav-items';
import './DesktopNavigation.css';

interface DesktopNavigationProps {
  items: NavItem[];
}

export function DesktopNavigation({ items }: DesktopNavigationProps) {
  return (
    <nav className="desktop-nav" aria-label="Navegación principal">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          className={({ isActive }) => `desktop-nav__item${isActive ? ' is-active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
