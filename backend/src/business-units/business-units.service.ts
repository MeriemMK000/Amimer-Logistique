import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BusinessUnit } from './business-units.entity';

@Injectable()
export class BusinessUnitService {
  constructor(
    @InjectRepository(BusinessUnit)
    private readonly repo: Repository<BusinessUnit>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<BusinessUnit[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<BusinessUnit> {
    const row = await this.repo.findOne({ where: { code: id as never } });
    if (!row) throw new NotFoundException('BusinessUnit ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<BusinessUnit>): Promise<BusinessUnit> {
    requireFields(data as Record<string, unknown>, [
      { key: 'code', label: 'code' },
      { key: 'name', label: 'libellé' },
    ]);
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<BusinessUnit>): Promise<BusinessUnit> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('business-units', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<BusinessUnit>[]): Promise<BusinessUnit[]> {
    await this.repo.clear();
    return this.repo.save(rows.map((row) => this.repo.create(row)));
  }
}
