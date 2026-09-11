import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EngineFuelEntryService } from './engine-fuel-entries.service';
import { EngineFuelEntry } from './engine-fuel-entries.entity';

@ApiTags('EngineFuelEntry')
@Controller('engine-fuel-entries')
export class EngineFuelEntryController {
  constructor(private readonly service: EngineFuelEntryService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Put('bulk')
  replaceAll(@Body() body: Partial<EngineFuelEntry>[]) {
    return this.service.replaceAll(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<EngineFuelEntry>) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<EngineFuelEntry>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
