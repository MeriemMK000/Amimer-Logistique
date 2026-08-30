import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MaintenanceType, MaintenanceStatus } from '../../common/enums';

export class CreateMaintenancePartDto {
  @ApiProperty({ example: 'Filtre a huile' })
  @IsString()
  @IsNotEmpty()
  partName: string;

  @ApiPropertyOptional({ example: 'FH-12345' })
  @IsOptional()
  @IsString()
  partNumber?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  quantity?: number;

  @ApiProperty({ example: 25.50 })
  @IsNumber()
  unitCost: number;

  @ApiProperty({ example: 25.50 })
  @IsNumber()
  totalCost: number;
}

export class CreateMaintenanceOrderDto {
  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiProperty({ enum: MaintenanceType })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @ApiProperty({ example: 'Remplacement freins avant' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: MaintenanceStatus })
  @IsOptional()
  @IsEnum(MaintenanceStatus)
  status?: MaintenanceStatus;

  @ApiPropertyOptional({ default: 'NORMALE' })
  @IsOptional()
  @IsString()
  priority?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  reportedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  startedDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  completedDate?: string;

  @ApiPropertyOptional({ example: 500.00 })
  @IsOptional()
  @IsNumber()
  estimatedCost?: number;

  @ApiPropertyOptional({ example: 450.00 })
  @IsOptional()
  @IsNumber()
  actualCost?: number;

  @ApiPropertyOptional({ example: 'Garage Central' })
  @IsOptional()
  @IsString()
  vendor?: string;

  @ApiPropertyOptional({ type: [CreateMaintenancePartDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMaintenancePartDto)
  parts?: CreateMaintenancePartDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
