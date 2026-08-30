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
import { MissionStatus } from '../../common/enums';
import { CreateMissionWaypointDto } from '../../mission-waypoints/dto/create-mission-waypoint.dto';

export class CreateMissionDto {
  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiProperty()
  @IsUUID()
  driverId: string;

  @ApiPropertyOptional({ enum: MissionStatus })
  @IsOptional()
  @IsEnum(MissionStatus)
  status?: MissionStatus;

  @ApiProperty({ example: 'Paris - Entrepot Central' })
  @IsString()
  @IsNotEmpty()
  departureLocation: string;

  @ApiPropertyOptional({ example: 48.8566 })
  @IsOptional()
  @IsNumber()
  departureLat?: number;

  @ApiPropertyOptional({ example: 2.3522 })
  @IsOptional()
  @IsNumber()
  departureLng?: number;

  @ApiProperty({ example: 'Lyon - Depot Sud' })
  @IsString()
  @IsNotEmpty()
  arrivalLocation: string;

  @ApiPropertyOptional({ example: 45.764 })
  @IsOptional()
  @IsNumber()
  arrivalLat?: number;

  @ApiPropertyOptional({ example: 4.8357 })
  @IsOptional()
  @IsNumber()
  arrivalLng?: number;

  @ApiProperty({ example: '2024-01-15T08:00:00Z' })
  @IsDateString()
  plannedDepartureDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualDepartureDate?: string;

  @ApiProperty({ example: '2024-01-15T16:00:00Z' })
  @IsDateString()
  plannedArrivalDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualArrivalDate?: string;

  @ApiPropertyOptional({ example: 465 })
  @IsOptional()
  @IsNumber()
  plannedDistanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  actualDistanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  gpsDistanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fuelLevelDeparture?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fuelLevelArrival?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  zoneId?: string;

  @ApiPropertyOptional({ type: [CreateMissionWaypointDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateMissionWaypointDto)
  waypoints?: CreateMissionWaypointDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
