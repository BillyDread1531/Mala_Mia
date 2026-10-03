import { IsString, MaxLength, MinLength } from 'class-validator';

/** Reutilizado para crear categorías, tallas, colores y categorías de
 * gasto: todos son, en esencia, "un nombre". */
export class CreateNamedEntityDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;
}
