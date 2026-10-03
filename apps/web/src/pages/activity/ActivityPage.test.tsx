import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { ActivityEntry } from '../../types/audit';
import { ActivityPage } from './ActivityPage';

vi.mock('../../api/audit', () => ({
  listActivity: vi.fn(),
}));

import { listActivity } from '../../api/audit';

const mockedListActivity = vi.mocked(listActivity);

const ENTRIES: ActivityEntry[] = [
  {
    id: 'al-1',
    action: 'LOGIN',
    entityType: 'auth',
    entityId: '1',
    description: 'Andrea inició sesión.',
    userName: 'Andrea',
    createdAt: '2026-01-05T10:00:00.000Z',
  },
  {
    id: 'fm-1',
    action: 'SALE',
    entityType: 'sale',
    entityId: '10',
    description: 'Venta #00010',
    userName: 'Billy',
    createdAt: '2026-01-05T09:00:00.000Z',
  },
];

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter>
        <ActivityPage />
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
  mockedListActivity.mockResolvedValue({ items: ENTRIES, total: 2, page: 1, pageSize: 20 });
});

describe('ActivityPage', () => {
  it('muestra la actividad combinada (login y movimientos financieros) con usuario y fecha', async () => {
    renderPage();

    expect(await screen.findByText('Andrea inició sesión.')).toBeInTheDocument();
    expect(screen.getByText('Venta #00010')).toBeInTheDocument();
    expect(screen.getByText('Inicio de sesión')).toBeInTheDocument();
    expect(screen.getByText('Venta')).toBeInTheDocument();
    expect(screen.getByText('Andrea')).toBeInTheDocument();
    expect(screen.getByText('Billy')).toBeInTheDocument();
  });

  it('busca por texto', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Andrea inició sesión.');
    await user.type(screen.getByLabelText('Buscar'), 'sesión');

    await vi.waitFor(() =>
      expect(mockedListActivity).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'sesión' }),
      ),
    );
  });

  it('"Más filtros" revela el filtro de acción y fechas', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Andrea inició sesión.');
    expect(screen.queryByLabelText('Tipo de acción')).not.toBeInTheDocument();

    await user.click(screen.getByText('Más filtros'));
    expect(screen.getByLabelText('Tipo de acción')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Tipo de acción'), 'LOGIN');
    await vi.waitFor(() =>
      expect(mockedListActivity).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'LOGIN' }),
      ),
    );
  });

  it('muestra un estado vacío cuando no hay actividad', async () => {
    mockedListActivity.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
    renderPage();

    expect(await screen.findByText('Sin actividad')).toBeInTheDocument();
  });

  it('pagina cuando hay más resultados que una página', async () => {
    const user = userEvent.setup();
    mockedListActivity.mockResolvedValue({ items: ENTRIES, total: 45, page: 1, pageSize: 20 });
    renderPage();

    await screen.findByText('Andrea inició sesión.');
    expect(screen.getByText('Página 1 de 3')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    await vi.waitFor(() =>
      expect(mockedListActivity).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })),
    );
  });
});
