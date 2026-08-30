import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMissionZoneDto {
  @ApiProperty({ example: 'Zone Nord' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'ZN-01' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
