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
import { VehicleDocumentsService } from './vehicle-documents.service';
import { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import { UpdateVehicleDocumentDto } from './dto/update-vehicle-document.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Documents Vehicules')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vehicle-documents')
export class VehicleDocumentsController {
  constructor(private readonly vehicleDocumentsService: VehicleDocumentsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Ajouter un document vehicule' })
  create(@Body() createDto: CreateVehicleDocumentDto) {
    return this.vehicleDocumentsService.create(createDto);
  }

  @Get()
  @ApiOperation({ summary: 'Lister les documents' })
  @ApiQuery({ name: 'vehicleId', required: false })
  findAll(@Query() paginationDto: PaginationDto, @Query('vehicleId') vehicleId?: string) {
    return this.vehicleDocumentsService.findAll(paginationDto, vehicleId);
  }

  @Get('expiring')
  @ApiOperation({ summary: 'Documents expirant bientot' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  findExpiring(@Query('days') days?: number) {
    return this.vehicleDocumentsService.findExpiring(days || 30);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un document par ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicleDocumentsService.findOne(id);
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Modifier un document' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateVehicleDocumentDto,
  ) {
    return this.vehicleDocumentsService.update(id, updateDto);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer un document' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vehicleDocumentsService.remove(id);
  }
}
