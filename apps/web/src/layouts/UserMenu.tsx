import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDownIcon, LogoutIcon } from '../components/icons';
import { useAuth } from '../auth/useAuth';
import { useNotify } from '../notifications/useNotify';
import { applyTheme, getStoredTheme } from '../theme/theme';
import { MORE_ENTRIES } from './nav-items';
import { NotificationBell } from './NotificationBell';
import './UserMenu.css';

export function UserMenu() {
  const { user, logout } = useAuth();
  const notify = useNotify();
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => getStoredTheme() === 'dark');
  const menuRef = useRef<HTMLDivElement>(null);

  function handleToggleTheme() {
    const next = isDark ? 'light' : 'dark';
    applyTheme(next);
    setIsDark(next === 'dark');
  }

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    try {
      await logout();
    } catch {
      notify.error('No se pudo cerrar sesión. Intenta de nuevo.');
    }
  }

  return (
    <div className="user-menu">
      <NotificationBell />

      <div className="user-menu__dropdown" ref={menuRef}>
        <button
          type="button"
          className="user-menu__trigger"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          <span className="user-menu__avatar">{user?.fullName.charAt(0) ?? '?'}</span>
          <span className="user-menu__name">{user?.fullName}</span>
          <ChevronDownIcon />
        </button>

        {open ? (
          <div className="user-menu__panel" role="menu">
            <div className="user-menu__header">
              <strong>{user?.fullName}</strong>
              <span>{user?.role === 'ADMIN' ? 'Administrador' : user?.role}</span>
            </div>

            <div className="user-menu__section">
              {MORE_ENTRIES.map((entry) =>
                entry.to ? (
                  <Link
                    key={entry.label}
                    to={entry.to}
                    role="menuitem"
                    className="user-menu__item"
                    onClick={() => setOpen(false)}
                  >
                    {entry.label}
                  </Link>
                ) : (
                  <button
                    key={entry.label}
                    type="button"
                    role="menuitem"
                    className="user-menu__item"
                    onClick={() => {
                      setOpen(false);
                      notify.info(`"${entry.label}" estará disponible próximamente.`);
                    }}
                  >
                    {entry.label}
                  </button>
                ),
              )}
            </div>

            <label className="user-menu__theme-toggle">
              Modo oscuro
              <input
                type="checkbox"
                role="switch"
                aria-checked={isDark}
                checked={isDark}
                onChange={handleToggleTheme}
              />
            </label>

            <button
              type="button"
              role="menuitem"
              className="user-menu__item user-menu__item--danger"
              onClick={handleLogout}
            >
              <LogoutIcon /> Cerrar sesión
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
