import { PartialType } from '@nestjs/swagger';
import { CreateMissionWaypointDto } from './create-mission-waypoint.dto';

export class UpdateMissionWaypointDto extends PartialType(CreateMissionWaypointDto) {}
