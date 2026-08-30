import { PartialType } from '@nestjs/swagger';
import { CreateMissionZoneDto } from './create-mission-zone.dto';

export class UpdateMissionZoneDto extends PartialType(CreateMissionZoneDto) {}
