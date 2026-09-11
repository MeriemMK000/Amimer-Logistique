import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from './incidents.entity';
import { Vehicle } from '../vehicles/vehicles.entity';

export const INCIDENT_STATUSES = [
  'declare', 'envoye_assurance', 'prise_en_charge', 'en_remboursement', 'clos',
] as const;

@Injectable()
export class IncidentService {
  constructor(
    @InjectRepository(Incident) private readonly repo: Repository<Incident>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly dependency: DependencyService,
  ) {}

  async findAll(): Promise<any[]> {
    const list = await this.repo.find({ order: { date: 'DESC' } });
    return list.map((i) => ({ ...i, delayAlert: this.delayAlert(i) }));
  }

  async findOne(id: string): Promise<Incident> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('Incident ' + id + ' introuvable');
    return row;
  }

  /** Alerte retard : envoyé à l'assurance depuis > 30 j sans prise en charge, ou remboursement attendu dépassé. */
  private delayAlert(i: Incident): string | null {
    const now = Date.now();
    const days = (d?: string | null) => (d ? (now - new Date(d).getTime()) / 86400000 : null);
    if (i.status === 'envoye_assurance') {
      const d = days(i.insurerSentAt);
      if (d != null && d > 30) return `Assurance sans réponse depuis ${Math.round(d)} j`;
    }
    if (i.status === 'en_remboursement' && i.reimbursementExpectedAt) {
      if (new Date(i.reimbursementExpectedAt).getTime() < now) return 'Remboursement en retard';
    }
    return null;
  }

  create(data: Partial<Incident>): Promise<Incident> {
    requireFields(data as Record<string, unknown>, [
      { key: 'vehicleCode', label: 'véhicule' },
      { key: 'date', label: 'date' },
      { key: 'type', label: 'type d’incident' },
    ]);
    const now = new Date().toISOString();
    return this.repo.save(this.repo.create({
      status: 'declare',
      statusHistory: [{ status: 'declare', at: now, note: 'Déclaration' }],
      photos: data.photos ?? [],
      ...data,
    }));
  }

  async update(id: string, data: Partial<Incident>): Promise<Incident> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  /** Avance le dossier ; à la clôture, met à jour la fiche véhicule (compteur incidents). */
  async changeStatus(id: string, status: string, note?: string): Promise<Incident> {
    const row = await this.findOne(id);
    const now = new Date().toISOString();
    row.status = status;
    row.statusHistory = [...(row.statusHistory ?? []), { status, at: now, note: note ?? null }];
    if (status === 'envoye_assurance' && !row.insurerSentAt) row.insurerSentAt = now.slice(0, 10);
    if (status === 'prise_en_charge' && !row.priseEnChargeAt) row.priseEnChargeAt = now.slice(0, 10);
    if (status === 'clos') row.closedAt = now.slice(0, 10);
    const saved = await this.repo.save(row);
    if (status === 'clos' && row.vehicleCode) {
      const v = await this.vehicles.findOne({ where: { code: row.vehicleCode as never } });
      if (v) {
        v.breakdownHours = v.breakdownHours ?? 0; // no-op touch to persist fiche update timestamp
        await this.vehicles.save(v);
      }
    }
    return saved;
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('incidents', id);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
