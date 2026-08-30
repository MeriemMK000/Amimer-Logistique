import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from './incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { PaginationDto, PaginatedResultDto } from '../common/dto/pagination.dto';
import { IncidentStatus } from '../common/enums';

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
  ) {}

  async create(createDto: CreateIncidentDto): Promise<Incident> {
    const incident = this.incidentRepository.create(createDto);
    return this.incidentRepository.save(incident);
  }

  async findAll(
    paginationDto: PaginationDto,
    vehicleId?: string,
    status?: IncidentStatus,
  ): Promise<PaginatedResultDto<Incident>> {
    const qb = this.incidentRepository.createQueryBuilder('incident')
      .leftJoinAndSelect('incident.vehicle', 'vehicle')
      .leftJoinAndSelect('incident.driver', 'driver');

    if (vehicleId) {
      qb.andWhere('incident.vehicleId = :vehicleId', { vehicleId });
    }
    if (status) {
      qb.andWhere('incident.status = :status', { status });
    }

    qb.orderBy('incident.date', 'DESC')
      .skip(paginationDto.skip)
      .take(paginationDto.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOne(id: string): Promise<Incident> {
    const incident = await this.incidentRepository.findOne({
      where: { id },
      relations: { vehicle: true, driver: true },
    });
    if (!incident) {
      throw new NotFoundException(`Incident #${id} non trouve`);
    }
    return incident;
  }

  async update(id: string, updateDto: UpdateIncidentDto): Promise<Incident> {
    const incident = await this.findOne(id);
    Object.assign(incident, updateDto);
    return this.incidentRepository.save(incident);
  }

  async remove(id: string): Promise<void> {
    const incident = await this.findOne(id);
    await this.incidentRepository.remove(incident);
  }
}
