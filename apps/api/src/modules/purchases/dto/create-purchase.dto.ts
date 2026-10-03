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

  /** Transporte/flete de esta compra: costo real del negocio (a diferencia
   * del envío en Ventas, que es un traspaso del cliente). Se suma al total
   * de la compra y se registra en `purchase_additional_costs`. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingCost?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemInputDto)
  items!: PurchaseItemInputDto[];
}
