import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { MissionZonesService } from './mission-zones.service';
import { CreateMissionZoneDto } from './dto/create-mission-zone.dto';
import { UpdateMissionZoneDto } from './dto/update-mission-zone.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Zones de Mission')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('mission-zones')
export class MissionZonesController {
  constructor(private readonly missionZonesService: MissionZonesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.DISPATCHEUR)
  @ApiOperation({ summary: 'Creer une zone de mission' })
  create(@Body() createDto: CreateMissionZoneDto) {
    return this.missionZonesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister toutes les zones' })
  findAll() {
    return this.missionZonesService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir une zone par ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.missionZonesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Modifier une zone' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMissionZoneDto,
  ) {
    return this.missionZonesService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer une zone' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.missionZonesService.remove(id);
  }
}
