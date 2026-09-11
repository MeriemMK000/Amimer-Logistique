import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchaseOrder } from './purchase-orders.entity';

@Injectable()
export class PurchaseOrderService {
  constructor(
    @InjectRepository(PurchaseOrder)
    private readonly repo: Repository<PurchaseOrder>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<PurchaseOrder[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<PurchaseOrder> {
    const row = await this.repo.findOne({ where: { num: id as never } });
    if (!row) throw new NotFoundException('PurchaseOrder ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    requireFields(data as Record<string, unknown>, [
      { key: 'num', label: 'n° de bon' },
      { key: 'supplierCode', label: 'fournisseur' },
      { key: 'date', label: 'date' },
    ]);
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('purchase-orders', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<PurchaseOrder>[]): Promise<PurchaseOrder[]> {
    await this.repo.clear();
    return this.repo.save(rows.map((row) => this.repo.create(row)));
  }
}
