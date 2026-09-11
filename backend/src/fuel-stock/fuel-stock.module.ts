import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FuelStockOp } from './fuel-stock.entity';
import { FuelStockService } from './fuel-stock.service';
import { FuelStockController } from './fuel-stock.controller';
import { FuelEntry } from '../fuel-entries/fuel-entries.entity';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [TypeOrmModule.forFeature([FuelStockOp, FuelEntry]), AppConfigModule],
  controllers: [FuelStockController],
  providers: [FuelStockService],
  exports: [FuelStockService],
})
export class FuelStockModule {}
