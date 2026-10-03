import { IsOptional, IsString } from 'class-validator';

export class CancelSaleDto {
  @IsOptional()
  @IsString()
  notes?: string;
}
