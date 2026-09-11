import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ExternalVehicleService } from './external-vehicles.service';
import { ExternalVehicle } from './external-vehicles.entity';

@ApiTags('ExternalVehicle')
@Controller('external-vehicles')
export class ExternalVehicleController {
  constructor(private readonly service: ExternalVehicleService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<ExternalVehicle>) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<ExternalVehicle>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
