import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonthlyKmReading } from './monthly-km-reading.entity';
import { FuelControlService } from './fuel-control.service';
import { FuelControlController } from './fuel-control.controller';
import { Vehicle } from '../vehicles/vehicles.entity';
import { FuelEntry } from '../fuel-entries/fuel-entries.entity';
import { EngineFuelEntry } from '../engine-fuel-entries/engine-fuel-entries.entity';
import { FuelCardMovement } from '../fuel-card-movements/fuel-card-movements.entity';
import { FuelStockOp } from '../fuel-stock/fuel-stock.entity';
import { FuelStockModule } from '../fuel-stock/fuel-stock.module';
import { Mission } from '../missions/missions.entity';
import { SitePointage } from '../site-pointage/site-pointage.entity';
import { VehicleAssignment } from '../vehicle-assignments/vehicle-assignments.entity';
import { Alert } from '../alerts/alerts.entity';
import { KmReading } from '../km-readings/km-readings.entity';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MonthlyKmReading, Vehicle, FuelEntry, EngineFuelEntry, FuelCardMovement, FuelStockOp, Mission, SitePointage, VehicleAssignment, Alert, KmReading,
    ]),
    FuelStockModule, AppConfigModule,
  ],
  controllers: [FuelControlController],
  providers: [FuelControlService],
  exports: [FuelControlService],
})
export class FuelControlModule {}
