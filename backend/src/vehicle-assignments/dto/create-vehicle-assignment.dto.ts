import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVehicleAssignmentDto {
  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiProperty()
  @IsUUID()
  driverId: string;

  @ApiPropertyOptional({ enum: ['PERMANENT', 'TEMPORAIRE'], default: 'PERMANENT' })
  @IsOptional()
  @IsIn(['PERMANENT', 'TEMPORAIRE'])
  type?: string;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
