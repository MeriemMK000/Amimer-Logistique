import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateIncidentDto } from './create-incident.dto';

export class UpdateIncidentDto extends PartialType(
  OmitType(CreateIncidentDto, ['vehicleId'] as const),
) {}
