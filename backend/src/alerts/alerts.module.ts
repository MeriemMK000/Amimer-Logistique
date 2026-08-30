import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertsService } from './alerts.service';
import { AlertsController } from './alerts.controller';
import { Alert } from './alert.entity';
import { VehicleDocument } from '../vehicle-documents/vehicle-document.entity';
import { VehicleLease } from '../vehicle-leases/vehicle-lease.entity';
import { MaintenancePlan } from '../maintenance/entities/maintenance-plan.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, VehicleDocument, VehicleLease, MaintenancePlan]),
  ],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
