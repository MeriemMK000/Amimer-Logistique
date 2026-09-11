import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalInvoice } from './external-invoice.entity';

@Injectable()
export class ExternalInvoiceService {
  constructor(@InjectRepository(ExternalInvoice) private readonly repo: Repository<ExternalInvoice>) {}

  findAll(): Promise<ExternalInvoice[]> {
    return this.repo.find({ order: { month: 'DESC', createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<ExternalInvoice> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('ExternalInvoice ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<ExternalInvoice>): Promise<ExternalInvoice> {
    return this.repo.save(this.repo.create({ invoicedUnit: 'day', ...data }));
  }

  async update(id: string, data: Partial<ExternalInvoice>): Promise<ExternalInvoice> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
