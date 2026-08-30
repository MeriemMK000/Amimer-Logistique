import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { FuelService } from './fuel.service';
import { CreateFuelEntryDto } from './dto/create-fuel-entry.dto';
import { UpdateFuelEntryDto } from './dto/update-fuel-entry.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Carburant')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fuel')
export class FuelController {
  constructor(private readonly fuelService: FuelService) {}

  // === Entries ===

  @Post('entries')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.CHAUFFEUR)
  @ApiOperation({ summary: 'Saisir un plein de carburant' })
  createEntry(@Body() createDto: CreateFuelEntryDto) {
    return this.fuelService.createEntry(createDto);
  }

  @Post('entries/import')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Importer des saisies carburant (CSV/JSON)' })
  importEntries(@Body() entries: CreateFuelEntryDto[]) {
    return this.fuelService.importEntries(entries);
  }

  @Get('entries')
  @ApiOperation({ summary: 'Lister les saisies carburant' })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  findAllEntries(
    @Query() paginationDto: PaginationDto,
    @Query('vehicleId') vehicleId?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.fuelService.findAllEntries(paginationDto, vehicleId, driverId);
  }

  @Get('entries/:id')
  @ApiOperation({ summary: 'Obtenir une saisie par ID' })
  findOneEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.fuelService.findOneEntry(id);
  }

  @Patch('entries/:id')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Modifier une saisie' })
  updateEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateFuelEntryDto,
  ) {
    return this.fuelService.updateEntry(id, updateDto);
  }

  @Delete('entries/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer une saisie' })
  removeEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.fuelService.removeEntry(id);
  }

  // === Norms ===

  @Get('norms')
  @ApiOperation({ summary: 'Lister les normes constructeur' })
  findAllNorms() {
    return this.fuelService.findAllNorms();
  }

  @Post('norms')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Ajouter une norme constructeur' })
  createNorm(@Body() data: Record<string, unknown>) {
    return this.fuelService.createNorm(data);
  }

  // === Analysis ===

  @Post('analysis/:vehicleId')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Analyser la consommation d\'un vehicule' })
  analyzeConsumption(
    @Param('vehicleId', ParseUUIDPipe) vehicleId: string,
    @Body() body: { periodStart: string; periodEnd: string },
  ) {
    return this.fuelService.analyzeVehicleConsumption(
      vehicleId,
      new Date(body.periodStart),
      new Date(body.periodEnd),
    );
  }

  @Get('analyses')
  @ApiOperation({ summary: 'Lister les analyses de consommation' })
  @ApiQuery({ name: 'vehicleId', required: false })
  getAnalyses(@Query('vehicleId') vehicleId?: string) {
    return this.fuelService.getAnalyses(vehicleId);
  }

  @Get('anomalies')
  @ApiOperation({ summary: 'Detecter les anomalies de consommation' })
  getAnomalies() {
    return this.fuelService.getAnomalies();
  }
}
