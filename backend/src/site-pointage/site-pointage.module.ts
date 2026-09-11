import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SitePointage } from './site-pointage.entity';
import { SitePointageService } from './site-pointage.service';
import { SitePointageController } from './site-pointage.controller';
import { FuelEntry } from '../fuel-entries/fuel-entries.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { ExternalVehicle } from '../external-vehicles/external-vehicles.entity';
import { ExternalInvoice } from '../external-invoices/external-invoice.entity';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [TypeOrmModule.forFeature([SitePointage, FuelEntry, Vehicle, ExternalVehicle, ExternalInvoice]), AppConfigModule],
  controllers: [SitePointageController],
  providers: [SitePointageService],
  exports: [SitePointageService],
})
export class SitePointageModule {}
