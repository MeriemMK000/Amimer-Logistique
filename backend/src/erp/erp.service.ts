import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErpExport } from './entities/erp-export.entity';
import { ErpImport } from './entities/erp-import.entity';
import { CreateErpExportDto } from './dto/create-erp-export.dto';
import { CreateErpImportDto } from './dto/create-erp-import.dto';
import { PaginationDto, PaginatedResultDto } from '../common/dto/pagination.dto';

@Injectable()
export class ErpService {
  constructor(
    @InjectRepository(ErpExport)
    private readonly exportRepository: Repository<ErpExport>,
    @InjectRepository(ErpImport)
    private readonly importRepository: Repository<ErpImport>,
  ) {}

  // === Exports ===

  async createExport(createDto: CreateErpExportDto): Promise<ErpExport> {
    const erpExport = this.exportRepository.create({
      ...createDto,
      status: 'PENDING',
    });
    return this.exportRepository.save(erpExport);
  }

  async findAllExports(paginationDto: PaginationDto): Promise<PaginatedResultDto<ErpExport>> {
    const [data, total] = await this.exportRepository.findAndCount({
      skip: paginationDto.skip,
      take: paginationDto.limit,
      order: { createdAt: 'DESC' },
    });
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOneExport(id: string): Promise<ErpExport> {
    const erpExport = await this.exportRepository.findOne({ where: { id } });
    if (!erpExport) {
      throw new NotFoundException(`Export ERP #${id} non trouve`);
    }
    return erpExport;
  }

  async processExport(id: string): Promise<ErpExport> {
    const erpExport = await this.findOneExport(id);
    erpExport.status = 'EXPORTED';
    erpExport.exportedAt = new Date();
    return this.exportRepository.save(erpExport);
  }

  // === Imports ===

  async createImport(createDto: CreateErpImportDto): Promise<ErpImport> {
    const erpImport = this.importRepository.create({
      ...createDto,
      status: 'PENDING',
    });
    return this.importRepository.save(erpImport);
  }

  async findAllImports(paginationDto: PaginationDto): Promise<PaginatedResultDto<ErpImport>> {
    const [data, total] = await this.importRepository.findAndCount({
      relations: { vehicle: true },
      skip: paginationDto.skip,
      take: paginationDto.limit,
      order: { createdAt: 'DESC' },
    });
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOneImport(id: string): Promise<ErpImport> {
    const erpImport = await this.importRepository.findOne({
      where: { id },
      relations: { vehicle: true },
    });
    if (!erpImport) {
      throw new NotFoundException(`Import ERP #${id} non trouve`);
    }
    return erpImport;
  }

  async processImport(id: string): Promise<ErpImport> {
    const erpImport = await this.findOneImport(id);
    erpImport.status = 'IMPORTED';
    erpImport.importedAt = new Date();
    return this.importRepository.save(erpImport);
  }
}
