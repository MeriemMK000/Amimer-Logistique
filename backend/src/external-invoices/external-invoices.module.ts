import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalInvoice } from './external-invoice.entity';
import { ExternalInvoiceService } from './external-invoices.service';
import { ExternalInvoiceController } from './external-invoices.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ExternalInvoice])],
  controllers: [ExternalInvoiceController],
  providers: [ExternalInvoiceService],
  exports: [ExternalInvoiceService],
})
export class ExternalInvoiceModule {}
