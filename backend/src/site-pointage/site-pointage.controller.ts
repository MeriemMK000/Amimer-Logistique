import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SitePointageService } from './site-pointage.service';
import { SitePointage } from './site-pointage.entity';

@ApiTags('SitePointage')
@Controller('site-pointage')
export class SitePointageController {
  constructor(private readonly service: SitePointageService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get('billing')
  billing(@Query('site') site?: string, @Query('month') month?: string) {
    return this.service.billing(site, month);
  }

  /** Contrôle des factures fournisseurs pour les véhicules / engins externes (pointé vs facturé). */
  @Get('external-control')
  externalControl(@Query('site') site?: string, @Query('month') month?: string) {
    return this.service.externalControl(site, month);
  }

  @Post('import')
  importCsv(@Body() body: { csv: string }) {
    return this.service.importCsv(body?.csv ?? '');
  }

  /** Saisie rapide grille (site × engin × jour) — meme principe que le pointage location. */
  @Post('upsert-many')
  upsertMany(
    @Body()
    body: {
      siteCode: string; targetCode: string; date: string; fraction: number;
      immobilized?: boolean; targetType?: string; dayPrice?: number;
      businessUnit?: string; ca?: string; note?: string;
      fuelLiters?: number | null; kmStart?: number | null; kmEnd?: number | null;
      hoursStart?: number | null; hoursEnd?: number | null;
    }[],
  ) {
    return this.service.upsertMany(body ?? []);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: Partial<SitePointage>) {
    return this.service.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<SitePointage>) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
