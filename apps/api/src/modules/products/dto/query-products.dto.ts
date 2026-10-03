import { Type } from 'class-transformer';
import {
  IsBooleanString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class QueryProductsDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  /** Por defecto solo se listan productos activos: así un producto ya no
   * vendido deja de aparecer al buscar en Ventas/Compras y en el catálogo
   * sin tener que borrarlo. La pantalla de administración de Productos pide
   * `includeInactive=true` para poder ver/reactivar los inactivos. */
  @IsOptional()
  @IsBooleanString()
  includeInactive?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 20;
}
