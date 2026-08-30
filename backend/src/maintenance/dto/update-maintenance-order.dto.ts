import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateMaintenanceOrderDto } from './create-maintenance-order.dto';

export class UpdateMaintenanceOrderDto extends PartialType(
  OmitType(CreateMaintenanceOrderDto, ['vehicleId'] as const),
) {}
