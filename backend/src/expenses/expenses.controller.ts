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
import { ExpensesService } from './expenses.service';
import { CreateExpenseScaleDto } from './dto/create-expense-scale.dto';
import { UpdateExpenseScaleDto } from './dto/update-expense-scale.dto';
import { CreateMissionExpenseDto } from './dto/create-mission-expense.dto';
import { UpdateMissionExpenseDto } from './dto/update-mission-expense.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('Frais & Baremes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  // === Scales ===

  @Post('scales')
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @ApiOperation({ summary: 'Creer un bareme de frais' })
  createScale(@Body() createDto: CreateExpenseScaleDto) {
    return this.expensesService.createScale(createDto);
  }

  @Get('scales')
  @ApiOperation({ summary: 'Lister les baremes' })
  findAllScales(@Query() paginationDto: PaginationDto) {
    return this.expensesService.findAllScales(paginationDto);
  }

  @Get('scales/:id')
  @ApiOperation({ summary: 'Obtenir un bareme par ID' })
  findOneScale(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensesService.findOneScale(id);
  }

  @Patch('scales/:id')
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @ApiOperation({ summary: 'Modifier un bareme' })
  updateScale(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateExpenseScaleDto,
  ) {
    return this.expensesService.updateScale(id, updateDto);
  }

  @Delete('scales/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer un bareme' })
  removeScale(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensesService.removeScale(id);
  }

  // === Mission Expenses ===

  @Post('mission-expenses')
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Creer un frais de mission' })
  createExpense(@Body() createDto: CreateMissionExpenseDto) {
    return this.expensesService.createExpense(createDto);
  }

  @Get('mission-expenses')
  @ApiOperation({ summary: 'Lister les frais de mission' })
  @ApiQuery({ name: 'missionId', required: false })
  @ApiQuery({ name: 'driverId', required: false })
  findAllExpenses(
    @Query() paginationDto: PaginationDto,
    @Query('missionId') missionId?: string,
    @Query('driverId') driverId?: string,
  ) {
    return this.expensesService.findAllExpenses(paginationDto, missionId, driverId);
  }

  @Get('mission-expenses/:id')
  @ApiOperation({ summary: 'Obtenir un frais par ID' })
  findOneExpense(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensesService.findOneExpense(id);
  }

  @Patch('mission-expenses/:id')
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE)
  @ApiOperation({ summary: 'Modifier un frais' })
  updateExpense(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMissionExpenseDto,
  ) {
    return this.expensesService.updateExpense(id, updateDto);
  }

  @Delete('mission-expenses/:id')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Supprimer un frais' })
  removeExpense(@Param('id', ParseUUIDPipe) id: string) {
    return this.expensesService.removeExpense(id);
  }

  // === Auto-calculation ===

  @Post('calculate')
  @Roles(UserRole.ADMIN, UserRole.COMPTABLE, UserRole.GESTIONNAIRE_FLOTTE)
  @ApiOperation({ summary: 'Calculer automatiquement les frais de mission' })
  calculateExpenses(
    @Body() body: {
      missionId: string;
      driverId: string;
      zoneId?: string;
      days: number;
      distanceKm: number;
    },
  ) {
    return this.expensesService.calculateMissionExpenses(
      body.missionId,
      body.driverId,
      body.zoneId || null,
      body.days,
      body.distanceKm,
    );
  }
}
