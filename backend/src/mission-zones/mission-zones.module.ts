import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MissionZonesService } from './mission-zones.service';
import { MissionZonesController } from './mission-zones.controller';
import { MissionZone } from './mission-zone.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MissionZone])],
  controllers: [MissionZonesController],
  providers: [MissionZonesService],
  exports: [MissionZonesService],
})
export class MissionZonesModule {}
