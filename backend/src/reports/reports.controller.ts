import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Rapports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Tableau de bord general de la flotte' })
  getDashboard() {
    return this.reportsService.getDashboard();
  }

  @Get('maintenance-costs')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.COMPTABLE)
  @ApiOperation({ summary: 'Rapport des couts de maintenance' })
  @ApiQuery({ name: 'period', required: false, enum: ['monthly', 'annual', 'pluriannual'] })
  getMaintenanceCosts(@Query('period') period?: string) {
    return this.reportsService.getMaintenanceCosts(period);
  }

  @Get('fuel-consumption')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.COMPTABLE)
  @ApiOperation({ summary: 'Rapport de consommation carburant' })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'period', required: false, enum: ['monthly', 'annual'] })
  getFuelConsumption(
    @Query('vehicleId') vehicleId?: string,
    @Query('period') period?: string,
  ) {
    return this.reportsService.getFuelConsumption(vehicleId, period);
  }

  @Get('fleet-status')
  @ApiOperation({ summary: 'Distribution de la flotte par type et statut' })
  getFleetStatus() {
    return this.reportsService.getFleetStatus();
  }

  @Get('driver-workload')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.DISPATCHEUR)
  @ApiOperation({ summary: 'Charge de travail par chauffeur' })
  getDriverWorkload() {
    return this.reportsService.getDriverWorkload();
  }

  @Get('problematic-vehicles')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Vehicules problematiques (couts eleves / incidents frequents)' })
  getProblematicVehicles() {
    return this.reportsService.getProblematicVehicles();
  }
}
