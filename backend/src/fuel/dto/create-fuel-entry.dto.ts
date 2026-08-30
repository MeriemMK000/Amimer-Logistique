import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FuelType } from '../../common/enums';

export class CreateFuelEntryDto {
  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  driverId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  missionId?: string;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  date: string;

  @ApiProperty({ enum: FuelType })
  @IsEnum(FuelType)
  fuelType: FuelType;

  @ApiProperty({ example: 65.5 })
  @IsNumber()
  quantityLiters: number;

  @ApiProperty({ example: 1.85 })
  @IsNumber()
  unitPrice: number;

  @ApiProperty({ example: 121.18 })
  @IsNumber()
  totalCost: number;

  @ApiPropertyOptional({ example: 125000 })
  @IsOptional()
  @IsNumber()
  odometerReading?: number;

  @ApiPropertyOptional({ example: 'TotalEnergies Paris 12' })
  @IsOptional()
  @IsString()
  stationName?: string;

  @ApiPropertyOptional({ example: 'CARD-001' })
  @IsOptional()
  @IsString()
  cardNumber?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isImported?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
