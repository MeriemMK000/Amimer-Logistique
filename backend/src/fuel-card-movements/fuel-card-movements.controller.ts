import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FuelCardMovementService } from './fuel-card-movements.service';
import { FuelCardMovement } from './fuel-card-movements.entity';

@ApiTags('FuelCardMovement')
@Controller('fuel-card-movements')
export class FuelCardMovementController {
  constructor(private readonly service: FuelCardMovementService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<FuelCardMovement>) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<FuelCardMovement>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
