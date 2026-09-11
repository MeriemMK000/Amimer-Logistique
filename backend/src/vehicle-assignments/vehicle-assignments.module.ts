import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleAssignment } from './vehicle-assignments.entity';
import { VehicleAssignmentService } from './vehicle-assignments.service';
import { VehicleAssignmentController } from './vehicle-assignments.controller';
import { Driver } from '../drivers/drivers.entity';
import { Vehicle } from '../vehicles/vehicles.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleAssignment, Driver, Vehicle])],
  controllers: [VehicleAssignmentController],
  providers: [VehicleAssignmentService],
  exports: [VehicleAssignmentService],
})
export class VehicleAssignmentModule {}
