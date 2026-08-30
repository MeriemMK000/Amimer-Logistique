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
import { AlertsService } from './alerts.service';
import { CreateAlertDto } from './dto/create-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, AlertType } from '../common/enums';

@ApiTags('Alertes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Creer une alerte manuelle' })
  create(@Body() createDto: CreateAlertDto) {
    return this.alertsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les alertes' })
  @ApiQuery({ name: 'type', enum: AlertType, required: false })
  @ApiQuery({ name: 'unreadOnly', required: false, type: Boolean })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('type') type?: AlertType,
    @Query('unreadOnly') unreadOnly?: boolean,
  ) {
    return this.alertsService.findAll(paginationDto, type, unreadOnly);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Nombre d\'alertes non lues' })
  getUnreadCount() {
    return this.alertsService.getUnreadCount();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir une alerte par ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Modifier une alerte' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateAlertDto,
  ) {
    return this.alertsService.update(id, updateDto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Marquer comme lue' })
  markRead(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.markRead(id);
  }

  @Patch(':id/dismiss')
  @ApiOperation({ summary: 'Ignorer une alerte' })
  dismiss(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.dismiss(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer une alerte' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.alertsService.remove(id);
  }

  @Post('generate')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Generer les alertes (verification manuelle)' })
  generateAlerts() {
    return this.alertsService.runAllAlertChecks();
  }
}
