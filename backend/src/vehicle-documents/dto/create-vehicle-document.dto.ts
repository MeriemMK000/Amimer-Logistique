import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentType } from '../../common/enums';

export class CreateVehicleDocumentDto {
  @ApiProperty()
  @IsUUID()
  vehicleId: string;

  @ApiProperty({ enum: DocumentType })
  @IsEnum(DocumentType)
  type: DocumentType;

  @ApiPropertyOptional({ example: 'DOC-001' })
  @IsOptional()
  @IsString()
  documentNumber?: string;

  @ApiProperty({ example: '2023-01-01' })
  @IsDateString()
  issuedDate: string;

  @ApiProperty({ example: '2024-01-01' })
  @IsDateString()
  expiryDate: string;

  @ApiPropertyOptional({ default: 30 })
  @IsOptional()
  @IsNumber()
  alertDaysBefore?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
