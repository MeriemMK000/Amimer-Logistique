import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeaseContract } from './lease-contracts.entity';

@Injectable()
export class LeaseContractService {
  constructor(
    @InjectRepository(LeaseContract)
    private readonly repo: Repository<LeaseContract>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<LeaseContract[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<LeaseContract> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('LeaseContract ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<LeaseContract>): Promise<LeaseContract> {
    requireFields(data as Record<string, unknown>, [
      { key: 'vehicleCode', label: 'véhicule' },
      { key: 'num', label: 'n° de contrat' },
      { key: 'startDate', label: 'date de début' },
      { key: 'dailyPrice', label: 'prix / jour', positive: true },
    ]);
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<LeaseContract>): Promise<LeaseContract> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('lease-contracts', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<LeaseContract>[]): Promise<LeaseContract[]> {
    await this.repo.clear();
    return this.repo.save(rows.map((row) => this.repo.create(row)));
  }
}
