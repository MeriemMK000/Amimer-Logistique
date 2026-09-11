import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FuelEntry } from './fuel-entries.entity';
import { FuelEntryService } from './fuel-entries.service';
import { FuelEntryController } from './fuel-entries.controller';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [TypeOrmModule.forFeature([FuelEntry]), AppConfigModule],
  controllers: [FuelEntryController],
  providers: [FuelEntryService],
  exports: [FuelEntryService],
})
export class FuelEntryModule {}
