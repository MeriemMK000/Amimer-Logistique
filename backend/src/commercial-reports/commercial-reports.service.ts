import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommercialReport } from './commercial-reports.entity';
import { Vehicle } from '../vehicles/vehicles.entity';

@Injectable()
export class CommercialReportService {
  constructor(
    @InjectRepository(CommercialReport)
    private readonly repo: Repository<CommercialReport>,
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<CommercialReport[]> {
    return this.repo.find({ order: { month: 'DESC' } });
  }

  async findOne(id: string): Promise<CommercialReport> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('CommercialReport ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<CommercialReport>): Promise<CommercialReport> {
    return this.repo.save(this.repo.create({ source: 'manual', ...data }));
  }

  async update(id: string, data: Partial<CommercialReport>): Promise<CommercialReport> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('commercial-reports', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  /** Vehicules commerciaux sans releve pour le(s) mois demande(s) — le systeme reclame l'info. */
  async pending(month?: string): Promise<Array<{ vehicleCode: string; label: string; month: string; monthsMissing: string[] }>> {
    const target = month ?? new Date().toISOString().slice(0, 7);
    const comm = (await this.vehicles.find()).filter((v) => v.isCommercial);
    const reports = await this.repo.find();
    // 3 derniers mois glissants
    const months: string[] = [];
    const d = new Date(target + '-01T00:00:00');
    for (let i = 0; i < 3; i++) {
      months.push(d.toISOString().slice(0, 7));
      d.setMonth(d.getMonth() - 1);
    }
    const out: Array<{ vehicleCode: string; label: string; month: string; monthsMissing: string[] }> = [];
    for (const v of comm) {
      const missing = months.filter(
        (m) => !reports.some((r) => r.vehicleCode === v.code && r.month === m),
      );
      if (missing.length) {
        out.push({
          vehicleCode: v.code,
          label: `${v.brand ?? ''} ${v.model ?? ''}`.trim(),
          month: target,
          monthsMissing: missing,
        });
      }
    }
    return out;
  }
}
