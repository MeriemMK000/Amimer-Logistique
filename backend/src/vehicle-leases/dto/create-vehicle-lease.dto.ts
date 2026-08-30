import {
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVehicleLeaseDto {
  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiProperty({ example: 'ALD Automotive' })
  @IsString()
  @IsNotEmpty()
  lessor: string;

  @ApiPropertyOptional({ example: 'CTR-2023-001' })
  @IsOptional()
  @IsString()
  contractNumber?: string;

  @ApiProperty({ example: '2023-01-01' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ example: '2026-01-01' })
  @IsDateString()
  endDate: string;

  @ApiProperty({ example: 850.00 })
  @IsNumber()
  monthlyCost: number;

  @ApiPropertyOptional({ default: 60 })
  @IsOptional()
  @IsNumber()
  alertDaysBefore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
