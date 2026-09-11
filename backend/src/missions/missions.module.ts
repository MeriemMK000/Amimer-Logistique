import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Mission } from './missions.entity';
import { MissionService } from './missions.service';
import { MissionController } from './missions.controller';
import { ProposalService } from './proposal.service';
import { ProposalController } from './proposal.controller';
import { Driver } from '../drivers/drivers.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { MaintenanceOrder } from '../maintenance-orders/maintenance-orders.entity';
import { Alert } from '../alerts/alerts.entity';
import { DpcRequest } from '../dpc-requests/dpc-requests.entity';
import { PecRequest } from '../pec-requests/pec-requests.entity';
import { VehicleAssignment } from '../vehicle-assignments/vehicle-assignments.entity';
import { AppConfigModule } from '../app-config/app-config.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { GeoModule } from '../geo/geo.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Mission, Driver, Vehicle, MaintenanceOrder, Alert, DpcRequest, PecRequest, VehicleAssignment]),
    AppConfigModule, NotificationsModule, GeoModule,
  ],
  controllers: [MissionController, ProposalController],
  providers: [MissionService, ProposalService],
  exports: [MissionService, ProposalService],
})
export class MissionModule {}
