import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { roadDistance, axisPosition } from '../common/dz-geo';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { DpcRequest } from './dpc-requests.entity';

@Injectable()
export class DpcRequestService {
  constructor(
    @InjectRepository(DpcRequest)
    private readonly repo: Repository<DpcRequest>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<DpcRequest[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<DpcRequest> {
    const row = await this.repo.findOne({ where: { code: id as never } });
    if (!row) throw new NotFoundException('DpcRequest ' + id + ' introuvable');
    return row;
  }

  /** Prochain code DPC-AAAA-NNNN. */
  private async nextCode(): Promise<string> {
    const year = new Date().getFullYear();
    const rows = await this.repo.find();
    const max = rows
      .map((r) => Number((r.code ?? '').match(/DPC-\d{4}-(\d+)/)?.[1] ?? 0))
      .reduce((a, b) => Math.max(a, b), 0);
    return `DPC-${year}-${String(max + 1).padStart(4, '0')}`;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private withDistance<T extends Partial<DpcRequest>>(data: T): T {
    const d = roadDistance(data.depAller ?? '', data.destAller ?? '');
    if (d != null) data.distanceKm = d;
    return data;
  }

  create(data: Partial<DpcRequest>): Promise<DpcRequest> {
    requireFields(data as Record<string, unknown>, [
      { key: 'destAller', label: 'destination' },
      { key: 'dateAller', label: 'date aller' },
      { key: 'structure', label: 'structure à transporter' },
    ]);
    return this.repo.save(this.repo.create(this.withDistance({ source: 'interne', ...data })));
  }

  /**
   * Formulaire public — quelqu'un renseigne et envoie une demande de prise en charge.
   * Entre dans la file DPC en `EN_ATTENTE` (à valider par la logistique).
   */
  async createFromForm(body: {
    requesterName?: string; phone?: string; email?: string; organisation?: string; structure?: string;
    fromLoc?: string; toLoc?: string; dateAller?: string; dateRetour?: string; pax?: number; tonnage?: number;
    priorite?: string; bu?: string; notes?: string;
  }): Promise<DpcRequest> {
    if (!body.requesterName || !body.fromLoc || !body.toLoc || !body.dateAller) {
      requireFields(body as Record<string, unknown>, [
        { key: 'requesterName', label: 'nom du demandeur' },
        { key: 'fromLoc', label: 'lieu de départ' },
        { key: 'toLoc', label: 'destination' },
        { key: 'dateAller', label: 'date aller' },
      ]);
    }
    const code = await this.nextCode();
    return this.repo.save(this.repo.create(this.withDistance({
      code,
      source: 'formulaire',
      statut: 'EN_ATTENTE',
      dateSaisie: this.today(),
      dateAller: body.dateAller ?? null,
      dateRetour: body.dateRetour ?? null,
      depAller: body.fromLoc ?? null,
      destAller: body.toLoc ?? null,
      depRetour: body.toLoc ?? null,
      destRetour: body.fromLoc ?? null,
      bu: body.bu ?? null,
      structure: body.structure ?? (body.organisation ?? null),
      priorite: body.priorite ?? 'NORMALE',
      urgence: body.priorite === 'URGENTE' ? 'URGENTE' : 'NORMALE',
      notes: body.notes ?? null,
      demandeur: body.requesterName ?? null,
      demandeurTel: body.phone ?? null,
      demandeurEmail: body.email ?? null,
      organisation: body.organisation ?? null,
      pax: body.pax != null ? Number(body.pax) : null,
      tonnage: body.tonnage != null ? Number(body.tonnage) : null,
    })));
  }

  /**
   * Import depuis la plateforme Amimer Énergie — demandes déjà validées de leur côté
   * (« une fois une mission validée »). Entrent en `VALIDEE`, prêtes à devenir des missions.
   * Accepte `{ csv }` (colonnes: refExterne,requesterName,fromLoc,toLoc,dateAller,dateRetour,pax,tonnage,organisation,structure,bu)
   * ou `{ rows: [...] }`.
   */
  async importFromPlatform(body: { csv?: string; rows?: Record<string, unknown>[] }): Promise<{ imported: number; codes: string[] }> {
    let rows: Record<string, string>[] = [];
    if (body.csv?.trim()) {
      rows = parse(body.csv, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[];
    } else if (Array.isArray(body.rows)) {
      rows = body.rows as Record<string, string>[];
    }
    const codes: string[] = [];
    for (const r of rows) {
      const from = r.fromLoc ?? r.depAller ?? '';
      const to = r.toLoc ?? r.destAller ?? '';
      if (!from || !to) continue;
      const code = await this.nextCode();
      await this.repo.save(this.repo.create(this.withDistance({
        code,
        source: 'amimer_energie',
        statut: 'VALIDEE',
        dateSaisie: this.today(),
        dateAller: r.dateAller || null,
        dateRetour: r.dateRetour || null,
        depAller: from, destAller: to, depRetour: to, destRetour: from,
        bu: r.bu || null,
        structure: r.structure || r.organisation || null,
        priorite: r.priorite || 'NORMALE',
        urgence: r.urgence || 'NORMALE',
        notes: r.notes || 'Import plateforme Amimer Énergie',
        demandeur: r.requesterName || r.demandeur || null,
        organisation: r.organisation || null,
        pax: r.pax ? Number(r.pax) : null,
        tonnage: r.tonnage ? Number(r.tonnage) : null,
        refExterne: r.refExterne || r.ref || null,
      })));
      codes.push(code);
    }
    return { imported: codes.length, codes };
  }

  /**
   * Demandes « groupables » dans une mission A→B à une date donnée (retour DG) :
   * même axe (couloir ~35 km, pas de retour arrière) + dates compatibles (±2 j) + non transformées.
   */
  async groupable(body: { fromLoc?: string; toLoc?: string; dateStart?: string; excludeCodes?: string[] }): Promise<Array<DpcRequest & { detourKm: number; segmentKm: number }>> {
    const { fromLoc = '', toLoc = '', dateStart = '', excludeCodes = [] } = body ?? {};
    if (!fromLoc || !toLoc) return [];
    const axisKm = roadDistance(fromLoc, toLoc) ?? 0;
    const dayMs = 86_400_000;
    const refDay = dateStart ? new Date(dateStart).getTime() : NaN;
    const rows = await this.repo.find();
    const out: Array<DpcRequest & { detourKm: number; segmentKm: number }> = [];
    for (const d of rows) {
      if (excludeCodes.includes(d.code)) continue;
      if (d.missionRef || d.statut === 'TRANSFORMEE' || d.statut === 'REJETEE') continue;
      // dates compatibles
      if (!Number.isNaN(refDay) && d.dateAller) {
        const gap = Math.abs(new Date(d.dateAller).getTime() - refDay) / dayMs;
        if (gap > 2) continue;
      }
      // Même axe : détour routier faible + progression vers T (pas de retour arrière).
      // Le couloir géométrique sert de garde-fou large (données de coords approximatives).
      const p1 = axisPosition(fromLoc, toLoc, d.depAller ?? '');
      const p2 = axisPosition(fromLoc, toLoc, d.destAller ?? '');
      const dpcKm = roadDistance(d.depAller ?? '', d.destAller ?? '') ?? 0;
      const detour = (roadDistance(fromLoc, d.depAller ?? '') ?? 0) + dpcKm + (roadDistance(d.destAller ?? '', toLoc) ?? 0) - axisKm;
      const forward = !p1 || !p2 || (p2.alongKm >= p1.alongKm - 30 && p1.alongKm <= axisKm + 40 && p2.alongKm <= axisKm + 60);
      const corridor = (!p1 || p1.onAxis) && (!p2 || p2.onAxis);
      const okDetour = detour <= Math.max(50, axisKm * 0.18);
      if (forward && corridor && okDetour) out.push({ ...d, detourKm: Math.max(0, Math.round(detour)), segmentKm: dpcKm });
    }
    return out.sort((a, b) => a.detourKm - b.detourKm);
  }

  /** Validation logistique : passe la demande en VALIDEE (prête à devenir mission). */
  async validate(id: string): Promise<DpcRequest> {
    const row = await this.findOne(id);
    row.statut = 'VALIDEE';
    if (row.distanceKm == null) this.withDistance(row);
    return this.repo.save(row);
  }

  async update(id: string, data: Partial<DpcRequest>): Promise<DpcRequest> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    if (data.depAller != null || data.destAller != null) this.withDistance(row);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('dpc-requests', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<DpcRequest>[]): Promise<DpcRequest[]> {
    await this.repo.clear();
    return this.repo.save(rows.map((row) => this.repo.create(row)));
  }
}
