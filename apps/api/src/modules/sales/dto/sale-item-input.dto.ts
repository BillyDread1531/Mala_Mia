import { IsInt, IsNumber, Min } from 'class-validator';

/** Una línea de venta: una variante concreta ya existente en inventario
 * (identificada por su inventory_item_id), la cantidad vendida y el precio
 * final acordado (puede diferir del precio de catálogo por regateo). */
export class SaleItemInputDto {
  @IsInt()
  @Min(1)
  inventoryItemId!: number;

  @IsInt()
  @Min(1)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitSalePrice!: number;
}
