import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import { QuickActions } from './QuickActions';

function renderActions() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <QuickActions />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

describe('QuickActions', () => {
  it('todas las acciones rápidas navegan a su pantalla, ninguna queda sin destino', () => {
    renderActions();

    expect(screen.getByRole('link', { name: /Nueva venta/ })).toHaveAttribute(
      'href',
      '/ventas/nueva',
    );
    expect(screen.getByRole('link', { name: /Agregar producto/ })).toHaveAttribute(
      'href',
      '/inventario/nuevo',
    );
    expect(screen.getByRole('link', { name: /Registrar gasto/ })).toHaveAttribute(
      'href',
      '/finanzas/gastos/nuevo',
    );
    expect(screen.getByRole('link', { name: /Registrar compra/ })).toHaveAttribute(
      'href',
      '/compras/nueva',
    );
  });
});
