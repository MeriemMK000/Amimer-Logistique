import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VehicleAssignment } from './vehicle-assignment.entity';
import { CreateVehicleAssignmentDto } from './dto/create-vehicle-assignment.dto';
import { UpdateVehicleAssignmentDto } from './dto/update-vehicle-assignment.dto';
import { PaginationDto, PaginatedResultDto } from '../common/dto/pagination.dto';

@Injectable()
export class VehicleAssignmentsService {
  constructor(
    @InjectRepository(VehicleAssignment)
    private readonly assignmentRepository: Repository<VehicleAssignment>,
  ) {}

  async create(createDto: CreateVehicleAssignmentDto): Promise<VehicleAssignment> {
    // Check for existing active assignment for the same vehicle
    const existingVehicle = await this.assignmentRepository.findOne({
      where: { vehicleId: createDto.vehicleId, isActive: true },
    });
    if (existingVehicle && createDto.type === 'PERMANENT') {
      throw new ConflictException('Ce vehicule a deja une affectation permanente active');
    }

    const assignment = this.assignmentRepository.create(createDto);
    return this.assignmentRepository.save(assignment);
  }

  async findAll(
    paginationDto: PaginationDto,
    vehicleId?: string,
    driverId?: string,
  ): Promise<PaginatedResultDto<VehicleAssignment>> {
    const qb = this.assignmentRepository.createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.vehicle', 'vehicle')
      .leftJoinAndSelect('assignment.driver', 'driver');

    if (vehicleId) {
      qb.andWhere('assignment.vehicleId = :vehicleId', { vehicleId });
    }
    if (driverId) {
      qb.andWhere('assignment.driverId = :driverId', { driverId });
    }

    qb.orderBy('assignment.createdAt', 'DESC')
      .skip(paginationDto.skip)
      .take(paginationDto.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOne(id: string): Promise<VehicleAssignment> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id },
      relations: { vehicle: true, driver: true },
    });
    if (!assignment) {
      throw new NotFoundException(`Affectation #${id} non trouvee`);
    }
    return assignment;
  }

  async update(id: string, updateDto: UpdateVehicleAssignmentDto): Promise<VehicleAssignment> {
    const assignment = await this.findOne(id);
    Object.assign(assignment, updateDto);
    return this.assignmentRepository.save(assignment);
  }

  async deactivate(id: string): Promise<VehicleAssignment> {
    const assignment = await this.findOne(id);
    assignment.isActive = false;
    assignment.endDate = new Date();
    return this.assignmentRepository.save(assignment);
  }

  async remove(id: string): Promise<void> {
    const assignment = await this.findOne(id);
    await this.assignmentRepository.remove(assignment);
  }
}
