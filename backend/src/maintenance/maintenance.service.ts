import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenancePlan } from './entities/maintenance-plan.entity';
import { MaintenanceOrder } from './entities/maintenance-order.entity';
import { MaintenancePart } from './entities/maintenance-part.entity';
import { CreateMaintenancePlanDto } from './dto/create-maintenance-plan.dto';
import { UpdateMaintenancePlanDto } from './dto/update-maintenance-plan.dto';
import { CreateMaintenanceOrderDto } from './dto/create-maintenance-order.dto';
import { UpdateMaintenanceOrderDto } from './dto/update-maintenance-order.dto';
import { PaginationDto, PaginatedResultDto } from '../common/dto/pagination.dto';

@Injectable()
export class MaintenanceService {
  constructor(
    @InjectRepository(MaintenancePlan)
    private readonly planRepository: Repository<MaintenancePlan>,
    @InjectRepository(MaintenanceOrder)
    private readonly orderRepository: Repository<MaintenanceOrder>,
    @InjectRepository(MaintenancePart)
    private readonly partRepository: Repository<MaintenancePart>,
  ) {}

  // === Plans ===

  async createPlan(createDto: CreateMaintenancePlanDto): Promise<MaintenancePlan> {
    const plan = this.planRepository.create(createDto);
    return this.planRepository.save(plan);
  }

  async findAllPlans(paginationDto: PaginationDto, vehicleId?: string): Promise<PaginatedResultDto<MaintenancePlan>> {
    const where: Record<string, unknown> = {};
    if (vehicleId) where.vehicleId = vehicleId;

    const [data, total] = await this.planRepository.findAndCount({
      where,
      relations: { vehicle: true },
      skip: paginationDto.skip,
      take: paginationDto.limit,
      order: { createdAt: 'DESC' },
    });
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOnePlan(id: string): Promise<MaintenancePlan> {
    const plan = await this.planRepository.findOne({
      where: { id },
      relations: { vehicle: true },
    });
    if (!plan) {
      throw new NotFoundException(`Plan de maintenance #${id} non trouve`);
    }
    return plan;
  }

  async updatePlan(id: string, updateDto: UpdateMaintenancePlanDto): Promise<MaintenancePlan> {
    const plan = await this.findOnePlan(id);
    Object.assign(plan, updateDto);
    return this.planRepository.save(plan);
  }

  async removePlan(id: string): Promise<void> {
    const plan = await this.findOnePlan(id);
    await this.planRepository.remove(plan);
  }

  // === Orders ===

  async createOrder(createDto: CreateMaintenanceOrderDto): Promise<MaintenanceOrder> {
    const { parts, ...orderData } = createDto;
    const order = this.orderRepository.create(orderData);
    const savedOrder = await this.orderRepository.save(order);

    if (parts && parts.length > 0) {
      const partEntities = parts.map((p) =>
        this.partRepository.create({ ...p, orderId: savedOrder.id }),
      );
      await this.partRepository.save(partEntities);
    }

    return this.findOneOrder(savedOrder.id);
  }

  async findAllOrders(
    paginationDto: PaginationDto,
    vehicleId?: string,
    status?: string,
  ): Promise<PaginatedResultDto<MaintenanceOrder>> {
    const qb = this.orderRepository.createQueryBuilder('order')
      .leftJoinAndSelect('order.vehicle', 'vehicle')
      .leftJoinAndSelect('order.plan', 'plan')
      .leftJoinAndSelect('order.parts', 'parts');

    if (vehicleId) {
      qb.andWhere('order.vehicleId = :vehicleId', { vehicleId });
    }
    if (status) {
      qb.andWhere('order.status = :status', { status });
    }

    qb.orderBy('order.createdAt', 'DESC')
      .skip(paginationDto.skip)
      .take(paginationDto.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOneOrder(id: string): Promise<MaintenanceOrder> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: { vehicle: true, plan: true, parts: true },
    });
    if (!order) {
      throw new NotFoundException(`Ordre de maintenance #${id} non trouve`);
    }
    return order;
  }

  async updateOrder(id: string, updateDto: UpdateMaintenanceOrderDto): Promise<MaintenanceOrder> {
    const order = await this.findOneOrder(id);
    const { parts, ...orderData } = updateDto;
    Object.assign(order, orderData);
    await this.orderRepository.save(order);

    if (parts !== undefined) {
      await this.partRepository.delete({ orderId: id });
      if (parts.length > 0) {
        const partEntities = parts.map((p) =>
          this.partRepository.create({ ...p, orderId: id }),
        );
        await this.partRepository.save(partEntities);
      }
    }

    return this.findOneOrder(id);
  }

  async removeOrder(id: string): Promise<void> {
    const order = await this.findOneOrder(id);
    await this.orderRepository.remove(order);
  }

  // === Cost Aggregation ===

  async getCostsByVehicle(vehicleId: string) {
    const result = await this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.actualCost)', 'totalActualCost')
      .addSelect('SUM(order.estimatedCost)', 'totalEstimatedCost')
      .addSelect('COUNT(*)', 'totalOrders')
      .where('order.vehicleId = :vehicleId', { vehicleId })
      .getRawOne();

    return result;
  }

  async getCostsSummary(period?: string) {
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .leftJoin('order.vehicle', 'vehicle')
      .select('vehicle.id', 'vehicleId')
      .addSelect('vehicle.code', 'vehicleCode')
      .addSelect('vehicle.brand', 'vehicleBrand')
      .addSelect('vehicle.model', 'vehicleModel')
      .addSelect('SUM(order.actualCost)', 'totalCost')
      .addSelect('COUNT(*)', 'orderCount')
      .groupBy('vehicle.id')
      .addGroupBy('vehicle.code')
      .addGroupBy('vehicle.brand')
      .addGroupBy('vehicle.model')
      .orderBy('SUM(order.actualCost)', 'DESC');

    if (period === 'monthly') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      qb.andWhere('order.createdAt >= :since', { since: monthAgo });
    } else if (period === 'annual') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      qb.andWhere('order.createdAt >= :since', { since: yearAgo });
    }

    return qb.getRawMany();
  }
}
