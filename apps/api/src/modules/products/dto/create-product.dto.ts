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

export class CreateProductDto {
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  name!: string;

  @IsInt()
  @Min(1)
  categoryId!: number;

  /** Si se omite, el servicio genera uno a partir de la categoría. */
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

  /** Medidas opcionales (cm), usadas principalmente en pantalones. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  waistMeasurement?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthMeasurement?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantInputDto)
  variants!: VariantInputDto[];
}
