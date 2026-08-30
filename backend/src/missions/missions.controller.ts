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
import { MissionsService } from './missions.service';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, MissionStatus } from '../common/enums';

@ApiTags('Missions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('missions')
export class MissionsController {
  constructor(private readonly missionsService: MissionsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.DISPATCHEUR)
  @ApiOperation({ summary: 'Creer une mission' })
  create(@Body() createMissionDto: CreateMissionDto) {
    return this.missionsService.create(createMissionDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les missions' })
  @ApiQuery({ name: 'status', enum: MissionStatus, required: false })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('status') status?: MissionStatus,
    @Query('vehicleId') vehicleId?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.missionsService.findAll(paginationDto, { status, vehicleId, driverId });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir une mission par ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.missionsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.DISPATCHEUR)
  @ApiOperation({ summary: 'Modifier une mission' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateMissionDto: UpdateMissionDto,
  ) {
    return this.missionsService.update(id, updateMissionDto);
  }

  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.DISPATCHEUR, UserRole.CHAUFFEUR)
  @ApiOperation({ summary: 'Changer le statut de la mission' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: MissionStatus,
  ) {
    return this.missionsService.updateStatus(id, status);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer une mission' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.missionsService.remove(id);
  }
}
