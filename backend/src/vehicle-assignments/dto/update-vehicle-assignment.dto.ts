import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateVehicleAssignmentDto } from './create-vehicle-assignment.dto';

export class UpdateVehicleAssignmentDto extends PartialType(
  OmitType(CreateVehicleAssignmentDto, ['vehicleId', 'driverId'] as const),
) {}
