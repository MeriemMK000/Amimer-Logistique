import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateFuelEntryDto } from './create-fuel-entry.dto';

export class UpdateFuelEntryDto extends PartialType(
  OmitType(CreateFuelEntryDto, ['vehicleId'] as const),
) {}
