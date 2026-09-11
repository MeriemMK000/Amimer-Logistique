import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RegiePurchase } from './regie-purchase.entity';
import { RegiePurchasesService } from './regie-purchases.service';
import { RegiePurchasesController } from './regie-purchases.controller';
import { FuelEntry } from '../fuel-entries/fuel-entries.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [TypeOrmModule.forFeature([RegiePurchase, FuelEntry, Vehicle]), AppConfigModule],
  controllers: [RegiePurchasesController],
  providers: [RegiePurchasesService],
  exports: [RegiePurchasesService],
})
export class RegiePurchasesModule {}
