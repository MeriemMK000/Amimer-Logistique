import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateVehicleLeaseDto } from './create-vehicle-lease.dto';

export class UpdateVehicleLeaseDto extends PartialType(
  OmitType(CreateVehicleLeaseDto, ['vehicleId'] as const),
) {}
