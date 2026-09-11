import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ControlRequest } from './control-requests.entity';
import { ControlRequestService } from './control-requests.service';
import { ControlRequestController } from './control-requests.controller';
import { Vehicle } from '../vehicles/vehicles.entity';
import { MaintenanceOrder } from '../maintenance-orders/maintenance-orders.entity';
import { Evaluation } from '../evaluations/evaluations.entity';
import { Incident } from '../incidents/incidents.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ControlRequest, Vehicle, MaintenanceOrder, Evaluation, Incident])],
  controllers: [ControlRequestController],
  providers: [ControlRequestService],
  exports: [ControlRequestService],
})
export class ControlRequestModule {}
