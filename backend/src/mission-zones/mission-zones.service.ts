import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MissionZone } from './mission-zone.entity';
import { CreateMissionZoneDto } from './dto/create-mission-zone.dto';
import { UpdateMissionZoneDto } from './dto/update-mission-zone.dto';

@Injectable()
export class MissionZonesService {
  constructor(
    @InjectRepository(MissionZone)
    private readonly zoneRepository: Repository<MissionZone>,
  ) {}

  async create(createDto: CreateMissionZoneDto): Promise<MissionZone> {
    const existing = await this.zoneRepository.findOne({
      where: { code: createDto.code },
    });
    if (existing) {
      throw new ConflictException(`Une zone avec le code ${createDto.code} existe deja`);
    }

    const zone = this.zoneRepository.create(createDto);
    return this.zoneRepository.save(zone);
  }

  async findAll(): Promise<MissionZone[]> {
    return this.zoneRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string): Promise<MissionZone> {
    const zone = await this.zoneRepository.findOne({ where: { id } });
    if (!zone) {
      throw new NotFoundException(`Zone #${id} non trouvee`);
    }
    return zone;
  }

  async update(id: string, updateDto: UpdateMissionZoneDto): Promise<MissionZone> {
    const zone = await this.findOne(id);
    if (updateDto.code && updateDto.code !== zone.code) {
      const existing = await this.zoneRepository.findOne({
        where: { code: updateDto.code },
      });
      if (existing) {
        throw new ConflictException(`Une zone avec le code ${updateDto.code} existe deja`);
      }
    }
    Object.assign(zone, updateDto);
    return this.zoneRepository.save(zone);
  }

  async remove(id: string): Promise<void> {
    const zone = await this.findOne(id);
    await this.zoneRepository.remove(zone);
  }
}
