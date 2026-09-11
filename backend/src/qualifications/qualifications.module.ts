import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Qualification } from './qualifications.entity';
import { QualificationService } from './qualifications.service';
import { QualificationController } from './qualifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Qualification])],
  controllers: [QualificationController],
  providers: [QualificationService],
  exports: [QualificationService],
})
export class QualificationModule {}
