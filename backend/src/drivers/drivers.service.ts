import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from './driver.entity';
import { CreateDriverDto } from './dto/create-driver.dto';
import { UpdateDriverDto } from './dto/update-driver.dto';
import { PaginationDto, PaginatedResultDto } from '../common/dto/pagination.dto';
import { DriverStatus } from '../common/enums';

@Injectable()
export class DriversService {
  constructor(
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
  ) {}

  async create(createDriverDto: CreateDriverDto): Promise<Driver> {
    const existing = await this.driverRepository.findOne({
      where: { employeeNumber: createDriverDto.employeeNumber },
    });
    if (existing) {
      throw new ConflictException(`Un chauffeur avec le matricule ${createDriverDto.employeeNumber} existe deja`);
    }

    const driver = this.driverRepository.create(createDriverDto);
    return this.driverRepository.save(driver);
  }

  async findAll(paginationDto: PaginationDto, status?: DriverStatus): Promise<PaginatedResultDto<Driver>> {
    const qb = this.driverRepository.createQueryBuilder('driver')
      .leftJoinAndSelect('driver.user', 'user');

    if (status) {
      qb.andWhere('driver.status = :status', { status });
    }

    qb.orderBy('driver.createdAt', 'DESC')
      .skip(paginationDto.skip)
      .take(paginationDto.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOne(id: string): Promise<Driver> {
    const driver = await this.driverRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!driver) {
      throw new NotFoundException(`Chauffeur #${id} non trouve`);
    }
    return driver;
  }

  async update(id: string, updateDriverDto: UpdateDriverDto): Promise<Driver> {
    const driver = await this.findOne(id);

    if (updateDriverDto.employeeNumber && updateDriverDto.employeeNumber !== driver.employeeNumber) {
      const existing = await this.driverRepository.findOne({
        where: { employeeNumber: updateDriverDto.employeeNumber },
      });
      if (existing) {
        throw new ConflictException(`Un chauffeur avec le matricule ${updateDriverDto.employeeNumber} existe deja`);
      }
    }

    Object.assign(driver, updateDriverDto);
    return this.driverRepository.save(driver);
  }

  async remove(id: string): Promise<void> {
    const driver = await this.findOne(id);
    await this.driverRepository.remove(driver);
  }

  async findAvailable(): Promise<Driver[]> {
    return this.driverRepository.find({
      where: { status: DriverStatus.DISPONIBLE },
      order: { lastName: 'ASC' },
    });
  }

  async updateStatus(id: string, status: DriverStatus): Promise<Driver> {
    const driver = await this.findOne(id);
    driver.status = status;
    return this.driverRepository.save(driver);
  }
}
