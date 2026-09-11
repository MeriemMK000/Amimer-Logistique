import { Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';

@ApiTags('Scheduler')
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly service: SchedulerService) {}

  /** Declenche manuellement le rafraichissement des alertes d'echeance. */
  @Post('run/maintenance-alerts')
  runMaintenanceAlerts() {
    return this.service.refreshMaintenanceAlerts();
  }

  /** Declenche manuellement le controle d'equilibre chauffeurs / vehicules. */
  @Post('run/driver-balance')
  runDriverBalance() {
    return this.service.refreshDriverBalanceAlert();
  }

  /** Simulation d'equilibre flotte / chauffeurs sur N jours (defaut 14). */
  @Get('fleet-balance')
  fleetBalance(@Query('days') days?: string) {
    return this.service.simulateFleetBalance(days ? Math.min(60, Math.max(1, +days)) : 14);
  }

  /** Recalcule toutes les alertes automatiques. */
  @Post('run/all')
  runAll() {
    return this.service.refreshAll();
  }
}
