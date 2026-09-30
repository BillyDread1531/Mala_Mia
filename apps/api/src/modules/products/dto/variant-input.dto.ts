import { IsInt, Min } from 'class-validator';

/** Una combinación talla+color que el producto declara manejar. */
export class VariantInputDto {
  @IsInt()
  @Min(1)
  sizeId!: number;

  @IsInt()
  @Min(1)
  colorId!: number;
}
