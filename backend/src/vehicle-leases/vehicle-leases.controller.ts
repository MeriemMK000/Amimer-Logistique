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
import { VehicleLeasesService } from './vehicle-leases.service';
import { CreateVehicleLeaseDto } from './dto/create-vehicle-lease.dto';
import { UpdateVehicleLeaseDto } from './dto/update-vehicle-lease.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Contrats Location')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicle-leases')
export class VehicleLeasesController {
  constructor(private readonly vehicleLeasesService: VehicleLeasesService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Creer un contrat de location' })
  create(@Body() createDto: CreateVehicleLeaseDto) {
    return this.vehicleLeasesService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les contrats de location' })
  @ApiQuery({ name: 'vehicleId', required: false })
  findAll(@Query() paginationDto: PaginationDto, @Query('vehicleId') vehicleId?: string) {
    return this.vehicleLeasesService.findAll(paginationDto, vehicleId);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Contrats expirant bientot' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  findExpiring(@Query('days') days?: number) {
    return this.vehicleLeasesService.findExpiring(days || 60);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un contrat par ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicleLeasesService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Modifier un contrat' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateVehicleLeaseDto,
  ) {
    return this.vehicleLeasesService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer un contrat' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicleLeasesService.remove(id);
  }
}
