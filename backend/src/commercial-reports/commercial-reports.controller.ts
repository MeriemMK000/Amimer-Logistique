import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CommercialReportService } from './commercial-reports.service';
import { CommercialReport } from './commercial-reports.entity';

@ApiTags('CommercialReport')
@Controller('commercial-reports')
export class CommercialReportController {
  constructor(private readonly service: CommercialReportService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('pending')
  pending(@Query('month') month?: string) {
    return this.service.pending(month);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<CommercialReport>) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<CommercialReport>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
