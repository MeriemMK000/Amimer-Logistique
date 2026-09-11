import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExternalInvoiceService } from './external-invoices.service';
import { ExternalInvoice } from './external-invoice.entity';

@ApiTags('ExternalInvoice')
@Controller('external-invoices')
export class ExternalInvoiceController {
  constructor(private readonly service: ExternalInvoiceService) {}

  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() body: Partial<ExternalInvoice>) { return this.service.create(body); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: Partial<ExternalInvoice>) { return this.service.update(id, body); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
