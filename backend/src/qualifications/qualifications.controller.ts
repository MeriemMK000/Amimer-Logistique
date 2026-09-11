import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { QualificationService } from './qualifications.service';
import { Qualification } from './qualifications.entity';

@ApiTags('Qualification')
@Controller('qualifications')
export class QualificationController {
  constructor(private readonly service: QualificationService) {}
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Post() create(@Body() body: Partial<Qualification>) { return this.service.create(body); }
  @Patch(':id') update(@Param('id') id: string, @Body() body: Partial<Qualification>) { return this.service.update(id, body); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
