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
import { PurchaseItemInputDto } from './purchase-item-input.dto';

export class CreatePurchaseDto {
  @IsInt()
  @Min(1)
  supplierId!: number;

  @IsInt()
  @Min(1)
  paymentMethodId!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemInputDto)
  items!: PurchaseItemInputDto[];
}
