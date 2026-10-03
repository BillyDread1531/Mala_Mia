export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mala-mia-theme';

export function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // localStorage puede no estar disponible (ej. navegación privada).
  }
  return 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Si no se puede persistir, el tema solo dura la sesión actual.
  }
}
