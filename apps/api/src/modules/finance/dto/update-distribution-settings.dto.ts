import { IsNumber, Max, Min } from 'class-validator';

export class UpdateDistributionSettingsDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  personalPercentage!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  reinvestmentPercentage!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  reservePercentage!: number;
}
