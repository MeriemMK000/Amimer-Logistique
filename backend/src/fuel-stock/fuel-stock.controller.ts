import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FuelStockService } from './fuel-stock.service';
import { FuelStockOp } from './fuel-stock.entity';

@ApiTags('FuelStock')
@Controller('fuel-stock')
export class FuelStockController {
  constructor(private readonly service: FuelStockService) {}

  @Get()
  findAll(@Query('site') site?: string) {
    return this.service.findAll(site);
  }

  @Get('balance')
  balance(@Query('site') site?: string, @Query('month') month?: string) {
    return this.service.balance(site, month);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<FuelStockOp>) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<FuelStockOp>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
