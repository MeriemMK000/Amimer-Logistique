import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vehicle } from './vehicles.entity';

@Injectable()
export class VehicleService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly repo: Repository<Vehicle>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<Vehicle[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<Vehicle> {
    const row = await this.repo.findOne({ where: { code: id as never } });
    if (!row) throw new NotFoundException('Vehicle ' + id + ' introuvable');
    return row;
  }

  /** Norme corrigée = norme constructeur × (1 + % correction) — cohérence garantie côté serveur. */
  private applyNormCorrection(v: Partial<Vehicle>): void {
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const pct = v.normCorrectionPct;
    if (pct == null) return;
    if (v.normOff != null) v.normCorr = r2(v.normOff * (1 + pct / 100));
    if (v.normOffH != null) v.normCorrH = r2(v.normOffH * (1 + pct / 100));
  }

  create(data: Partial<Vehicle>): Promise<Vehicle> {
    requireFields(data as Record<string, unknown>, [
      { key: 'code', label: 'code / immatriculation' },
      { key: 'brand', label: 'marque' },
      { key: 'model', label: 'modèle' },
      { key: 'type', label: 'type (léger / lourd / engin / remorque)' },
    ]);
    this.applyNormCorrection(data);
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<Vehicle>): Promise<Vehicle> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    this.applyNormCorrection(row);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('vehicles', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<Vehicle>[]): Promise<Vehicle[]> {
    await this.repo.clear();
    return this.repo.save(rows.map((row) => this.repo.create(row)));
  }
}
