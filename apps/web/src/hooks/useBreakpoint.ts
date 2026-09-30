import { useEffect, useState } from 'react';

export type Breakpoint = 'mobile' | 'tablet' | 'desktop';

const TABLET_QUERY = '(min-width: 768px)';
const DESKTOP_QUERY = '(min-width: 1024px)';

function computeBreakpoint(): Breakpoint {
  if (typeof window === 'undefined') return 'desktop';
  if (window.matchMedia(DESKTOP_QUERY).matches) return 'desktop';
  if (window.matchMedia(TABLET_QUERY).matches) return 'tablet';
  return 'mobile';
}

/** Móvil < 768px, tablet 768–1023px, desktop ≥1024px (CONTEXT.md #4). */
export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(computeBreakpoint);

  useEffect(() => {
    const tabletQuery = window.matchMedia(TABLET_QUERY);
    const desktopQuery = window.matchMedia(DESKTOP_QUERY);
    const update = () => setBreakpoint(computeBreakpoint());

    tabletQuery.addEventListener('change', update);
    desktopQuery.addEventListener('change', update);
    return () => {
      tabletQuery.removeEventListener('change', update);
      desktopQuery.removeEventListener('change', update);
    };
  }, []);

  return breakpoint;
}
