import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual } from 'typeorm';
import { VehicleLease } from './vehicle-lease.entity';
import { CreateVehicleLeaseDto } from './dto/create-vehicle-lease.dto';
import { UpdateVehicleLeaseDto } from './dto/update-vehicle-lease.dto';
import { PaginationDto, PaginatedResultDto } from '../common/dto/pagination.dto';

@Injectable()
export class VehicleLeasesService {
  constructor(
    @InjectRepository(VehicleLease)
    private readonly leaseRepository: Repository<VehicleLease>,
  ) {}

  async create(createDto: CreateVehicleLeaseDto): Promise<VehicleLease> {
    const lease = this.leaseRepository.create(createDto);
    return this.leaseRepository.save(lease);
  }

  async findAll(paginationDto: PaginationDto, vehicleId?: string): Promise<PaginatedResultDto<VehicleLease>> {
    const where: Record<string, unknown> = {};
    if (vehicleId) where.vehicleId = vehicleId;

    const [data, total] = await this.leaseRepository.findAndCount({
      where,
      relations: { vehicle: true },
      skip: paginationDto.skip,
      take: paginationDto.limit,
      order: { createdAt: 'DESC' },
    });
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOne(id: string): Promise<VehicleLease> {
    const lease = await this.leaseRepository.findOne({
      where: { id },
      relations: { vehicle: true },
    });
    if (!lease) {
      throw new NotFoundException(`Contrat de location #${id} non trouve`);
    }
    return lease;
  }

  async update(id: string, updateDto: UpdateVehicleLeaseDto): Promise<VehicleLease> {
    const lease = await this.findOne(id);
    Object.assign(lease, updateDto);
    return this.leaseRepository.save(lease);
  }

  async remove(id: string): Promise<void> {
    const lease = await this.findOne(id);
    await this.leaseRepository.remove(lease);
  }

  async findExpiring(daysAhead: number = 60): Promise<VehicleLease[]> {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return this.leaseRepository.find({
      where: {
        endDate: LessThanOrEqual(futureDate),
      },
      relations: { vehicle: true },
      order: { endDate: 'ASC' },
    });
  }
}
