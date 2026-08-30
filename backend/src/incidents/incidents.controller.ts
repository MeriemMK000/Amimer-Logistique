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
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, IncidentStatus } from '../common/enums';

@ApiTags('Incidents')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.CHAUFFEUR)
  @ApiOperation({ summary: 'Declarer un incident' })
  create(@Body() createDto: CreateIncidentDto) {
    return this.incidentsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les incidents' })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'status', enum: IncidentStatus, required: false })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('vehicleId') vehicleId?: string,
    @Query('status') status?: IncidentStatus,
  ) {
    return this.incidentsService.findAll(paginationDto, vehicleId, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un incident par ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Modifier un incident' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateIncidentDto,
  ) {
    return this.incidentsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer un incident' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidentsService.remove(id);
  }
}
