import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommercialReport } from './commercial-reports.entity';
import { CommercialReportService } from './commercial-reports.service';
import { CommercialReportController } from './commercial-reports.controller';
import { Vehicle } from '../vehicles/vehicles.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CommercialReport, Vehicle])],
  controllers: [CommercialReportController],
  providers: [CommercialReportService],
  exports: [CommercialReportService],
})
export class CommercialReportModule {}
