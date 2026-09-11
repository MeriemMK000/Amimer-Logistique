import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { CommonModule } from './common/common.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AppConfigModule } from './app-config/app-config.module';
import { VehicleModule } from './vehicles/vehicles.module';
import { DriverModule } from './drivers/drivers.module';
import { MissionModule } from './missions/missions.module';
import { MaintenanceOrderModule } from './maintenance-orders/maintenance-orders.module';
import { MaintenancePlansModule } from './maintenance-plans/maintenance-plans.module';
import { TiresModule } from './tires/tires.module';
import { SupplierModule } from './suppliers/suppliers.module';
import { PurchaseOrderModule } from './purchase-orders/purchase-orders.module';
import { FuelEntryModule } from './fuel-entries/fuel-entries.module';
import { EngineFuelEntryModule } from './engine-fuel-entries/engine-fuel-entries.module';
import { DpcRequestModule } from './dpc-requests/dpc-requests.module';
import { LeaseContractModule } from './lease-contracts/lease-contracts.module';
import { LeasePointageModule } from './lease-pointage/lease-pointage.module';
import { AlertModule } from './alerts/alerts.module';
import { BusinessUnitModule } from './business-units/business-units.module';
import { KmReadingModule } from './km-readings/km-readings.module';
import { QualificationModule } from './qualifications/qualifications.module';
import { GpsModule } from './gps/gps.module';
import { EvaluationModule } from './evaluations/evaluations.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { VehicleAssignmentModule } from './vehicle-assignments/vehicle-assignments.module';
import { ExternalVehicleModule } from './external-vehicles/external-vehicles.module';
import { ExternalInvoiceModule } from './external-invoices/external-invoices.module';
import { SitePointageModule } from './site-pointage/site-pointage.module';
import { FuelCardModule } from './fuel-cards/fuel-cards.module';
import { FuelCardMovementModule } from './fuel-card-movements/fuel-card-movements.module';
import { FuelStockModule } from './fuel-stock/fuel-stock.module';
import { FuelControlModule } from './fuel-control/fuel-control.module';
import { RegiePurchasesModule } from './regie-purchases/regie-purchases.module';
import { CommercialReportModule } from './commercial-reports/commercial-reports.module';
import { IncidentModule } from './incidents/incidents.module';
import { ControlRequestModule } from './control-requests/control-requests.module';
import { MailModule } from './mail/mail.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PlacesModule } from './places/places.module';
import { GeoModule } from './geo/geo.module';
import { AccessTokenModule } from './access-tokens/access-tokens.module';
import { PecRequestModule } from './pec-requests/pec-requests.module';
import { DriverAppModule } from './driver-app/driver-app.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    CommonModule,
    AttachmentsModule,
    AppConfigModule,
    VehicleModule,
    DriverModule,
    MissionModule,
    MaintenanceOrderModule,
    MaintenancePlansModule,
    TiresModule,
    SupplierModule,
    PurchaseOrderModule,
    FuelEntryModule,
    EngineFuelEntryModule,
    DpcRequestModule,
    LeaseContractModule,
    LeasePointageModule,
    AlertModule,
    BusinessUnitModule,
    KmReadingModule,
    QualificationModule,
    GpsModule,
    EvaluationModule,
    SchedulerModule,
    VehicleAssignmentModule,
    ExternalVehicleModule,
    ExternalInvoiceModule,
    SitePointageModule,
    FuelCardModule,
    FuelCardMovementModule,
    FuelStockModule,
    FuelControlModule,
    RegiePurchasesModule,
    CommercialReportModule,
    IncidentModule,
    ControlRequestModule,
    MailModule,
    NotificationsModule,
    PlacesModule,
    GeoModule,
    AccessTokenModule,
    PecRequestModule,
    DriverAppModule,
  ],
})
export class AppModule {}
