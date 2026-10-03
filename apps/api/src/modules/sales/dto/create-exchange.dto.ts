import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ExchangeItemInputDto {
  @IsInt()
  @Min(1)
  originalSaleItemId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsInt()
  @Min(1)
  newInventoryItemId!: number;
}

export class CreateExchangeDto {
  /** Solo requerido si la diferencia resulta a favor de la tienda. */
  @IsOptional()
  @IsInt()
  @Min(1)
  paymentMethodId?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExchangeItemInputDto)
  items!: ExchangeItemInputDto[];
}
