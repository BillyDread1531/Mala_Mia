import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import { ApiError } from './api/client';
import type { AuthenticatedUser } from './types/user';

vi.mock('./api/auth', () => ({
  login: vi.fn(),
  fetchCurrentUser: vi.fn(),
  logout: vi.fn(),
}));

import { fetchCurrentUser, login, logout } from './api/auth';

const mockedFetchCurrentUser = vi.mocked(fetchCurrentUser);
const mockedLogin = vi.mocked(login);
const mockedLogout = vi.mocked(logout);

const TEST_USER: AuthenticatedUser = {
  id: '1',
  username: 'andrea',
  fullName: 'Andrea',
  role: 'ADMIN',
};

async function renderUnauthenticated() {
  mockedFetchCurrentUser.mockRejectedValueOnce(new ApiError(401, 'No autenticado.'));
  render(<App />);
  return screen.findByRole('button', { name: 'Entrar' });
}

async function renderAuthenticated() {
  mockedFetchCurrentUser.mockResolvedValueOnce({ user: TEST_USER });
  render(<App />);
  return screen.findByText(/resumen de MALA MÍA/i);
}

beforeEach(() => {
  vi.resetAllMocks();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.pushState({}, '', '/');
});

describe('Login', () => {
  it('renderiza el formulario de inicio de sesión', async () => {
    await renderUnauthenticated();

    expect(screen.getByLabelText('Usuario')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('permite iniciar sesión correctamente y muestra el dashboard', async () => {
    const user = userEvent.setup();
    await renderUnauthenticated();
    mockedLogin.mockResolvedValueOnce({ user: TEST_USER });

    await user.type(screen.getByLabelText('Usuario'), 'andrea');
    await user.type(screen.getByLabelText('Contraseña'), '12345');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText(/resumen de MALA MÍA/i)).toBeInTheDocument();
    expect(mockedLogin).toHaveBeenCalledWith('andrea', '12345');
  });

  it('muestra un mensaje de error genérico si las credenciales son incorrectas', async () => {
    const user = userEvent.setup();
    await renderUnauthenticated();
    mockedLogin.mockRejectedValueOnce(new ApiError(401, 'Usuario o contraseña incorrectos.'));

    await user.type(screen.getByLabelText('Usuario'), 'andrea');
    await user.type(screen.getByLabelText('Contraseña'), 'incorrecta');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Usuario o contraseña incorrectos.',
    );
    // Sigue en login, no entró al dashboard.
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('nunca guarda el token de sesión en localStorage ni sessionStorage', async () => {
    const user = userEvent.setup();
    await renderUnauthenticated();
    mockedLogin.mockResolvedValueOnce({ user: TEST_USER });

    await user.type(screen.getByLabelText('Usuario'), 'andrea');
    await user.type(screen.getByLabelText('Contraseña'), '12345');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
    await screen.findByText(/resumen de MALA MÍA/i);

    // localStorage sí guarda preferencias sin datos sensibles (tema, última
    // ruta visitada para sobrevivir a que el SO mate la PWA en segundo
    // plano) — lo que nunca debe aparecer es algo parecido a una sesión o
    // credencial real.
    const storedKeys = Object.keys(window.localStorage);
    expect(storedKeys).not.toContain('token');
    expect(storedKeys.join(' ')).not.toMatch(/session|cookie|auth|password|credential/i);
    expect(window.sessionStorage.length).toBe(0);
  });
});

describe('Sesión y rutas protegidas', () => {
  it('un usuario no autenticado que entra a "/" es enviado a /login', async () => {
    mockedFetchCurrentUser.mockRejectedValueOnce(new ApiError(401, 'No autenticado.'));
    render(<App />);

    await screen.findByRole('button', { name: 'Entrar' });
    expect(window.location.pathname).toBe('/login');
  });

  it('la sesión se mantiene al recargar: si /auth/me responde ok, entra directo al dashboard', async () => {
    await renderAuthenticated();

    expect(screen.queryByRole('button', { name: 'Entrar' })).not.toBeInTheDocument();
    expect(window.location.pathname).toBe('/');
  });

  it('un usuario autenticado puede ver el dashboard', async () => {
    await renderAuthenticated();

    expect(screen.getByRole('heading', { name: /Andrea/ })).toBeInTheDocument();
  });
});

describe('Logout', () => {
  it('cierra sesión desde el menú de usuario y regresa a /login', async () => {
    const user = userEvent.setup();
    await renderAuthenticated();
    mockedLogout.mockResolvedValueOnce({ success: true });

    await user.click(screen.getByRole('button', { name: /Andrea/ }));
    await user.click(await screen.findByRole('menuitem', { name: /Cerrar sesión/ }));

    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });
});
