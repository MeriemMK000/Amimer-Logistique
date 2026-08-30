import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { PaginationDto, PaginatedResultDto } from '../common/dto/pagination.dto';
import { VehicleType, VehicleStatus, OwnershipType } from '../common/enums';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
  ) {}

  async create(createVehicleDto: CreateVehicleDto): Promise<Vehicle> {
    const existing = await this.vehicleRepository.findOne({
      where: { code: createVehicleDto.code },
    });
    if (existing) {
      throw new ConflictException(`Un vehicule avec le code ${createVehicleDto.code} existe deja`);
    }

    const vehicle = this.vehicleRepository.create(createVehicleDto);
    return this.vehicleRepository.save(vehicle);
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: { type?: VehicleType; status?: VehicleStatus; ownershipType?: OwnershipType },
  ): Promise<PaginatedResultDto<Vehicle>> {
    const qb = this.vehicleRepository.createQueryBuilder('vehicle');

    if (filters?.type) {
      qb.andWhere('vehicle.type = :type', { type: filters.type });
    }
    if (filters?.status) {
      qb.andWhere('vehicle.status = :status', { status: filters.status });
    }
    if (filters?.ownershipType) {
      qb.andWhere('vehicle.ownershipType = :ownershipType', { ownershipType: filters.ownershipType });
    }

    qb.orderBy('vehicle.createdAt', 'DESC')
      .skip(paginationDto.skip)
      .take(paginationDto.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOne(id: string): Promise<Vehicle> {
    const vehicle = await this.vehicleRepository.findOne({ where: { id } });
    if (!vehicle) {
      throw new NotFoundException(`Vehicule #${id} non trouve`);
    }
    return vehicle;
  }

  async update(id: string, updateVehicleDto: UpdateVehicleDto): Promise<Vehicle> {
    const vehicle = await this.findOne(id);

    if (updateVehicleDto.code && updateVehicleDto.code !== vehicle.code) {
      const existing = await this.vehicleRepository.findOne({
        where: { code: updateVehicleDto.code },
      });
      if (existing) {
        throw new ConflictException(`Un vehicule avec le code ${updateVehicleDto.code} existe deja`);
      }
    }

    Object.assign(vehicle, updateVehicleDto);
    return this.vehicleRepository.save(vehicle);
  }

  async remove(id: string): Promise<void> {
    const vehicle = await this.findOne(id);
    await this.vehicleRepository.remove(vehicle);
  }

  async getStats() {
    const totalVehicles = await this.vehicleRepository.count();

    const byStatus = await this.vehicleRepository
      .createQueryBuilder('vehicle')
      .select('vehicle.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('vehicle.status')
      .getRawMany();

    const byType = await this.vehicleRepository
      .createQueryBuilder('vehicle')
      .select('vehicle.type', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('vehicle.type')
      .getRawMany();

    const byOwnership = await this.vehicleRepository
      .createQueryBuilder('vehicle')
      .select('vehicle.ownershipType', 'ownershipType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('vehicle.ownershipType')
      .getRawMany();

    return { totalVehicles, byStatus, byType, byOwnership };
  }
}
