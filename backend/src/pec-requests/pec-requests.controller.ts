import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PecRequestService } from './pec-requests.service';
import { PecRequest } from './pec-requests.entity';
import { Mission } from '../missions/missions.entity';

@ApiTags('PecRequest')
@Controller('pec-requests')
export class PecRequestController {
  constructor(private readonly service: PecRequestService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  /** Formulaire public — aucun compte requis. */
  @Post()
  submit(@Body() body: Partial<PecRequest>) {
    return this.service.submit(body);
  }

  /** Import récurrent depuis la plateforme Amimer Énergie (CSV ou JSON). */
  @Post('import')
  import(@Body() body: { csv?: string; rows?: any[] }) {
    return this.service.import(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<PecRequest>) {
    return this.service.update(id, body);
  }

  @Patch(':id/validate')
  validate(@Param('id') id: string, @Body() body: { workLocation?: string }) {
    return this.service.validate(id, body?.workLocation);
  }

  @Post(':id/to-mission')
  toMission(@Param('id') id: string, @Body() body: Partial<Mission>) {
    return this.service.toMission(id, body ?? {});
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
