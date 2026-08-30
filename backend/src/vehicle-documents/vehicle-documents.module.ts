import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleDocumentsService } from './vehicle-documents.service';
import { VehicleDocumentsController } from './vehicle-documents.controller';
import { VehicleDocument } from './vehicle-document.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VehicleDocument])],
  controllers: [VehicleDocumentsController],
  providers: [VehicleDocumentsService],
  exports: [VehicleDocumentsService],
})
export class VehicleDocumentsModule {}
