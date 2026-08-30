import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { FuelEntry } from './entities/fuel-entry.entity';
import { ConstructorNorm } from './entities/constructor-norm.entity';
import { FuelAnalysis } from './entities/fuel-analysis.entity';
import { CreateFuelEntryDto } from './dto/create-fuel-entry.dto';
import { UpdateFuelEntryDto } from './dto/update-fuel-entry.dto';
import { PaginationDto, PaginatedResultDto } from '../common/dto/pagination.dto';

@Injectable()
export class FuelService {
  constructor(
    @InjectRepository(FuelEntry)
    private readonly fuelEntryRepository: Repository<FuelEntry>,
    @InjectRepository(ConstructorNorm)
    private readonly constructorNormRepository: Repository<ConstructorNorm>,
    @InjectRepository(FuelAnalysis)
    private readonly fuelAnalysisRepository: Repository<FuelAnalysis>,
  ) {}

  // === Fuel Entries ===

  async createEntry(createDto: CreateFuelEntryDto): Promise<FuelEntry> {
    const entry = this.fuelEntryRepository.create(createDto);
    return this.fuelEntryRepository.save(entry);
  }

  async findAllEntries(
    paginationDto: PaginationDto,
    vehicleId?: string,
    driverId?: string,
  ): Promise<PaginatedResultDto<FuelEntry>> {
    const qb = this.fuelEntryRepository.createQueryBuilder('entry')
      .leftJoinAndSelect('entry.vehicle', 'vehicle')
      .leftJoinAndSelect('entry.driver', 'driver')
      .leftJoinAndSelect('entry.mission', 'mission');

    if (vehicleId) {
      qb.andWhere('entry.vehicleId = :vehicleId', { vehicleId });
    }
    if (driverId) {
      qb.andWhere('entry.driverId = :driverId', { driverId });
    }

    qb.orderBy('entry.date', 'DESC')
      .skip(paginationDto.skip)
      .take(paginationDto.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOneEntry(id: string): Promise<FuelEntry> {
    const entry = await this.fuelEntryRepository.findOne({
      where: { id },
      relations: { vehicle: true, driver: true, mission: true },
    });
    if (!entry) {
      throw new NotFoundException(`Saisie carburant #${id} non trouvee`);
    }
    return entry;
  }

  async updateEntry(id: string, updateDto: UpdateFuelEntryDto): Promise<FuelEntry> {
    const entry = await this.findOneEntry(id);
    Object.assign(entry, updateDto);
    return this.fuelEntryRepository.save(entry);
  }

  async removeEntry(id: string): Promise<void> {
    const entry = await this.findOneEntry(id);
    await this.fuelEntryRepository.remove(entry);
  }

  async importEntries(entries: CreateFuelEntryDto[]): Promise<FuelEntry[]> {
    const entities = entries.map((e) =>
      this.fuelEntryRepository.create({ ...e, isImported: true }),
    );
    return this.fuelEntryRepository.save(entities);
  }

  // === Constructor Norms ===

  async findAllNorms(): Promise<ConstructorNorm[]> {
    return this.constructorNormRepository.find({ order: { brand: 'ASC', model: 'ASC' } });
  }

  async createNorm(data: Partial<ConstructorNorm>): Promise<ConstructorNorm> {
    const norm = this.constructorNormRepository.create(data);
    return this.constructorNormRepository.save(norm);
  }

  // === Fuel Analysis ===

  async analyzeVehicleConsumption(
    vehicleId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<FuelAnalysis> {
    const entries = await this.fuelEntryRepository.find({
      where: {
        vehicleId,
        date: Between(periodStart, periodEnd),
      },
      order: { odometerReading: 'ASC' },
    });

    if (entries.length < 2) {
      throw new NotFoundException('Pas assez de donnees pour analyser la consommation');
    }

    const totalFuel = entries.reduce((sum, e) => sum + Number(e.quantityLiters), 0);
    const odometerValues = entries
      .map((e) => Number(e.odometerReading))
      .filter((v) => v > 0);
    const totalKm = odometerValues.length >= 2
      ? odometerValues[odometerValues.length - 1] - odometerValues[0]
      : 0;

    const avgConsumption = totalKm > 0 ? (totalFuel / totalKm) * 100 : 0;

    // Find constructor norm
    const vehicle = entries[0]?.vehicle;
    let normConsumption = 0;
    if (vehicle) {
      const norm = await this.constructorNormRepository.findOne({
        where: { brand: vehicle.brand, model: vehicle.model },
      });
      normConsumption = norm ? Number(norm.normConsumption) : 0;
    }

    const deviationPercent = normConsumption > 0
      ? ((avgConsumption - normConsumption) / normConsumption) * 100
      : 0;

    let status = 'NORMAL';
    if (deviationPercent > 20) {
      status = 'CRITIQUE';
    } else if (deviationPercent > 10) {
      status = 'ALERTE';
    }

    const analysis = this.fuelAnalysisRepository.create({
      vehicleId,
      periodStart,
      periodEnd,
      totalKm,
      totalFuel,
      avgConsumption,
      normConsumption,
      deviationPercent,
      status,
    });

    return this.fuelAnalysisRepository.save(analysis);
  }

  async getAnalyses(vehicleId?: string): Promise<FuelAnalysis[]> {
    const where: Record<string, unknown> = {};
    if (vehicleId) where.vehicleId = vehicleId;

    return this.fuelAnalysisRepository.find({
      where,
      relations: { vehicle: true },
      order: { createdAt: 'DESC' },
    });
  }

  async getAnomalies(): Promise<FuelAnalysis[]> {
    return this.fuelAnalysisRepository
      .createQueryBuilder('analysis')
      .leftJoinAndSelect('analysis.vehicle', 'vehicle')
      .where('analysis.status IN (:...statuses)', { statuses: ['ALERTE', 'CRITIQUE'] })
      .orderBy('analysis.deviationPercent', 'DESC')
      .getMany();
  }
}
