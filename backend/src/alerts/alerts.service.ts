import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert } from './alerts.entity';

@Injectable()
export class AlertService {
  constructor(
    @InjectRepository(Alert)
    private readonly repo: Repository<Alert>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<Alert[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<Alert> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('Alert ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<Alert>): Promise<Alert> {
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Alert>): Promise<Alert> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('alerts', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<Alert>[]): Promise<Alert[]> {
    await this.repo.clear();
    return this.repo.save(rows.map((row) => this.repo.create(row)));
  }
}
