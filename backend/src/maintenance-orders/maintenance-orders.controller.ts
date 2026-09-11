import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MaintenanceOrderService } from './maintenance-orders.service';
import { MaintenanceOrder } from './maintenance-orders.entity';

@ApiTags('MaintenanceOrder')
@Controller('maintenance-orders')
export class MaintenanceOrderController {
  constructor(private readonly service: MaintenanceOrderService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('kpis')
  kpis(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.kpis(from, to);
  }

  @Get('flags')
  flags(@Query('vehicleCode') vehicleCode?: string) {
    return this.service.listFlags(vehicleCode);
  }

  @Put('bulk')
  replaceAll(@Body() body: Partial<MaintenanceOrder>[]) {
    return this.service.replaceAll(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<MaintenanceOrder>) {
    return this.service.create(body);
  }

  @Patch(':id/status')
  changeStatus(@Param('id') id: string, @Body() body: { status: string; note?: string }) {
    return this.service.changeStatus(id, body.status, body.note);
  }

  @Patch(':id/holder-validate')
  holderValidate(@Param('id') id: string, @Body() body: { by?: string }) {
    return this.service.holderValidate(id, body?.by);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<MaintenanceOrder>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
