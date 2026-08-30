import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleLeasesService } from './vehicle-leases.service';
import { VehicleLeasesController } from './vehicle-leases.controller';
import { VehicleLease } from './vehicle-lease.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleLease])],
  controllers: [VehicleLeasesController],
  providers: [VehicleLeasesService],
  exports: [VehicleLeasesService],
})
export class VehicleLeasesModule {}
