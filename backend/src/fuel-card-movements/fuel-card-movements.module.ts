import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FuelCardMovement } from './fuel-card-movements.entity';
import { FuelCardMovementService } from './fuel-card-movements.service';
import { FuelCardMovementController } from './fuel-card-movements.controller';
import { FuelEntry } from '../fuel-entries/fuel-entries.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [TypeOrmModule.forFeature([FuelCardMovement, FuelEntry, Vehicle]), AppConfigModule],
  controllers: [FuelCardMovementController],
  providers: [FuelCardMovementService],
  exports: [FuelCardMovementService],
})
export class FuelCardMovementModule implements OnModuleInit {
  constructor(private readonly service: FuelCardMovementService) {}
  async onModuleInit(): Promise<void> {
    // Rattrape les passages de carte sans plein lié (migration douce vers le registre unique).
    setTimeout(() => { this.service.syncLinkedFuelEntries().catch(() => undefined); }, 4000);
  }
}
