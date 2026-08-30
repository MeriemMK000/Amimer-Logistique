import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Mission } from './mission.entity';
import { MissionWaypoint } from '../mission-waypoints/mission-waypoint.entity';
import { CreateMissionDto } from './dto/create-mission.dto';
import { UpdateMissionDto } from './dto/update-mission.dto';
import { PaginationDto, PaginatedResultDto } from '../common/dto/pagination.dto';
import { MissionStatus } from '../common/enums';

@Injectable()
export class MissionsService {
  private missionCounter = 0;

  constructor(
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(MissionWaypoint)
    private readonly waypointRepository: Repository<MissionWaypoint>,
  ) {}

  private async generateMissionNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.missionRepository.count();
    this.missionCounter = count + 1;
    return `MSN-${year}-${String(this.missionCounter).padStart(5, '0')}`;
  }

  async create(createMissionDto: CreateMissionDto): Promise<Mission> {
    const missionNumber = await this.generateMissionNumber();

    const { waypoints, ...missionData } = createMissionDto;
    const mission = this.missionRepository.create({
      ...missionData,
      missionNumber,
    });

    const savedMission = await this.missionRepository.save(mission);

    if (waypoints && waypoints.length > 0) {
      const waypointEntities = waypoints.map((wp) =>
        this.waypointRepository.create({ ...wp, missionId: savedMission.id }),
      );
      await this.waypointRepository.save(waypointEntities);
    }

    return this.findOne(savedMission.id);
  }

  async findAll(
    paginationDto: PaginationDto,
    filters?: { status?: MissionStatus; vehicleId?: string; driverId?: string },
  ): Promise<PaginatedResultDto<Mission>> {
    const qb = this.missionRepository.createQueryBuilder('mission')
      .leftJoinAndSelect('mission.vehicle', 'vehicle')
      .leftJoinAndSelect('mission.driver', 'driver')
      .leftJoinAndSelect('mission.zone', 'zone')
      .leftJoinAndSelect('mission.waypoints', 'waypoints');

    if (filters?.status) {
      qb.andWhere('mission.status = :status', { status: filters.status });
    }
    if (filters?.vehicleId) {
      qb.andWhere('mission.vehicleId = :vehicleId', { vehicleId: filters.vehicleId });
    }
    if (filters?.driverId) {
      qb.andWhere('mission.driverId = :driverId', { driverId: filters.driverId });
    }

    qb.orderBy('mission.createdAt', 'DESC')
      .addOrderBy('waypoints.order', 'ASC')
      .skip(paginationDto.skip)
      .take(paginationDto.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOne(id: string): Promise<Mission> {
    const mission = await this.missionRepository.findOne({
      where: { id },
      relations: { vehicle: true, driver: true, zone: true, waypoints: true },
      order: { waypoints: { order: 'ASC' } },
    });
    if (!mission) {
      throw new NotFoundException(`Mission #${id} non trouvee`);
    }
    return mission;
  }

  async update(id: string, updateMissionDto: UpdateMissionDto): Promise<Mission> {
    const mission = await this.findOne(id);

    const { waypoints, ...missionData } = updateMissionDto;
    Object.assign(mission, missionData);
    await this.missionRepository.save(mission);

    if (waypoints !== undefined) {
      await this.waypointRepository.delete({ missionId: id });
      if (waypoints.length > 0) {
        const waypointEntities = waypoints.map((wp) =>
          this.waypointRepository.create({ ...wp, missionId: id }),
        );
        await this.waypointRepository.save(waypointEntities);
      }
    }

    return this.findOne(id);
  }

  async updateStatus(id: string, status: MissionStatus): Promise<Mission> {
    const mission = await this.findOne(id);

    const validTransitions: Record<MissionStatus, MissionStatus[]> = {
      [MissionStatus.PLANIFIEE]: [MissionStatus.EN_COURS, MissionStatus.ANNULEE],
      [MissionStatus.EN_COURS]: [MissionStatus.MODIFIEE, MissionStatus.TERMINEE, MissionStatus.ANNULEE],
      [MissionStatus.MODIFIEE]: [MissionStatus.EN_COURS, MissionStatus.TERMINEE, MissionStatus.ANNULEE],
      [MissionStatus.TERMINEE]: [],
      [MissionStatus.ANNULEE]: [],
    };

    if (!validTransitions[mission.status]?.includes(status)) {
      throw new BadRequestException(
        `Transition de statut invalide: ${mission.status} -> ${status}`,
      );
    }

    mission.status = status;
    if (status === MissionStatus.EN_COURS && !mission.actualDepartureDate) {
      mission.actualDepartureDate = new Date();
    }
    if (status === MissionStatus.TERMINEE && !mission.actualArrivalDate) {
      mission.actualArrivalDate = new Date();
    }

    return this.missionRepository.save(mission);
  }

  async remove(id: string): Promise<void> {
    const mission = await this.findOne(id);
    await this.missionRepository.remove(mission);
  }
}
