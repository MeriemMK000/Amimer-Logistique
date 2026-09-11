import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GpsService } from './gps.service';
import { GpsController } from './gps.controller';
import { Mission } from '../missions/missions.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [TypeOrmModule.forFeature([Mission, Vehicle]), AppConfigModule],
  controllers: [GpsController],
  providers: [GpsService],
  exports: [GpsService],
})
export class GpsModule {}
