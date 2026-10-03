import {
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateExpenseDto {
  @IsInt()
  @Min(1)
  categoryId!: number;

  @IsString()
  @MaxLength(255)
  description!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsInt()
  @Min(1)
  paymentMethodId!: number;

  @IsOptional()
  @IsISO8601()
  expenseDate?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
