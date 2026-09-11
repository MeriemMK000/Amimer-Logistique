import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalVehicle } from './external-vehicles.entity';
import { ExternalVehicleService } from './external-vehicles.service';
import { ExternalVehicleController } from './external-vehicles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ExternalVehicle])],
  controllers: [ExternalVehicleController],
  providers: [ExternalVehicleService],
  exports: [ExternalVehicleService],
})
export class ExternalVehicleModule {}
