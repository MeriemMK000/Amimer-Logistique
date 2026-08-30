import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Driver } from '../drivers/driver.entity';
import { Mission } from '../missions/mission.entity';
import { MaintenanceOrder } from '../maintenance/entities/maintenance-order.entity';
import { FuelEntry } from '../fuel/entities/fuel-entry.entity';
import { Incident } from '../incidents/incident.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehicle,
      Driver,
      Mission,
      MaintenanceOrder,
      FuelEntry,
      Incident,
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
