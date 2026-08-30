import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from '../vehicles/vehicle.entity';
import { Driver } from '../drivers/driver.entity';
import { Mission } from '../missions/mission.entity';
import { MaintenanceOrder } from '../maintenance/entities/maintenance-order.entity';
import { FuelEntry } from '../fuel/entities/fuel-entry.entity';
import { Incident } from '../incidents/incident.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehicleRepository: Repository<Vehicle>,
    @InjectRepository(Driver)
    private readonly driverRepository: Repository<Driver>,
    @InjectRepository(Mission)
    private readonly missionRepository: Repository<Mission>,
    @InjectRepository(MaintenanceOrder)
    private readonly maintenanceOrderRepository: Repository<MaintenanceOrder>,
    @InjectRepository(FuelEntry)
    private readonly fuelEntryRepository: Repository<FuelEntry>,
    @InjectRepository(Incident)
    private readonly incidentRepository: Repository<Incident>,
  ) {}

  async getDashboard() {
    const totalVehicles = await this.vehicleRepository.count();
    const totalDrivers = await this.driverRepository.count();
    const activeMissions = await this.missionRepository.count({
      where: { status: 'EN_COURS' as any },
    });
    const pendingMaintenance = await this.maintenanceOrderRepository.count({
      where: { status: 'PLANIFIE' as any },
    });

    const vehiclesByStatus = await this.vehicleRepository
      .createQueryBuilder('v')
      .select('v.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('v.status')
      .getRawMany();

    const recentIncidents = await this.incidentRepository.count({
      where: { status: 'OUVERT' as any },
    });

    const monthlyFuelCost = await this.fuelEntryRepository
      .createQueryBuilder('f')
      .select('SUM(f.totalCost)', 'total')
      .where('f.date >= :startDate', {
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      })
      .getRawOne();

    return {
      totalVehicles,
      totalDrivers,
      activeMissions,
      pendingMaintenance,
      vehiclesByStatus,
      recentIncidents,
      monthlyFuelCost: monthlyFuelCost?.total || 0,
    };
  }

  async getMaintenanceCosts(period: string = 'monthly') {
    const qb = this.maintenanceOrderRepository
      .createQueryBuilder('order')
      .leftJoin('order.vehicle', 'vehicle')
      .select('vehicle.id', 'vehicleId')
      .addSelect('vehicle.code', 'vehicleCode')
      .addSelect('vehicle.brand', 'brand')
      .addSelect('vehicle.model', 'model')
      .addSelect('SUM(order.actualCost)', 'totalCost')
      .addSelect('COUNT(*)', 'orderCount');

    const since = new Date();
    if (period === 'monthly') {
      since.setMonth(since.getMonth() - 1);
    } else if (period === 'annual') {
      since.setFullYear(since.getFullYear() - 1);
    } else if (period === 'pluriannual') {
      since.setFullYear(since.getFullYear() - 3);
    }

    qb.where('order.createdAt >= :since', { since })
      .groupBy('vehicle.id')
      .addGroupBy('vehicle.code')
      .addGroupBy('vehicle.brand')
      .addGroupBy('vehicle.model')
      .orderBy('SUM(order.actualCost)', 'DESC');

    return qb.getRawMany();
  }

  async getFuelConsumption(vehicleId?: string, period: string = 'monthly') {
    const qb = this.fuelEntryRepository
      .createQueryBuilder('entry')
      .leftJoin('entry.vehicle', 'vehicle')
      .select('vehicle.id', 'vehicleId')
      .addSelect('vehicle.code', 'vehicleCode')
      .addSelect('SUM(entry.quantityLiters)', 'totalLiters')
      .addSelect('SUM(entry.totalCost)', 'totalCost')
      .addSelect('AVG(entry.unitPrice)', 'avgPrice');

    if (vehicleId) {
      qb.andWhere('entry.vehicleId = :vehicleId', { vehicleId });
    }

    const since = new Date();
    if (period === 'monthly') {
      since.setMonth(since.getMonth() - 1);
    } else if (period === 'annual') {
      since.setFullYear(since.getFullYear() - 1);
    }

    qb.andWhere('entry.date >= :since', { since })
      .groupBy('vehicle.id')
      .addGroupBy('vehicle.code')
      .orderBy('SUM(entry.totalCost)', 'DESC');

    return qb.getRawMany();
  }

  async getFleetStatus() {
    const byType = await this.vehicleRepository
      .createQueryBuilder('v')
      .select('v.type', 'type')
      .addSelect('v.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('v.type')
      .addGroupBy('v.status')
      .getRawMany();

    const byOwnership = await this.vehicleRepository
      .createQueryBuilder('v')
      .select('v.ownershipType', 'ownershipType')
      .addSelect('COUNT(*)', 'count')
      .groupBy('v.ownershipType')
      .getRawMany();

    const avgAge = await this.vehicleRepository
      .createQueryBuilder('v')
      .select('AVG(EXTRACT(YEAR FROM CURRENT_DATE) - v.year)', 'avgAge')
      .getRawOne();

    return { byType, byOwnership, avgAge: avgAge?.avgAge || 0 };
  }

  async getDriverWorkload() {
    const workload = await this.missionRepository
      .createQueryBuilder('mission')
      .leftJoin('mission.driver', 'driver')
      .select('driver.id', 'driverId')
      .addSelect('driver.firstName', 'firstName')
      .addSelect('driver.lastName', 'lastName')
      .addSelect('COUNT(*)', 'missionCount')
      .addSelect('SUM(mission.actualDistanceKm)', 'totalDistance')
      .where('mission.status IN (:...statuses)', {
        statuses: ['EN_COURS', 'TERMINEE'],
      })
      .groupBy('driver.id')
      .addGroupBy('driver.firstName')
      .addGroupBy('driver.lastName')
      .orderBy('COUNT(*)', 'DESC')
      .getRawMany();

    return workload;
  }

  async getProblematicVehicles() {
    // Vehicles with highest maintenance costs
    const highCostVehicles = await this.maintenanceOrderRepository
      .createQueryBuilder('order')
      .leftJoin('order.vehicle', 'vehicle')
      .select('vehicle.id', 'vehicleId')
      .addSelect('vehicle.code', 'vehicleCode')
      .addSelect('vehicle.brand', 'brand')
      .addSelect('vehicle.model', 'model')
      .addSelect('SUM(order.actualCost)', 'totalMaintenanceCost')
      .addSelect('COUNT(*)', 'maintenanceCount')
      .groupBy('vehicle.id')
      .addGroupBy('vehicle.code')
      .addGroupBy('vehicle.brand')
      .addGroupBy('vehicle.model')
      .orderBy('SUM(order.actualCost)', 'DESC')
      .limit(10)
      .getRawMany();

    // Vehicles with most incidents
    const highIncidentVehicles = await this.incidentRepository
      .createQueryBuilder('incident')
      .leftJoin('incident.vehicle', 'vehicle')
      .select('vehicle.id', 'vehicleId')
      .addSelect('vehicle.code', 'vehicleCode')
      .addSelect('COUNT(*)', 'incidentCount')
      .addSelect('SUM(incident.actualCost)', 'totalIncidentCost')
      .groupBy('vehicle.id')
      .addGroupBy('vehicle.code')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany();

    return { highCostVehicles, highIncidentVehicles };
  }
}
