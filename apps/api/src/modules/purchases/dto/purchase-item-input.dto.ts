import { IsInt, IsNumber, Min } from 'class-validator';

/** Una línea de compra: una variante concreta (producto+talla+color) con
 * la cantidad y el costo unitario realmente pagado. */
export class PurchaseItemInputDto {
  @IsInt()
  @Min(1)
  productId!: number;

  @IsInt()
  @Min(1)
  sizeId!: number;

  @IsInt()
  @Min(1)
  colorId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitCost!: number;
}
