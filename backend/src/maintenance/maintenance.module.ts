import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceService } from './maintenance.service';
import { MaintenanceController } from './maintenance.controller';
import { MaintenancePlan } from './entities/maintenance-plan.entity';
import { MaintenanceOrder } from './entities/maintenance-order.entity';
import { MaintenancePart } from './entities/maintenance-part.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaintenancePlan, MaintenanceOrder, MaintenancePart]),
  ],
  controllers: [MaintenanceController],
  providers: [MaintenanceService],
  exports: [MaintenanceService],
})
export class MaintenanceModule {}
