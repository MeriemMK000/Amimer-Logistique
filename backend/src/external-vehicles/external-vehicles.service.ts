import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ExternalVehicle } from './external-vehicles.entity';

@Injectable()
export class ExternalVehicleService {
  constructor(
    @InjectRepository(ExternalVehicle)
    private readonly repo: Repository<ExternalVehicle>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<ExternalVehicle[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<ExternalVehicle> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('ExternalVehicle ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<ExternalVehicle>): Promise<ExternalVehicle> {
    requireFields(data as Record<string, unknown>, [{ key: 'label', label: 'désignation' }]);
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<ExternalVehicle>): Promise<ExternalVehicle> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('external-vehicles', id);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
