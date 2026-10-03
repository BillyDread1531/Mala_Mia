import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  NotEquals,
} from 'class-validator';
import { ADJUSTMENT_REASONS } from './adjust-inventory.dto';

/** Igual que `AdjustInventoryDto`, pero identifica la combinación por
 * producto+talla+color en vez de un `inventory_item.id` que podría no
 * existir todavía (combinación declarada pero nunca comprada). */
export class AdjustVariantDto {
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
  @NotEquals(0)
  quantityChange!: number;

  @IsIn(ADJUSTMENT_REASONS)
  reason!: (typeof ADJUSTMENT_REASONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
