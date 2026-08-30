import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateVehicleDocumentDto } from './create-vehicle-document.dto';

export class UpdateVehicleDocumentDto extends PartialType(
  OmitType(CreateVehicleDocumentDto, ['vehicleId'] as const),
) {}
