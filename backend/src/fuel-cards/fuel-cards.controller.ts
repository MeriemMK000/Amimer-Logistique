import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FuelCardService } from './fuel-cards.service';
import { FuelCard } from './fuel-cards.entity';
import { FuelCardMovement } from '../fuel-card-movements/fuel-card-movements.entity';

@ApiTags('FuelCard')
@Controller('fuel-cards')
export class FuelCardController {
  constructor(private readonly service: FuelCardService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('summary')
  summary(@Query('month') month?: string) {
    return this.service.summary(month);
  }

  @Post('import')
  importCsv(@Body() body: { csv: string }) {
    return this.service.importCsv(body?.csv ?? '');
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<FuelCard>) {
    return this.service.create(body);
  }

  @Post(':id/movements')
  addMovement(@Param('id') id: string, @Body() body: Partial<FuelCardMovement>) {
    return this.service.addMovement(id, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<FuelCard>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
