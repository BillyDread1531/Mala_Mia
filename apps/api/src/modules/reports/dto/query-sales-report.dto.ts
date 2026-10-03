import { Type } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';
import { QueryFinanceSummaryDto } from '../../finance/dto/query-finance-summary.dto';

export class QuerySalesReportDto extends QueryFinanceSummaryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paymentMethodId?: number;
}
