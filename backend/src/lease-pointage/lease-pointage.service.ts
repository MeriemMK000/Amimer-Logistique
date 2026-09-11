import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LeasePointage } from './lease-pointage.entity';

/** Normalise la fraction de journee dans [0, 1] et en deduit `present`. */
function norm(data: Partial<LeasePointage>): Partial<LeasePointage> {
  const immobilized = data.immobilized === true;
  if (data.fraction !== undefined && data.fraction !== null) {
    const f = immobilized ? 1 : Math.max(0, Math.min(1, Number(data.fraction) || 0));
    return { ...data, fraction: f, immobilized, present: f > 0 || immobilized };
  }
  if (immobilized) return { ...data, fraction: 1, immobilized: true, present: true };
  // Retro-compat : si seul `present` est fourni.
  if (data.present !== undefined && data.present !== null) {
    return { ...data, fraction: data.present ? 1 : 0 };
  }
  return data;
}

@Injectable()
export class LeasePointageService {
  constructor(
    @InjectRepository(LeasePointage)
    private readonly repo: Repository<LeasePointage>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<LeasePointage[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<LeasePointage> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('LeasePointage ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<LeasePointage>): Promise<LeasePointage> {
    return this.repo.save(this.repo.create(norm(data)));
  }

  async update(id: string, data: Partial<LeasePointage>): Promise<LeasePointage> {
    const row = await this.findOne(id);
    Object.assign(row, norm(data));
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('lease-pointage', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<LeasePointage>[]): Promise<LeasePointage[]> {
    await this.repo.clear();
    return this.repo.save(rows.map((row) => this.repo.create(norm(row))));
  }

  /**
   * Saisie rapide en masse : cree ou met a jour les pointages (par vehicule + date).
   * fraction 0 et non immobilise -> supprime la ligne. Immobilise = jour facturable.
   */
  async upsertMany(
    rows: { vehicleCode: string; date: string; fraction: number; immobilized?: boolean; notes?: string }[],
  ): Promise<{ upserted: number; deleted: number }> {
    let upserted = 0;
    let deleted = 0;
    for (const r of rows) {
      const immo = r.immobilized === true;
      const f = immo ? 1 : Math.max(0, Math.min(1, Number(r.fraction) || 0));
      const existing = await this.repo.findOne({
        where: { vehicleCode: r.vehicleCode as never, date: r.date as never },
      });
      if (f === 0 && !immo) {
        if (existing) {
          await this.repo.delete(existing.id);
          deleted++;
        }
        continue;
      }
      if (existing) {
        existing.fraction = f;
        existing.immobilized = immo;
        existing.present = true;
        if (r.notes !== undefined) existing.notes = r.notes;
        await this.repo.save(existing);
      } else {
        await this.repo.save(
          this.repo.create({ vehicleCode: r.vehicleCode, date: r.date, fraction: f, immobilized: immo, present: true, notes: r.notes ?? '' }),
        );
      }
      upserted++;
    }
    return { upserted, deleted };
  }
}
