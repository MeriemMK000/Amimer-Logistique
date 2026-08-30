import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { ErpService } from './erp.service';
import { CreateErpExportDto } from './dto/create-erp-export.dto';
import { CreateErpImportDto } from './dto/create-erp-import.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums';

@ApiTags('ERP Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.COMPTABLE)
@Controller('erp')
export class ErpController {
  constructor(private readonly erpService: ErpService) {}

  // === Exports ===

  @Post('exports')
  @ApiOperation({ summary: 'Creer un export ERP' })
  createExport(@Body() createDto: CreateErpExportDto) {
    return this.erpService.createExport(createDto);
  }

  @Get('exports')
  @ApiOperation({ summary: 'Lister les exports ERP' })
  findAllExports(@Query() paginationDto: PaginationDto) {
    return this.erpService.findAllExports(paginationDto);
  }

  @Get('exports/:id')
  @ApiOperation({ summary: 'Obtenir un export par ID' })
  findOneExport(@Param('id', ParseUUIDPipe) id: string) {
    return this.erpService.findOneExport(id);
  }

  @Patch('exports/:id/process')
  @ApiOperation({ summary: 'Traiter un export ERP' })
  processExport(@Param('id', ParseUUIDPipe) id: string) {
    return this.erpService.processExport(id);
  }

  // === Imports ===

  @Post('imports')
  @ApiOperation({ summary: 'Creer un import ERP' })
  createImport(@Body() createDto: CreateErpImportDto) {
    return this.erpService.createImport(createDto);
  }

  @Get('imports')
  @ApiOperation({ summary: 'Lister les imports ERP' })
  findAllImports(@Query() paginationDto: PaginationDto) {
    return this.erpService.findAllImports(paginationDto);
  }

  @Get('imports/:id')
  @ApiOperation({ summary: 'Obtenir un import par ID' })
  findOneImport(@Param('id', ParseUUIDPipe) id: string) {
    return this.erpService.findOneImport(id);
  }

  @Patch('imports/:id/process')
  @ApiOperation({ summary: 'Traiter un import ERP' })
  processImport(@Param('id', ParseUUIDPipe) id: string) {
    return this.erpService.processImport(id);
  }
}
