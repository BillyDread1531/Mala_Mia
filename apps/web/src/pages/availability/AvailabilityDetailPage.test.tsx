import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { AvailabilityProductDetail } from '../../types/availability';
import { AvailabilityDetailPage } from './AvailabilityDetailPage';

vi.mock('../../api/availability', () => ({
  getAvailabilityDetail: vi.fn(),
}));

import { getAvailabilityDetail } from '../../api/availability';

const mockedGetAvailabilityDetail = vi.mocked(getAvailabilityDetail);

const PRODUCT: AvailabilityProductDetail = {
  id: '1',
  name: 'Blusa Básica',
  code: 'BLU-0001',
  category: { id: '1', name: 'Blusas' },
  description: 'Blusa de algodón suave.',
  salePrice: '125',
  waistMeasurement: null,
  lengthMeasurement: null,
  variants: [
    { sizeId: '2', sizeName: 'M', colorId: '5', colorName: 'Beige', quantity: 3, status: 'DISPONIBLE' },
    { sizeId: '2', sizeName: 'M', colorId: '6', colorName: 'Rojo', quantity: 0, status: 'AGOTADO' },
  ],
};

function renderPage() {
  return render(
    <NotificationProvider>
      <MemoryRouter initialEntries={['/disponibilidad/1']}>
        <Routes>
          <Route path="/disponibilidad/:productId" element={<AvailabilityDetailPage />} />
        </Routes>
      </MemoryRouter>
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('AvailabilityDetailPage', () => {
  it('muestra la información de consulta del producto', async () => {
    mockedGetAvailabilityDetail.mockResolvedValue(PRODUCT);
    renderPage();

    expect(await screen.findByText('Blusa Básica')).toBeInTheDocument();
    expect(screen.getByText('BLU-0001 · Blusas')).toBeInTheDocument();
    expect(screen.getByText('Blusa de algodón suave.')).toBeInTheDocument();
    expect(screen.getByText('Q125')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Agotado')).toBeInTheDocument();
  });

  it('no incluye controles de edición', async () => {
    mockedGetAvailabilityDetail.mockResolvedValue(PRODUCT);
    renderPage();

    await screen.findByText('Blusa Básica');
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Ajustar/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Vender/ })).not.toBeInTheDocument();
  });
});
