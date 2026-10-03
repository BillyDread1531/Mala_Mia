import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const STORAGE_KEY = 'mala-mia-last-route';

/** En móvil, cuando el sistema operativo mata el proceso de la PWA en
 * segundo plano (frecuente en iOS y en Android con poca memoria), reabrirla
 * desde el ícono es un arranque en frío que el navegador siempre manda a
 * `start_url` ("/") — sin importar en qué pantalla estaba la persona. Esto
 * recuerda la última ruta visitada y, si el primer montaje de esta carga cae
 * justo en "/", la restaura. Solo se intenta una vez por carga (no en cada
 * navegación a "/"), así un click real en "Inicio" después sigue llevando
 * a "/" con normalidad. */
let hasAttemptedRestore = false;

export function useRouteMemory(): void {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (hasAttemptedRestore) return;
    hasAttemptedRestore = true;
    if (location.pathname !== '/') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored !== '/' && stored !== '/login') {
        navigate(stored, { replace: true });
      }
    } catch {
      // Sin localStorage disponible, simplemente no se restaura nada.
    }
    // Se ejecuta a propósito una sola vez por carga de la app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, location.pathname + location.search);
    } catch {
      // Si no se puede persistir, solo se pierde el "recordar" entre sesiones.
    }
  }, [location.pathname, location.search]);
}
