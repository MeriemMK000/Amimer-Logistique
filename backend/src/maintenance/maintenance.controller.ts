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
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenancePlanDto } from './dto/create-maintenance-plan.dto';
import { UpdateMaintenancePlanDto } from './dto/update-maintenance-plan.dto';
import { CreateMaintenanceOrderDto } from './dto/create-maintenance-order.dto';
import { UpdateMaintenanceOrderDto } from './dto/update-maintenance-order.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Maintenance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  // === Plans ===

  @Post('plans')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Creer un plan de maintenance' })
  createPlan(@Body() createDto: CreateMaintenancePlanDto) {
    return this.maintenanceService.createPlan(createDto);
  }

  @Get('plans')
  @ApiOperation({ summary: 'Lister les plans de maintenance' })
  @ApiQuery({ name: 'vehicleId', required: false })
  findAllPlans(@Query() paginationDto: PaginationDto, @Query('vehicleId') vehicleId?: string) {
    return this.maintenanceService.findAllPlans(paginationDto, vehicleId);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Obtenir un plan par ID' })
  findOnePlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.maintenanceService.findOnePlan(id);
  }

  @Patch('plans/:id')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Modifier un plan' })
  updatePlan(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMaintenancePlanDto,
  ) {
    return this.maintenanceService.updatePlan(id, updateDto);
  }

  @Delete('plans/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer un plan' })
  removePlan(@Param('id', ParseUUIDPipe) id: string) {
    return this.maintenanceService.removePlan(id);
  }

  // === Orders ===

  @Post('orders')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Creer un ordre de maintenance' })
  createOrder(@Body() createDto: CreateMaintenanceOrderDto) {
    return this.maintenanceService.createOrder(createDto);
  }

  @Get('orders')
  @ApiOperation({ summary: 'Lister les ordres de maintenance' })
  @ApiQuery({ name: 'vehicleId', required: false })
  @ApiQuery({ name: 'status', required: false })
  findAllOrders(
    @Query() paginationDto: PaginationDto,
    @Query('vehicleId') vehicleId?: string,
    @Query('status') status?: string,
  ) {
    return this.maintenanceService.findAllOrders(paginationDto, vehicleId, status);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Obtenir un ordre par ID' })
  findOneOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.maintenanceService.findOneOrder(id);
  }

  @Patch('orders/:id')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Modifier un ordre' })
  updateOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMaintenanceOrderDto,
  ) {
    return this.maintenanceService.updateOrder(id, updateDto);
  }

  @Delete('orders/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer un ordre' })
  removeOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.maintenanceService.removeOrder(id);
  }

  // === Costs ===

  @Get('costs/vehicle/:vehicleId')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.COMPTABLE)
  @ApiOperation({ summary: 'Couts de maintenance par vehicule' })
  getCostsByVehicle(@Param('vehicleId', ParseUUIDPipe) vehicleId: string) {
    return this.maintenanceService.getCostsByVehicle(vehicleId);
  }

  @Get('costs/summary')
  @Roles(UserRole.ADMIN, UserRole.GESTIONNAIRE_FLOTTE, UserRole.COMPTABLE)
  @ApiOperation({ summary: 'Resume des couts de maintenance' })
  @ApiQuery({ name: 'period', required: false, enum: ['monthly', 'annual', 'pluriannual'] })
  getCostsSummary(@Query('period') period?: string) {
    return this.maintenanceService.getCostsSummary(period);
  }
}
