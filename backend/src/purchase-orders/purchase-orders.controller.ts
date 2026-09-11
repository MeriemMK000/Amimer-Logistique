import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PurchaseOrderService } from './purchase-orders.service';
import { PurchaseOrder } from './purchase-orders.entity';

@ApiTags('PurchaseOrder')
@Controller('purchase-orders')
export class PurchaseOrderController {
  constructor(private readonly service: PurchaseOrderService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Put('bulk')
  replaceAll(@Body() body: Partial<PurchaseOrder>[]) {
    return this.service.replaceAll(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<PurchaseOrder>) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<PurchaseOrder>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
