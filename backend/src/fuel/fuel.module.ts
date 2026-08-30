import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FuelService } from './fuel.service';
import { FuelController } from './fuel.controller';
import { FuelEntry } from './entities/fuel-entry.entity';
import { ConstructorNorm } from './entities/constructor-norm.entity';
import { FuelAnalysis } from './entities/fuel-analysis.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FuelEntry, ConstructorNorm, FuelAnalysis]),
  ],
  controllers: [FuelController],
  providers: [FuelService],
  exports: [FuelService],
})
export class FuelModule {}
