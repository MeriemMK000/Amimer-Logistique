import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EngineFuelEntry } from './engine-fuel-entries.entity';
import { EngineFuelEntryService } from './engine-fuel-entries.service';
import { EngineFuelEntryController } from './engine-fuel-entries.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EngineFuelEntry])],
  controllers: [EngineFuelEntryController],
  providers: [EngineFuelEntryService],
  exports: [EngineFuelEntryService],
})
export class EngineFuelEntryModule {}
