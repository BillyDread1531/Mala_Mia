import { IsInt, IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class CreateConsumableDto {
  @IsString()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  unitsPerSale?: number;

  /** Costo total de la existencia inicial (opcional): si se manda, se
   * registra como gasto (categoría "Empaque") — requiere `paymentMethodId`. */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  cost?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  paymentMethodId?: number;
}
