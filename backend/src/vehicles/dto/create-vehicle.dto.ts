import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VehicleType, VehicleStatus, OwnershipType, FuelType } from '../../common/enums';

export class CreateVehicleDto {
  @ApiProperty({ example: 'VH-001' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ enum: VehicleType })
  @IsEnum(VehicleType)
  type: VehicleType;

  @ApiProperty({ example: 'Renault' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ example: 'Master' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: 2023 })
  @IsNumber()
  year: number;

  @ApiPropertyOptional({ example: 'VF1MA000060000001' })
  @IsOptional()
  @IsString()
  vin?: string;

  @ApiProperty({ example: 'AA-123-BB' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiPropertyOptional({ enum: OwnershipType })
  @IsOptional()
  @IsEnum(OwnershipType)
  ownershipType?: OwnershipType;

  @ApiPropertyOptional({ enum: FuelType })
  @IsOptional()
  @IsEnum(FuelType)
  fuelType?: FuelType;

  @ApiPropertyOptional({ enum: VehicleStatus })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @ApiPropertyOptional({ example: 'CARD-001' })
  @IsOptional()
  @IsString()
  fuelCardNumber?: string;

  @ApiPropertyOptional({ example: 5000.00 })
  @IsOptional()
  @IsNumber()
  fuelBudget?: number;

  @ApiPropertyOptional({ example: 7.5, description: 'Consommation constructeur L/100km' })
  @IsOptional()
  @IsNumber()
  constructorNormConsumption?: number;

  @ApiPropertyOptional({ example: 1.0 })
  @IsOptional()
  @IsNumber()
  consumptionCorrectionFactor?: number;

  @ApiPropertyOptional({ example: 5.0, description: 'Marge en pourcentage' })
  @IsOptional()
  @IsNumber()
  consumptionMargin?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  currentMileage?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  currentHours?: number;

  @ApiPropertyOptional({ example: '2023-01-15' })
  @IsOptional()
  @IsDateString()
  acquisitionDate?: string;

  @ApiPropertyOptional({ example: '2028-01-15' })
  @IsOptional()
  @IsDateString()
  decommissionDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
