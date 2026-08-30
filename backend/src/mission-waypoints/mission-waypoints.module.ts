import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionWaypoint } from './mission-waypoint.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MissionWaypoint])],
  exports: [TypeOrmModule],
})
export class MissionWaypointsModule {}
