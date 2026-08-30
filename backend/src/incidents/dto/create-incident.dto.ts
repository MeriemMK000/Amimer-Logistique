import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IncidentType, IncidentSeverity, IncidentStatus } from '../../common/enums';

export class CreateIncidentDto {
  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiProperty({ enum: IncidentType })
  @IsEnum(IncidentType)
  type: IncidentType;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiPropertyOptional({ example: 'A6, km 245' })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ example: 'Collision arriere sur autoroute' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ enum: IncidentSeverity })
  @IsEnum(IncidentSeverity)
  severity: IncidentSeverity;

  @ApiPropertyOptional({ enum: IncidentStatus })
  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;

  @ApiPropertyOptional({ example: 5000.00 })
  @IsOptional()
  @IsNumber()
  estimatedCost?: number;

  @ApiPropertyOptional({ example: 4500.00 })
  @IsOptional()
  @IsNumber()
  actualCost?: number;

  @ApiPropertyOptional({ example: 'CLM-2024-001' })
  @IsOptional()
  @IsString()
  insuranceClaimNumber?: string;

  @ApiPropertyOptional({ example: 'EN_COURS' })
  @IsOptional()
  @IsString()
  insuranceStatus?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
