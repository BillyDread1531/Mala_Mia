import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export const AVAILABILITY_STATUSES = [
  'DISPONIBLE',
  'STOCK_BAJO',
  'AGOTADO',
] as const;

export class QueryAvailabilityDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sizeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  colorId?: number;

  @IsOptional()
  @IsIn(AVAILABILITY_STATUSES)
  status?: (typeof AVAILABILITY_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 200;
}
