import { IsString, MinLength } from 'class-validator';

export class CheckDuplicatesQueryDto {
  @IsString()
  @MinLength(2)
  q!: string;
}
