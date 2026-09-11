import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ControlRequestService } from './control-requests.service';
import { ControlRequest } from './control-requests.entity';

@ApiTags('ControlRequest')
@Controller('control-requests')
export class ControlRequestController {
  constructor(private readonly service: ControlRequestService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post('generate')
  generate() {
    return this.service.generate();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<ControlRequest>) {
    return this.service.create(body);
  }

  @Patch(':id/respond')
  respond(
    @Param('id') id: string,
    @Body() body: {
      km?: number; etat?: string; score?: number; note?: string; photoId?: string;
      categories?: { key: string; label: string; etat?: string; maintenance?: boolean; comment?: string }[];
    },
  ) {
    return this.service.respond(id, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<ControlRequest>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
