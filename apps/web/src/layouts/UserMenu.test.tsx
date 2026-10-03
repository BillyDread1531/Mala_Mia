import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthContext } from '../auth/auth-context';
import { NotificationProvider } from '../notifications/NotificationContext';
import { UserMenu } from './UserMenu';

function renderMenu() {
  return render(
    <AuthContext.Provider
      value={{
        status: 'authenticated',
        user: { id: '1', username: 'andrea', fullName: 'Andrea', role: 'ADMIN' },
        login: vi.fn(),
        logout: vi.fn(),
      }}
    >
      <NotificationProvider>
        <MemoryRouter>
          <UserMenu />
        </MemoryRouter>
      </NotificationProvider>
    </AuthContext.Provider>,
  );
}

describe('UserMenu', () => {
  it('todas las opciones del menú navegan a su propia pantalla', async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole('button', { name: /Andrea/ }));

    expect(screen.getByRole('menuitem', { name: 'Finanzas' })).toHaveAttribute(
      'href',
      '/finanzas',
    );
    expect(screen.getByRole('menuitem', { name: 'Reportes' })).toHaveAttribute(
      'href',
      '/finanzas/reportes',
    );
    expect(screen.getByRole('menuitem', { name: 'Configuración' })).toHaveAttribute(
      'href',
      '/configuracion',
    );
    expect(screen.getByRole('menuitem', { name: 'Proveedores' })).toHaveAttribute(
      'href',
      '/proveedores',
    );
    expect(screen.getByRole('menuitem', { name: 'Comprobantes' })).toHaveAttribute(
      'href',
      '/comprobantes',
    );
    expect(screen.getByRole('menuitem', { name: 'Actividad' })).toHaveAttribute(
      'href',
      '/actividad',
    );
  });

  it('el interruptor de modo oscuro cambia el tema y lo persiste', async () => {
    const user = userEvent.setup();
    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('mala-mia-theme');
    renderMenu();

    await user.click(screen.getByRole('button', { name: /Andrea/ }));
    const toggle = screen.getByRole('switch', { name: 'Modo oscuro' });
    expect(toggle).not.toBeChecked();

    await user.click(toggle);

    expect(toggle).toBeChecked();
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('mala-mia-theme')).toBe('dark');

    document.documentElement.removeAttribute('data-theme');
    localStorage.removeItem('mala-mia-theme');
  });
});
