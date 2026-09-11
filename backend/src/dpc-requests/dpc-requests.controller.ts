import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DpcRequestService } from './dpc-requests.service';
import { DpcRequest } from './dpc-requests.entity';

@ApiTags('DpcRequest')
@Controller('dpc-requests')
export class DpcRequestController {
  constructor(private readonly service: DpcRequestService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Put('bulk')
  replaceAll(@Body() body: Partial<DpcRequest>[]) {
    return this.service.replaceAll(body);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<DpcRequest>) {
    return this.service.create(body);
  }

  /** Formulaire public — sans compte : injecte une demande dans la file DPC (EN_ATTENTE). */
  @Post('public')
  createPublic(@Body() body: {
    requesterName?: string; phone?: string; email?: string; organisation?: string; structure?: string;
    fromLoc?: string; toLoc?: string; dateAller?: string; dateRetour?: string; pax?: number;
    priorite?: string; bu?: string; notes?: string;
  }) {
    return this.service.createFromForm(body);
  }

  /** Import plateforme Amimer Énergie — demandes déjà validées → file DPC (VALIDEE). */
  @Post('import')
  importPlatform(@Body() body: { csv?: string; rows?: Record<string, unknown>[] }) {
    return this.service.importFromPlatform(body);
  }

  @Patch(':id/validate')
  validate(@Param('id') id: string) {
    return this.service.validate(id);
  }

  /** Demandes groupables dans une même mission (même axe + dates compatibles). */
  @Post('groupable')
  groupable(@Body() body: { fromLoc?: string; toLoc?: string; dateStart?: string; excludeCodes?: string[] }) {
    return this.service.groupable(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<DpcRequest>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
