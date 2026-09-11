import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { KmReadingService } from './km-readings.service';
import { KmReading } from './km-readings.entity';

@ApiTags('KmReading')
@Controller('km-readings')
export class KmReadingController {
  constructor(private readonly service: KmReadingService) {}

  @Get()
  findAll(@Query('vehicleCode') vehicleCode?: string) {
    return this.service.findAll(vehicleCode);
  }

  @Get('compute/:vehicleCode')
  compute(@Param('vehicleCode') vehicleCode: string) {
    return this.service.compute(vehicleCode);
  }

  @Post()
  create(@Body() body: Partial<KmReading>) {
    return this.service.create(body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
