import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { VehicleDocument } from './vehicle-document.entity';
import { CreateVehicleDocumentDto } from './dto/create-vehicle-document.dto';
import { UpdateVehicleDocumentDto } from './dto/update-vehicle-document.dto';
import { PaginationDto, PaginatedResultDto } from '../common/dto/pagination.dto';

@Injectable()
export class VehicleDocumentsService {
  constructor(
    @InjectRepository(VehicleDocument)
    private readonly documentRepository: Repository<VehicleDocument>,
  ) {}

  async create(createDto: CreateVehicleDocumentDto): Promise<VehicleDocument> {
    const document = this.documentRepository.create(createDto);
    return this.documentRepository.save(document);
  }

  async findAll(paginationDto: PaginationDto, vehicleId?: string): Promise<PaginatedResultDto<VehicleDocument>> {
    const where: Record<string, unknown> = {};
    if (vehicleId) where.vehicleId = vehicleId;

    const [data, total] = await this.documentRepository.findAndCount({
      where,
      relations: { vehicle: true },
      skip: paginationDto.skip,
      take: paginationDto.limit,
      order: { createdAt: 'DESC' },
    });
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOne(id: string): Promise<VehicleDocument> {
    const document = await this.documentRepository.findOne({
      where: { id },
      relations: { vehicle: true },
    });
    if (!document) {
      throw new NotFoundException(`Document #${id} non trouve`);
    }
    return document;
  }

  async update(id: string, updateDto: UpdateVehicleDocumentDto): Promise<VehicleDocument> {
    const document = await this.findOne(id);
    Object.assign(document, updateDto);
    return this.documentRepository.save(document);
  }

  async remove(id: string): Promise<void> {
    const document = await this.findOne(id);
    await this.documentRepository.remove(document);
  }

  async findExpiring(daysAhead: number = 30): Promise<VehicleDocument[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.documentRepository.find({
      where: {
        expiryDate: LessThanOrEqual(futureDate),
      },
      relations: { vehicle: true },
      order: { expiryDate: 'ASC' },
    });
  }
}
