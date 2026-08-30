import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExpenseScaleDto {
  @ApiProperty({ example: 'Bareme National 2024' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({ example: 50.00 })
  @IsOptional()
  @IsNumber()
  perDiemRate?: number;

  @ApiPropertyOptional({ example: 20.00 })
  @IsOptional()
  @IsNumber()
  mealRate?: number;

  @ApiPropertyOptional({ example: 80.00 })
  @IsOptional()
  @IsNumber()
  accommodationRate?: number;

  @ApiPropertyOptional({ example: 0.55 })
  @IsOptional()
  @IsNumber()
  kmRate?: number;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  effectiveDate: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
