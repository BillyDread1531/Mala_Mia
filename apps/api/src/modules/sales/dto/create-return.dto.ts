import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export const RETURN_REASONS = [
  'Cliente no quedó satisfecho',
  'Talla incorrecta',
  'Producto defectuoso',
  'Cambio de opinión',
  'Otro',
] as const;

/** Valores fijados por el CHECK constraint `chk_return_items_condition` en BD. */
export const RETURN_CONDITIONS = ['SALEABLE', 'DAMAGED'] as const;

export class ReturnItemInputDto {
  @IsInt()
  @Min(1)
  saleItemId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsIn(RETURN_CONDITIONS)
  conditionStatus!: (typeof RETURN_CONDITIONS)[number];
}

export class CreateReturnDto {
  @IsIn(RETURN_REASONS)
  reason!: (typeof RETURN_REASONS)[number];

  @IsOptional()
  @IsInt()
  @Min(1)
  refundPaymentMethodId?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemInputDto)
  items!: ReturnItemInputDto[];
}
