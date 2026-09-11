import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BusinessUnit } from './business-units.entity';
import { BusinessUnitService } from './business-units.service';
import { BusinessUnitController } from './business-units.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BusinessUnit])],
  controllers: [BusinessUnitController],
  providers: [BusinessUnitService],
  exports: [BusinessUnitService],
})
export class BusinessUnitModule {}
