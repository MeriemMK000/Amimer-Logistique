import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MaintenanceOrder } from './maintenance-orders.entity';
import { MaintenanceFlag } from './maintenance-flag.entity';
import { MaintenanceOrderService } from './maintenance-orders.service';
import { MaintenanceOrderController } from './maintenance-orders.controller';
import { Vehicle } from '../vehicles/vehicles.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceOrder, MaintenanceFlag, Vehicle])],
  controllers: [MaintenanceOrderController],
  providers: [MaintenanceOrderService],
  exports: [MaintenanceOrderService],
})
export class MaintenanceOrderModule {}
