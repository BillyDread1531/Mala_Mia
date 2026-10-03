import { IsIn, IsOptional, IsISO8601 } from 'class-validator';

export const FINANCE_PERIODS = ['week', 'month', 'year', 'custom'] as const;

export class QueryFinanceSummaryDto {
  @IsOptional()
  @IsIn(FINANCE_PERIODS)
  period?: (typeof FINANCE_PERIODS)[number];

  /** Requerido cuando period='custom'. */
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;
}
