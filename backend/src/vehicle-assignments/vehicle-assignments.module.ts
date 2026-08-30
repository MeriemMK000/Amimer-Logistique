import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleAssignmentsService } from './vehicle-assignments.service';
import { VehicleAssignmentsController } from './vehicle-assignments.controller';
import { VehicleAssignment } from './vehicle-assignment.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleAssignment])],
  controllers: [VehicleAssignmentsController],
  providers: [VehicleAssignmentsService],
  exports: [VehicleAssignmentsService],
})
export class VehicleAssignmentsModule {}
