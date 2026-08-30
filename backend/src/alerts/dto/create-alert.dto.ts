import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AlertType, AlertPriority } from '../../common/enums';

export class CreateAlertDto {
  @ApiProperty({ enum: AlertType })
  @IsEnum(AlertType)
  type: AlertType;

  @ApiPropertyOptional({ enum: AlertPriority })
  @IsOptional()
  @IsEnum(AlertPriority)
  priority?: AlertPriority;

  @ApiProperty({ example: 'Assurance VH-001 expire bientot' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: 'L\'assurance du vehicule VH-001 expire dans 15 jours' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ example: 'vehicle_document' })
  @IsOptional()
  @IsString()
  relatedEntityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  relatedEntityId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
