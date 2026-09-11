import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Supplier } from './suppliers.entity';

@Injectable()
export class SupplierService {
  constructor(
    @InjectRepository(Supplier)
    private readonly repo: Repository<Supplier>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<Supplier[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<Supplier> {
    const row = await this.repo.findOne({ where: { code: id as never } });
    if (!row) throw new NotFoundException('Supplier ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<Supplier>): Promise<Supplier> {
    requireFields(data as Record<string, unknown>, [{ key: 'name', label: 'raison sociale' }]);
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Supplier>): Promise<Supplier> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('suppliers', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<Supplier>[]): Promise<Supplier[]> {
    await this.repo.clear();
    return this.repo.save(rows.map((row) => this.repo.create(row)));
  }
}
