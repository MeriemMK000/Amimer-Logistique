import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Incident } from './incidents.entity';
import { IncidentService } from './incidents.service';
import { IncidentController } from './incidents.controller';
import { Vehicle } from '../vehicles/vehicles.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Incident, Vehicle])],
  controllers: [IncidentController],
  providers: [IncidentService],
  exports: [IncidentService],
})
export class IncidentModule {}
