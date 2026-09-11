import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MissionService } from './missions.service';
import { Mission } from './missions.entity';

@ApiTags('Mission')
@Controller('missions')
export class MissionController {
  constructor(private readonly service: MissionService) {}

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

  @Put('bulk')
  replaceAll(@Body() body: Partial<Mission>[]) {
    return this.service.replaceAll(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<Mission>) {
    return this.service.create(body);
  }

  /** Aperçu du regroupement de plusieurs demandes de prise en charge (trajet + répartition coûts). */
  @Post('group-preview')
  groupPreview(@Body() body: { dpcCodes: string[]; fromLoc?: string; toLoc?: string }) {
    return this.service.groupPreview(body?.dpcCodes ?? [], { fromLoc: body?.fromLoc, toLoc: body?.toLoc });
  }

  @Patch(':id/validate')
  validate(@Param('id') id: string) {
    return this.service.validateMission(id);
  }

  @Patch(':id/start')
  start(@Param('id') id: string) {
    return this.service.setPhase(id, 'start');
  }

  @Patch(':id/finish')
  finish(@Param('id') id: string) {
    return this.service.setPhase(id, 'finish');
  }

  /** Clôture d'une mission (fige les frais). */
  @Patch(':id/cloturer')
  cloturer(
    @Param('id') id: string,
    @Body() body?: { frais?: number; fraisDetail?: unknown; fraisCat?: string; fraisZone?: string },
  ) {
    return this.service.cloturer(id, body);
  }

  /** Clôture en masse de toutes les missions terminées (bouton onglet Frais). */
  @Post('cloturer-terminees')
  cloturerTerminees(
    @Body() body?: { fraisByNum?: Record<string, { frais?: number; fraisDetail?: unknown; fraisCat?: string; fraisZone?: string }> },
  ) {
    return this.service.cloturerTerminees(body?.fraisByNum);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<Mission>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
