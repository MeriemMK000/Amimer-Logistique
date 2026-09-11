import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaseContract } from './lease-contracts.entity';
import { LeaseContractService } from './lease-contracts.service';
import { LeaseContractController } from './lease-contracts.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LeaseContract])],
  controllers: [LeaseContractController],
  providers: [LeaseContractService],
  exports: [LeaseContractService],
})
export class LeaseContractModule {}
