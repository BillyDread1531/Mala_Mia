import { IsOptional, IsString } from 'class-validator';

export class QuerySuppliersDto {
  @IsOptional()
  @IsString()
  search?: string;
}
