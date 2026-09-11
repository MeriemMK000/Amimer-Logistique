import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DpcRequest } from './dpc-requests.entity';
import { DpcRequestService } from './dpc-requests.service';
import { DpcRequestController } from './dpc-requests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DpcRequest])],
  controllers: [DpcRequestController],
  providers: [DpcRequestService],
  exports: [DpcRequestService],
})
export class DpcRequestModule {}
