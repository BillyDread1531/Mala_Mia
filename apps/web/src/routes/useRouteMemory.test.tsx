import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'mala-mia-last-route';

function Home() {
  return <div>Pantalla de inicio</div>;
}
function Sales() {
  return <div>Pantalla de ventas</div>;
}

function GoToSales() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate('/ventas')}>
      Ir a ventas
    </button>
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
});

async function renderAt(path: string) {
  const { useRouteMemory } = await import('./useRouteMemory');
  function Shell() {
    useRouteMemory();
    return (
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ventas" element={<Sales />} />
      </Routes>
    );
  }
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Shell />
    </MemoryRouter>,
  );
}

describe('useRouteMemory', () => {
  it('guarda la ruta actual en localStorage al navegar', async () => {
    const { useRouteMemory } = await import('./useRouteMemory');
    function Shell() {
      useRouteMemory();
      return (
        <Routes>
          <Route path="/" element={<GoToSales />} />
          <Route path="/ventas" element={<Sales />} />
        </Routes>
      );
    }
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/']}>
        <Shell />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole('button', { name: 'Ir a ventas' }));
    await screen.findByText('Pantalla de ventas');

    expect(localStorage.getItem(STORAGE_KEY)).toBe('/ventas');
  });

  it('si el primer montaje cae en "/" y hay una ruta guardada, restaura esa ruta', async () => {
    localStorage.setItem(STORAGE_KEY, '/ventas');
    await renderAt('/');

    expect(await screen.findByText('Pantalla de ventas')).toBeInTheDocument();
  });

  it('no restaura si la ruta guardada es "/" o "/login"', async () => {
    localStorage.setItem(STORAGE_KEY, '/login');
    await renderAt('/');

    expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument();
  });

  it('si la persona navega a "/" directamente (no es el primer montaje en "/"), no hay restauración previa que estorbe', async () => {
    // Sin ruta guardada: cae y se queda en "/" con normalidad.
    await renderAt('/');

    expect(await screen.findByText('Pantalla de inicio')).toBeInTheDocument();
  });
});
