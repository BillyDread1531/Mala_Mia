import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { MobileNavigation } from './MobileNavigation';

describe('MobileNavigation', () => {
  it('el botón "+" navega a Nueva venta en vez de no hacer nada', () => {
    render(
      <MemoryRouter>
        <MobileNavigation />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: 'Nueva venta' })).toHaveAttribute(
      'href',
      '/ventas/nueva',
    );
  });
});
