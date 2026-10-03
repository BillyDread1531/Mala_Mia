import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationProvider } from '../../notifications/NotificationContext';
import type { Color, Size } from '../../types/catalog';
import { SizeColorPicker, type SizeColorPickerProps } from './SizeColorPicker';

vi.mock('../../api/catalog', () => ({
  createSize: vi.fn(),
  createColor: vi.fn(),
}));

import { createColor, createSize } from '../../api/catalog';

const mockedCreateSize = vi.mocked(createSize);
const mockedCreateColor = vi.mocked(createColor);

const SIZES: Size[] = [{ id: '1', name: 'M', normalizedName: 'M', isActive: true }];

function manyColors(count: number): Color[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    name: `Color ${i + 1}`,
    normalizedName: `COLOR ${i + 1}`,
    isActive: true,
  }));
}

function baseProps() {
  return {
    sizes: SIZES,
    selectedSizeIds: new Set<number>(),
    selectedColorIds: new Set<number>(),
    disabledCombos: new Set<string>(),
    onToggleSize: vi.fn(),
    onToggleColor: vi.fn(),
    onToggleCombo: vi.fn(),
  };
}

function renderPicker(props: SizeColorPickerProps) {
  return render(
    <NotificationProvider>
      <SizeColorPicker {...props} />
    </NotificationProvider>,
  );
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('SizeColorPicker', () => {
  it('siempre muestra un buscador de color, incluso con pocos', () => {
    renderPicker({ ...baseProps(), colors: manyColors(3) });

    expect(screen.getByLabelText('Buscar color')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Color 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Color 3' })).toBeInTheDocument();
  });

  it('con muchos colores, el buscador filtra los chips', async () => {
    const user = userEvent.setup();
    renderPicker({ ...baseProps(), colors: manyColors(30) });

    expect(screen.getByRole('button', { name: 'Color 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Color 30' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('Buscar color'), 'Color 2');

    expect(screen.getByRole('button', { name: 'Color 2' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Color 20' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Color 1' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Color 30' })).not.toBeInTheDocument();
  });

  it('un color ya marcado se mantiene visible aunque no calce con la búsqueda', async () => {
    const user = userEvent.setup();
    renderPicker({ ...baseProps(), selectedColorIds: new Set([5]), colors: manyColors(30) });

    await user.type(screen.getByLabelText('Buscar color'), 'zzz-no-existe');

    expect(screen.getByRole('button', { name: 'Color 5' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Color 1' })).not.toBeInTheDocument();
  });

  it('muestra un aviso cuando la búsqueda no encuentra nada', async () => {
    const user = userEvent.setup();
    renderPicker({ ...baseProps(), colors: manyColors(30) });

    await user.type(screen.getByLabelText('Buscar color'), 'zzz-no-existe');

    expect(screen.getByText(/Sin colores que coincidan/)).toBeInTheDocument();
  });

  it('siempre muestra los botones de agregar talla/color nuevos', () => {
    renderPicker({ ...baseProps(), colors: manyColors(3) });

    expect(screen.getByRole('button', { name: '+ Nueva talla' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '+ Nuevo color' })).toBeInTheDocument();
  });

  it('crea una talla nueva, la selecciona y avisa al padre', async () => {
    const user = userEvent.setup();
    mockedCreateSize.mockResolvedValue({ id: '9', name: 'XXL', normalizedName: 'XXL', isActive: true });
    const onToggleSize = vi.fn();
    const onSizeCreated = vi.fn();
    renderPicker({ ...baseProps(), colors: manyColors(3), onToggleSize, onSizeCreated });

    await user.click(screen.getByRole('button', { name: '+ Nueva talla' }));
    await user.type(screen.getByLabelText('Nombre de la talla'), 'XXL');
    await user.click(screen.getByRole('button', { name: 'Agregar talla' }));

    await vi.waitFor(() => expect(mockedCreateSize).toHaveBeenCalledWith('XXL'));
    expect(onSizeCreated).toHaveBeenCalledWith({ id: '9', name: 'XXL', normalizedName: 'XXL', isActive: true });
    expect(onToggleSize).toHaveBeenCalledWith(9);
  });

  it('crea un color nuevo, lo selecciona y avisa al padre', async () => {
    const user = userEvent.setup();
    mockedCreateColor.mockResolvedValue({
      id: '9',
      name: 'Verde musgo',
      normalizedName: 'VERDE MUSGO',
      isActive: true,
    });
    const onToggleColor = vi.fn();
    const onColorCreated = vi.fn();
    renderPicker({ ...baseProps(), colors: manyColors(3), onToggleColor, onColorCreated });

    await user.click(screen.getByRole('button', { name: '+ Nuevo color' }));
    await user.type(screen.getByLabelText('Nombre del color'), 'Verde musgo');
    await user.click(screen.getByRole('button', { name: 'Agregar color' }));

    await vi.waitFor(() => expect(mockedCreateColor).toHaveBeenCalledWith('Verde musgo'));
    expect(onColorCreated).toHaveBeenCalledWith({
      id: '9',
      name: 'Verde musgo',
      normalizedName: 'VERDE MUSGO',
      isActive: true,
    });
    expect(onToggleColor).toHaveBeenCalledWith(9);
  });
});
