import { IsInt, IsOptional, IsString, Min, MaxLength } from 'class-validator';

export class UpdateConsumableDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  unitsPerSale?: number;
}
