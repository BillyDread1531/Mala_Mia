import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { VariantInputDto } from './variant-input.dto';

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  categoryId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  /** Medidas opcionales (cm), usadas principalmente en pantalones. `null`
   * borra una medida ya guardada (a diferencia de `undefined`, que la deja
   * sin cambios). */
  @IsOptional()
  @IsNumber()
  @Min(0)
  waistMeasurement?: number | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthMeasurement?: number | null;

  /** Si se envía, reemplaza el conjunto completo de combinaciones activas. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants?: VariantInputDto[];
}
