import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class RecommendedPriceQueryDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  cost!: number;
}
