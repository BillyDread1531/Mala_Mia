import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class GenerateCodeQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId!: number;
}
