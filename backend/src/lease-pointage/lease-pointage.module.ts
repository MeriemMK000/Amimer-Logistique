import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeasePointage } from './lease-pointage.entity';
import { LeasePointageService } from './lease-pointage.service';
import { LeasePointageController } from './lease-pointage.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeasePointage])],
  controllers: [LeasePointageController],
  providers: [LeasePointageService],
  exports: [LeasePointageService],
})
export class LeasePointageModule {}
