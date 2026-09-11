import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SchedulerService } from './scheduler.service';
import { SchedulerController } from './scheduler.controller';
import { MaintenancePlansModule } from '../maintenance-plans/maintenance-plans.module';
import { Alert } from '../alerts/alerts.entity';
import { Driver } from '../drivers/drivers.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { MaintenanceOrder } from '../maintenance-orders/maintenance-orders.entity';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([Alert, Driver, Vehicle, MaintenanceOrder]),
    MaintenancePlansModule,
  ],
  controllers: [SchedulerController],
  providers: [SchedulerService],
})
export class SchedulerModule {}
