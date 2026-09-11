import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FuelCard } from './fuel-cards.entity';
import { FuelCardService } from './fuel-cards.service';
import { FuelCardController } from './fuel-cards.controller';
import { FuelCardMovement } from '../fuel-card-movements/fuel-card-movements.entity';
import { FuelCardMovementModule } from '../fuel-card-movements/fuel-card-movements.module';

@Module({
  imports: [TypeOrmModule.forFeature([FuelCard, FuelCardMovement]), FuelCardMovementModule],
  controllers: [FuelCardController],
  providers: [FuelCardService],
  exports: [FuelCardService],
})
export class FuelCardModule {}
