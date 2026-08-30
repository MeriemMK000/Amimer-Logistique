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
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole, VehicleType, VehicleStatus, OwnershipType } from '../common/enums';

@ApiTags('Vehicules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Creer un vehicule' })
  create(@Body() createVehicleDto: CreateVehicleDto) {
    return this.vehiclesService.create(createVehicleDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les vehicules avec filtres' })
  @ApiQuery({ name: 'type', enum: VehicleType, required: false })
  @ApiQuery({ name: 'status', enum: VehicleStatus, required: false })
  @ApiQuery({ name: 'ownershipType', enum: OwnershipType, required: false })
  findAll(
    @Query() paginationDto: PaginationDto,
    @Query('type') type?: VehicleType,
    @Query('status') status?: VehicleStatus,
    @Query('ownershipType') ownershipType?: OwnershipType,
  ) {
    return this.vehiclesService.findAll(paginationDto, { type, status, ownershipType });
  }

  @Get('stats')
  @ApiOperation({ summary: 'Statistiques du parc vehicules' })
  getStats() {
    return this.vehiclesService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un vehicule par ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Modifier un vehicule' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(id, updateVehicleDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer un vehicule' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehiclesService.remove(id);
  }
}
