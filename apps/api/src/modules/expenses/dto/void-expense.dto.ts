import { IsOptional, IsString } from 'class-validator';

export class VoidExpenseDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
