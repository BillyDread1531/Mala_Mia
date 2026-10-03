import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  NotEquals,
} from 'class-validator';

export class AdjustConsumableDto {
  /** Puede ser negativo (merma/uso manual) o positivo (ej. se compró más). */
  @IsInt()
  @NotEquals(0)
  quantityChange!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /** Costo total de este reabastecimiento (opcional, solo tiene sentido
   * cuando `quantityChange` es positivo): si se manda, se registra como
   * gasto (categoría "Empaque") — requiere `paymentMethodId`. */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  cost?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  paymentMethodId?: number;
}
