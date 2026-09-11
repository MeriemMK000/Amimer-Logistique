import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { normalizeDate } from '../common/normalize-date';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EngineFuelEntry } from './engine-fuel-entries.entity';

@Injectable()
export class EngineFuelEntryService {
  constructor(
    @InjectRepository(EngineFuelEntry)
    private readonly repo: Repository<EngineFuelEntry>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<EngineFuelEntry[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<EngineFuelEntry> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('EngineFuelEntry ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<EngineFuelEntry>): Promise<EngineFuelEntry> {
    requireFields(data as Record<string, unknown>, [
      { key: 'date', label: 'date' },
      { key: 'vehicleCode', label: 'engin' },
      { key: 'qty', label: 'quantité (litres)', positive: true },
    ]);
    if (data.date != null) data.date = normalizeDate(data.date);
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<EngineFuelEntry>): Promise<EngineFuelEntry> {
    const row = await this.findOne(id);
    if (data.date != null) data.date = normalizeDate(data.date);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('engine-fuel-entries', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<EngineFuelEntry>[]): Promise<EngineFuelEntry[]> {
    await this.repo.clear();
    return this.repo.save(rows.map((row) => this.repo.create(row)));
  }
}
