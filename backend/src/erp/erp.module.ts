import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErpService } from './erp.service';
import { ErpController } from './erp.controller';
import { ErpExport } from './entities/erp-export.entity';
import { ErpImport } from './entities/erp-import.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ErpExport, ErpImport])],
  controllers: [ErpController],
  providers: [ErpService],
  exports: [ErpService],
})
export class ErpModule {}
