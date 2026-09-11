import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FuelEntryService } from './fuel-entries.service';
import { FuelEntry } from './fuel-entries.entity';

@ApiTags('FuelEntry')
@Controller('fuel-entries')
export class FuelEntryController {
  constructor(private readonly service: FuelEntryService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Put('bulk')
  replaceAll(@Body() body: Partial<FuelEntry>[]) {
    return this.service.replaceAll(body);
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
  create(@Body() body: Partial<FuelEntry>) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<FuelEntry>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
