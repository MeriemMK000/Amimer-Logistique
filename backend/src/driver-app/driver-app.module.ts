import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DriverAppController } from './driver-app.controller';
import { MissionModule } from '../missions/missions.module';
import { MaintenanceOrderModule } from '../maintenance-orders/maintenance-orders.module';
import { TiresModule } from '../tires/tires.module';
import { FuelControlModule } from '../fuel-control/fuel-control.module';
import { Mission } from '../missions/missions.entity';
import { Driver } from '../drivers/drivers.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { Attachment } from '../attachments/attachment.entity';
import { MaintenanceOrder } from '../maintenance-orders/maintenance-orders.entity';
import { TireMovement } from '../tires/tire-movement.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mission, Driver, Vehicle, Attachment, MaintenanceOrder, TireMovement]),
    MissionModule,
    MaintenanceOrderModule,
    TiresModule,
    FuelControlModule,
  ],
  controllers: [DriverAppController],
})
export class DriverAppModule {}
