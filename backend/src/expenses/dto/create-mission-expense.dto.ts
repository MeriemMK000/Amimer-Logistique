import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ExpenseStatus } from '../../common/enums';

export class CreateMissionExpenseDto {
  @ApiProperty()
  @IsUUID()
  missionId: string;

  @ApiProperty()
  @IsUUID()
  driverId: string;

  @ApiProperty({ example: 'PER_DIEM' })
  @IsString()
  @IsNotEmpty()
  expenseType: string;

  @ApiProperty({ example: 150.00 })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: '3 jours x 50 EUR' })
  @IsOptional()
  @IsString()
  calculationBasis?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  days?: number;

  @ApiPropertyOptional({ example: 465 })
  @IsOptional()
  @IsNumber()
  distanceKm?: number;

  @ApiPropertyOptional({ enum: ExpenseStatus })
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
