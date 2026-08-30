import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull } from 'typeorm';
import { ExpenseScale } from './entities/expense-scale.entity';
import { MissionExpense } from './entities/mission-expense.entity';
import { CreateExpenseScaleDto } from './dto/create-expense-scale.dto';
import { UpdateExpenseScaleDto } from './dto/update-expense-scale.dto';
import { CreateMissionExpenseDto } from './dto/create-mission-expense.dto';
import { UpdateMissionExpenseDto } from './dto/update-mission-expense.dto';
import { PaginationDto, PaginatedResultDto } from '../common/dto/pagination.dto';

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(ExpenseScale)
    private readonly scaleRepository: Repository<ExpenseScale>,
    @InjectRepository(MissionExpense)
    private readonly expenseRepository: Repository<MissionExpense>,
  ) {}

  // === Expense Scales ===

  async createScale(createDto: CreateExpenseScaleDto): Promise<ExpenseScale> {
    const scale = this.scaleRepository.create(createDto);
    return this.scaleRepository.save(scale);
  }

  async findAllScales(paginationDto: PaginationDto): Promise<PaginatedResultDto<ExpenseScale>> {
    const [data, total] = await this.scaleRepository.findAndCount({
      relations: { zone: true },
      skip: paginationDto.skip,
      take: paginationDto.limit,
      order: { effectiveDate: 'DESC' },
    });
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOneScale(id: string): Promise<ExpenseScale> {
    const scale = await this.scaleRepository.findOne({
      where: { id },
      relations: { zone: true },
    });
    if (!scale) {
      throw new NotFoundException(`Bareme #${id} non trouve`);
    }
    return scale;
  }

  async updateScale(id: string, updateDto: UpdateExpenseScaleDto): Promise<ExpenseScale> {
    const scale = await this.findOneScale(id);
    Object.assign(scale, updateDto);
    return this.scaleRepository.save(scale);
  }

  async removeScale(id: string): Promise<void> {
    const scale = await this.findOneScale(id);
    await this.scaleRepository.remove(scale);
  }

  async findApplicableScale(zoneId: string | null, date: Date): Promise<ExpenseScale | null> {
    const qb = this.scaleRepository.createQueryBuilder('scale')
      .where('scale.effectiveDate <= :date', { date })
      .andWhere('(scale.endDate IS NULL OR scale.endDate >= :date)', { date });

    if (zoneId) {
      qb.andWhere('(scale.zoneId = :zoneId OR scale.zoneId IS NULL)', { zoneId });
      qb.orderBy('scale.zoneId', 'DESC', 'NULLS LAST');
    } else {
      qb.andWhere('scale.zoneId IS NULL');
    }

    qb.addOrderBy('scale.effectiveDate', 'DESC');

    return qb.getOne();
  }

  // === Mission Expenses ===

  async createExpense(createDto: CreateMissionExpenseDto): Promise<MissionExpense> {
    const expense = this.expenseRepository.create(createDto);
    return this.expenseRepository.save(expense);
  }

  async findAllExpenses(
    paginationDto: PaginationDto,
    missionId?: string,
    driverId?: string,
  ): Promise<PaginatedResultDto<MissionExpense>> {
    const qb = this.expenseRepository.createQueryBuilder('expense')
      .leftJoinAndSelect('expense.mission', 'mission')
      .leftJoinAndSelect('expense.driver', 'driver');

    if (missionId) {
      qb.andWhere('expense.missionId = :missionId', { missionId });
    }
    if (driverId) {
      qb.andWhere('expense.driverId = :driverId', { driverId });
    }

    qb.orderBy('expense.createdAt', 'DESC')
      .skip(paginationDto.skip)
      .take(paginationDto.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResultDto(data, total, paginationDto.page, paginationDto.limit);
  }

  async findOneExpense(id: string): Promise<MissionExpense> {
    const expense = await this.expenseRepository.findOne({
      where: { id },
      relations: { mission: true, driver: true },
    });
    if (!expense) {
      throw new NotFoundException(`Frais de mission #${id} non trouve`);
    }
    return expense;
  }

  async updateExpense(id: string, updateDto: UpdateMissionExpenseDto): Promise<MissionExpense> {
    const expense = await this.findOneExpense(id);
    Object.assign(expense, updateDto);
    return this.expenseRepository.save(expense);
  }

  async removeExpense(id: string): Promise<void> {
    const expense = await this.findOneExpense(id);
    await this.expenseRepository.remove(expense);
  }

  async calculateMissionExpenses(
    missionId: string,
    driverId: string,
    zoneId: string | null,
    days: number,
    distanceKm: number,
  ): Promise<MissionExpense[]> {
    const scale = await this.findApplicableScale(zoneId, new Date());
    if (!scale) {
      throw new NotFoundException('Aucun bareme applicable trouve');
    }

    const expenses: MissionExpense[] = [];

    // Per diem
    if (Number(scale.perDiemRate) > 0) {
      const perDiem = this.expenseRepository.create({
        missionId,
        driverId,
        expenseType: 'PER_DIEM',
        amount: Number(scale.perDiemRate) * days,
        calculationBasis: `${days} jours x ${scale.perDiemRate} EUR`,
        days,
      });
      expenses.push(await this.expenseRepository.save(perDiem));
    }

    // Meals
    if (Number(scale.mealRate) > 0) {
      const meals = this.expenseRepository.create({
        missionId,
        driverId,
        expenseType: 'REPAS',
        amount: Number(scale.mealRate) * days * 2,
        calculationBasis: `${days} jours x 2 repas x ${scale.mealRate} EUR`,
        days,
      });
      expenses.push(await this.expenseRepository.save(meals));
    }

    // Accommodation
    if (Number(scale.accommodationRate) > 0 && days > 1) {
      const nights = days - 1;
      const accommodation = this.expenseRepository.create({
        missionId,
        driverId,
        expenseType: 'HEBERGEMENT',
        amount: Number(scale.accommodationRate) * nights,
        calculationBasis: `${nights} nuits x ${scale.accommodationRate} EUR`,
        days: nights,
      });
      expenses.push(await this.expenseRepository.save(accommodation));
    }

    // Km allowance
    if (Number(scale.kmRate) > 0 && distanceKm > 0) {
      const kmAllowance = this.expenseRepository.create({
        missionId,
        driverId,
        expenseType: 'INDEMNITE_KM',
        amount: Number(scale.kmRate) * distanceKm,
        calculationBasis: `${distanceKm} km x ${scale.kmRate} EUR`,
        distanceKm,
      });
      expenses.push(await this.expenseRepository.save(kmAllowance));
    }

    return expenses;
  }
}
