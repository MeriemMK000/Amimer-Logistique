import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceType } from '../../common/enums';

export class CreateMaintenancePlanDto {
  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiProperty({ enum: MaintenanceType })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @ApiProperty({ example: 'Vidange moteur' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 15000 })
  @IsOptional()
  @IsNumber()
  intervalKm?: number;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsNumber()
  intervalDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  lastPerformedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  lastPerformedKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  nextDueKm?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
