import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PecRequest } from './pec-requests.entity';
import { PecRequestService } from './pec-requests.service';
import { PecRequestController } from './pec-requests.controller';
import { Mission } from '../missions/missions.entity';
import { MissionModule } from '../missions/missions.module';
import { AppConfigModule } from '../app-config/app-config.module';

@Module({
  imports: [TypeOrmModule.forFeature([PecRequest, Mission]), MissionModule, AppConfigModule],
  controllers: [PecRequestController],
  providers: [PecRequestService],
  exports: [PecRequestService],
})
export class PecRequestModule {}
