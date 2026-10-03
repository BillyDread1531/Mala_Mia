import { IsInt, IsNumber, IsString, Min, MaxLength } from 'class-validator';

export class CreateManualIncomeDto {
  @IsString()
  @MaxLength(255)
  description!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsInt()
  @Min(1)
  paymentMethodId!: number;
}
