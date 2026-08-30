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
import { VehicleAssignmentsService } from './vehicle-assignments.service';
import { CreateVehicleAssignmentDto } from './dto/create-vehicle-assignment.dto';
import { UpdateVehicleAssignmentDto } from './dto/update-vehicle-assignment.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Affectations Vehicules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicle-assignments')
export class VehicleAssignmentsController {
  constructor(private readonly assignmentsService: VehicleAssignmentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.DISPATCHEUR)
  @ApiOperation({ summary: 'Affecter un vehicule a un chauffeur' })
  create(@Body() createDto: CreateVehicleAssignmentDto) {
    return this.assignmentsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les affectations' })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('vehicleId') vehicleId?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.assignmentsService.findAll(paginationDto, vehicleId, driverId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir une affectation par ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.assignmentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.DISPATCHEUR)
  @ApiOperation({ summary: 'Modifier une affectation' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateVehicleAssignmentDto,
  ) {
    return this.assignmentsService.update(id, updateDto);
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.DISPATCHEUR)
  @ApiOperation({ summary: 'Desactiver une affectation' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.assignmentsService.deactivate(id);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer une affectation' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.assignmentsService.remove(id);
  }
}
