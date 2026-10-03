import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export const CORRECTION_REASONS = [
  'Talla equivocada',
  'Color equivocado',
  'Cantidad equivocada',
  'Precio mal ingresado',
  'Otro',
] as const;

/** Al menos uno de los campos `new*` debe diferir del valor actual de la
 * línea; el servicio lo valida (no tiene sentido registrar una corrección
 * sin ningún cambio real). */
export class CreateCorrectionDto {
  @IsInt()
  @Min(1)
  saleItemId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  newSizeId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  newColorId?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  newQuantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  newUnitPrice?: number;

  @IsIn(CORRECTION_REASONS)
  reason!: (typeof CORRECTION_REASONS)[number];

  @IsOptional()
  @IsString()
  notes?: string;
}
