import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenancePlan } from './maintenance-plan.entity';
import { VehicleMaintenancePlan } from './vehicle-maintenance-plan.entity';
import { MaintenancePlansService } from './maintenance-plans.service';
import { MaintenancePlansController } from './maintenance-plans.controller';
import { Vehicle } from '../vehicles/vehicles.entity';
import { MaintenanceOrder } from '../maintenance-orders/maintenance-orders.entity';
import { KmReadingModule } from '../km-readings/km-readings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaintenancePlan, VehicleMaintenancePlan, Vehicle, MaintenanceOrder]),
    KmReadingModule,
  ],
  controllers: [MaintenancePlansController],
  providers: [MaintenancePlansService],
  exports: [MaintenancePlansService],
})
export class MaintenancePlansModule {}
