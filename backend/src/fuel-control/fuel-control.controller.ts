import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FuelControlService } from './fuel-control.service';
import { MonthlyKmReading } from './monthly-km-reading.entity';

@ApiTags('FuelControl')
@Controller('fuel-control')
export class FuelControlController {
  constructor(private readonly service: FuelControlService) {}

  @Get('readings')
  readings(@Query('month') month?: string) {
    return this.service.findReadings(month);
  }

  @Post('readings')
  upsertReading(@Body() body: Partial<MonthlyKmReading>) {
    return this.service.upsertReading(body);
  }

  @Get('month/:month')
  monthReport(@Param('month') month: string) {
    return this.service.monthReport(month);
  }

  /** Suivi de conformité des relevés (retour DG) : qui a donné km+réservoir DÉBUT / FIN. */
  @Get('releve-suivi/:month')
  releveSuivi(@Param('month') month: string) {
    return this.service.releveSuivi(month);
  }

  /** Bilan carburant visuel de la période (stock début + appros − conso ventilée = stock fin). */
  @Get('bilan/:month')
  bilan(@Param('month') month: string, @Query('site') site?: string) {
    return this.service.bilanCarburant(month, site);
  }

  /** Consommation cumulée (missions + vie sur site) des véhicules / engins d'un chantier. */
  @Get('site-summary')
  siteSummary(@Query('site') site: string, @Query('month') month: string) {
    return this.service.siteFuelSummary(site, month);
  }

  /** Déclaration km d'un véhicule (aussi utilisée depuis l'app chauffeur). */
  @Post('declare')
  declare(@Body() body: { vehicleCode: string; month: string; kmEnd: number; hoursEnd?: number; photoId?: string; by?: string }) {
    return this.service.declareKm(body.vehicleCode, body.month, body.kmEnd, { hoursEnd: body.hoursEnd, photoId: body.photoId, by: body.by });
  }

  @Post('run/missing-km-alert')
  runMissing() {
    return this.service.refreshMissingKmAlert();
  }
}
