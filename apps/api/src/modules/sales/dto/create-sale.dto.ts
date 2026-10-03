import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { SaleItemInputDto } from './sale-item-input.dto';

export class CreateSaleDto {
  @IsInt()
  @Min(1)
  paymentMethodId!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  /** Envío cobrado al cliente (pass-through: lo que se cobra es lo que
   * cuesta, sin margen). Si se omite o es 0, la venta no lleva envío. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingAmount?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaleItemInputDto)
  items!: SaleItemInputDto[];
}
