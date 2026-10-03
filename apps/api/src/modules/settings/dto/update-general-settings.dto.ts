import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  businessName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  receiptMessage?: string;

  /** Margen objetivo (%). Debe quedar por debajo de 100: la fórmula
   * costo/(1-margen/100) se indefine o se vuelve negativa en 100 o más. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(99.99)
  targetProfitMargin?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultShippingFee?: number;
}
