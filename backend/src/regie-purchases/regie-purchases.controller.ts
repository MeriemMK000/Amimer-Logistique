import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { RegiePurchasesService } from './regie-purchases.service';
import { RegiePurchase } from './regie-purchase.entity';

@ApiTags('RegiePurchase')
@Controller('regie-purchases')
export class RegiePurchasesController {
  constructor(private readonly service: RegiePurchasesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('verify/:token')
  verify(@Param('token') token: string) {
    return this.service.verify(token);
  }

  @Get(':id/qr')
  qr(@Param('id') id: string, @Query('base') base?: string) {
    return this.service.qr(id, base);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<RegiePurchase>) {
    return this.service.create(body);
  }

  @Patch(':id/consume')
  consume(@Param('id') id: string, @Body() body: { actualLiters?: number; actualAmount?: number; actualDate?: string; station?: string }) {
    return this.service.consume(id, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<RegiePurchase>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
