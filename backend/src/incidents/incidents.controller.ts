import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IncidentService, INCIDENT_STATUSES } from './incidents.service';
import { Incident } from './incidents.entity';

@ApiTags('Incident')
@Controller('incidents')
export class IncidentController {
  constructor(private readonly service: IncidentService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('statuses')
  statuses() {
    return INCIDENT_STATUSES;
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<Incident>) {
    return this.service.create(body);
  }

  @Patch(':id/status')
  changeStatus(@Param('id') id: string, @Body() body: { status: string; note?: string }) {
    return this.service.changeStatus(id, body.status, body.note);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<Incident>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
