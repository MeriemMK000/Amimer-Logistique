import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { getDatabaseConfig } from './config/database.config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VehiclesModule } from './vehicles/vehicles.module';
import { VehicleDocumentsModule } from './vehicle-documents/vehicle-documents.module';
import { VehicleLeasesModule } from './vehicle-leases/vehicle-leases.module';
import { DriversModule } from './drivers/drivers.module';
import { VehicleAssignmentsModule } from './vehicle-assignments/vehicle-assignments.module';
import { MissionsModule } from './missions/missions.module';
import { MissionZonesModule } from './mission-zones/mission-zones.module';
import { MissionWaypointsModule } from './mission-waypoints/mission-waypoints.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { FuelModule } from './fuel/fuel.module';
import { IncidentsModule } from './incidents/incidents.module';
import { ExpensesModule } from './expenses/expenses.module';
import { AlertsModule } from './alerts/alerts.module';
import { ReportsModule } from './reports/reports.module';
import { ErpModule } from './erp/erp.module';
import { GpsModule } from './gps/gps.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: getDatabaseConfig,
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
    VehiclesModule,
    VehicleDocumentsModule,
    VehicleLeasesModule,
    DriversModule,
    VehicleAssignmentsModule,
    MissionsModule,
    MissionZonesModule,
    MissionWaypointsModule,
    MaintenanceModule,
    FuelModule,
    IncidentsModule,
    ExpensesModule,
    AlertsModule,
    ReportsModule,
    ErpModule,
    GpsModule,
  ],
})
export class AppModule {}
