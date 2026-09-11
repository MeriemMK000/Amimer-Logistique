import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VehicleAssignmentService } from './vehicle-assignments.service';
import { VehicleAssignment } from './vehicle-assignments.entity';

@ApiTags('VehicleAssignment')
@Controller('vehicle-assignments')
export class VehicleAssignmentController {
  constructor(private readonly service: VehicleAssignmentService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('verify/:token')
  verify(@Param('token') token: string) {
    return this.service.verify(token);
  }

  @Get(':id/ordre')
  ordre(@Param('id') id: string, @Query('base') base?: string) {
    return this.service.ordreDeMission(id, base);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<VehicleAssignment>) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<VehicleAssignment>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
