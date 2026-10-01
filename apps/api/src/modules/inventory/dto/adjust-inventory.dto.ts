import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  NotEquals,
} from 'class-validator';

export const ADJUSTMENT_REASONS = [
  'Prenda dañada',
  'Prenda perdida',
  'Error de conteo',
  'Corrección de inventario',
  'Otro',
] as const;

export class AdjustInventoryDto {
  /** Puede ser negativo (merma) o positivo (ej. se encontró mercadería). */
  @IsInt()
  @NotEquals(0)
  quantityChange!: number;

  @IsIn(ADJUSTMENT_REASONS)
  reason!: (typeof ADJUSTMENT_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
