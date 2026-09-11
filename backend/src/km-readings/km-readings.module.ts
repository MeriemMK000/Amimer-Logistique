import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KmReading } from './km-readings.entity';
import { KmReadingService } from './km-readings.service';
import { KmReadingController } from './km-readings.controller';
import { Mission } from '../missions/missions.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { Driver } from '../drivers/drivers.entity';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [TypeOrmModule.forFeature([KmReading, Mission, Vehicle, Driver]), AppConfigModule],
  controllers: [KmReadingController],
  providers: [KmReadingService],
  exports: [KmReadingService],
})
export class KmReadingModule {}
