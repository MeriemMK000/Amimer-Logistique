import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from './drivers.entity';

@Injectable()
export class DriverService {
  constructor(
    @InjectRepository(Driver)
    private readonly repo: Repository<Driver>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<Driver[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<Driver> {
    const row = await this.repo.findOne({ where: { code: id as never } });
    if (!row) throw new NotFoundException('Driver ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<Driver>): Promise<Driver> {
    requireFields(data as Record<string, unknown>, [
      { key: 'code', label: 'N° employé' },
      { key: 'name', label: 'nom complet' },
    ]);
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Driver>): Promise<Driver> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('drivers', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<Driver>[]): Promise<Driver[]> {
    await this.repo.clear();
    return this.repo.save(rows.map((row) => this.repo.create(row)));
  }
}
