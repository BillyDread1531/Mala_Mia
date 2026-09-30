import { Link } from 'react-router-dom';
import { Heart } from './Heart';
import { DesktopNavigation } from '../layouts/DesktopNavigation';
import { UserMenu } from '../layouts/UserMenu';
import { DESKTOP_NAV, TABLET_NAV } from '../layouts/nav-items';
import type { Breakpoint } from '../hooks/useBreakpoint';
import './AppHeader.css';

interface AppHeaderProps {
  breakpoint: Breakpoint;
}

export function AppHeader({ breakpoint }: AppHeaderProps) {
  return (
    <header className="app-header">
      <Link to="/" className="app-header__brand">
        <Heart size={26} />
        <span>MALA MÍA</span>
      </Link>

      {breakpoint !== 'mobile' ? (
        <DesktopNavigation items={breakpoint === 'tablet' ? TABLET_NAV : DESKTOP_NAV} />
      ) : null}

      <div className="app-header__actions">
        <UserMenu />
      </div>
    </header>
  );
}
