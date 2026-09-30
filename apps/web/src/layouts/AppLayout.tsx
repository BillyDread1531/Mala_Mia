import { Outlet } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { useBreakpoint } from '../hooks/useBreakpoint';
import { MobileNavigation } from './MobileNavigation';
import './AppLayout.css';

export function AppLayout() {
  const breakpoint = useBreakpoint();

  return (
    <div className="app-layout">
      <AppHeader breakpoint={breakpoint} />
      <main className={`app-layout__content${breakpoint === 'mobile' ? ' has-mobile-nav' : ''}`}>
        <div className="app-layout__inner">
          <Outlet />
        </div>
      </main>
      {breakpoint === 'mobile' ? <MobileNavigation /> : null}
    </div>
  );
}
