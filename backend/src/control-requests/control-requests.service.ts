import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DependencyService } from '../common/dependency.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ControlRequest } from './control-requests.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { MaintenanceOrder } from '../maintenance-orders/maintenance-orders.entity';
import { Evaluation } from '../evaluations/evaluations.entity';
import { Incident } from '../incidents/incidents.entity';

/** Rubriques par défaut de la fiche de contrôle périodique (retour DG). */
export const DEFAULT_CONTROL_CATEGORIES = [
  { key: 'general', label: 'État général' },
  { key: 'mecanique', label: 'Mécanique (moteur, transmission, freinage)' },
  { key: 'suspension', label: 'Suspension' },
  { key: 'documents', label: 'Documents' },
  { key: 'feux', label: 'Feux et signalisation' },
  { key: 'pneumatique', label: 'Pneumatique' },
];
const ETAT_SCORE: Record<string, number> = { bon: 18, moyen: 12, mauvais: 6 };

@Injectable()
export class ControlRequestService implements OnModuleInit {
  private readonly logger = new Logger(ControlRequestService.name);

  constructor(
    @InjectRepository(ControlRequest) private readonly repo: Repository<ControlRequest>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(MaintenanceOrder) private readonly ots: Repository<MaintenanceOrder>,
    @InjectRepository(Evaluation) private readonly evals: Repository<Evaluation>,
    @InjectRepository(Incident) private readonly incidents: Repository<Incident>,
    private readonly dependency: DependencyService,
  ) {}

  onModuleInit() {
    setTimeout(() => this.generate().catch((e) => this.logger.warn(String(e))), 4000);
  }

  findAll(): Promise<ControlRequest[]> {
    return this.repo.find({ order: { dueDate: 'ASC' } });
  }

  async findOne(id: string): Promise<ControlRequest> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('ControlRequest ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<ControlRequest>): Promise<ControlRequest> {
    return this.repo.save(this.repo.create({ status: 'pending', generatedAt: new Date().toISOString().slice(0, 10), ...data }));
  }

  async update(id: string, data: Partial<ControlRequest>): Promise<ControlRequest> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('control-requests', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  /**
   * Contrôle périodique « intelligent » (retour DG) : tirage aléatoire pondéré par
   *  - volume km (usage élevé)
   *  - panne récente (véhicule EN_PANNE ou heures de panne)
   *  - entretien récent (OT terminé récemment → moins urgent)
   *  - post-accident (incident récent)
   *  - état passé jugé critique (dernier contrôle avec une rubrique « mauvais » / note basse)
   *  - part d'aléatoire
   * + GARANTIE : tout véhicule/engin sans contrôle depuis > 6 mois est réclamé d'office.
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async generate(): Promise<{ created: number }> {
    const vehicles = (await this.vehicles.find()).filter((v) => v.status !== 'HORS_SERVICE');
    const ots = await this.ots.find();
    const allIncidents = await this.incidents.find();
    const pending = await this.repo.find({ where: { status: 'pending' as never } });
    const pendingByVeh = new Set(pending.map((p) => p.vehicleCode));
    const now = Date.now();
    // On ne réclame pas tout le parc d'un coup : au plus 5 nouvelles demandes ouvertes par passage.
    const MAX_OPEN = 5;
    let created = 0;
    const candidates: { v: (typeof vehicles)[number]; weight: number; reason: string; due: string }[] = [];

    for (const v of vehicles) {
      if (pendingByVeh.has(v.code)) continue; // déjà une demande ouverte
      const vOts = ots.filter((o) => o.vehicleCode === v.code);
      const last = await this.repo.findOne({
        where: { vehicleCode: v.code as never, status: 'done' as never },
        order: { respondedAt: 'DESC' },
      });
      const daysSince = last?.respondedAt ? (now - new Date(last.respondedAt).getTime()) / 86400000 : 999;

      const usageW = Math.min(1, (v.km ?? 0) / 300000);
      const panneW = ['EN_PANNE', 'EN_MAINTENANCE'].includes((v.status ?? '').toUpperCase()) || (v.breakdownHours ?? 0) > 0 ? 1 : 0;
      const recentOt = vOts.some((o) => (o.status ?? '').toLowerCase() === 'termine' && o.date && (now - new Date(o.date).getTime()) / 86400000 < 30);
      const entretienW = recentOt ? -0.4 : 0; // entretien récent → on relâche
      const accidentW = allIncidents.some((i) => i.vehicleCode === v.code && i.date && (now - new Date(i.date).getTime()) / 86400000 < 90) ? 1 : 0;
      const critW = last && (
        (last.score != null && last.score < 10) ||
        (Array.isArray(last.categories) && (last.categories as { etat?: string }[]).some((c) => c.etat === 'mauvais'))
      ) ? 1 : 0;
      const ageW = Math.min(1, daysSince / 90);
      const randomW = Math.random();
      const weight = +(
        usageW * 0.20 + panneW * 0.20 + accidentW * 0.15 + critW * 0.15 + ageW * 0.15 + randomW * 0.15 + entretienW
      ).toFixed(3);

      const semestriel = daysSince > 180;
      if (weight < 0.55 && !semestriel) continue;

      const reasons: string[] = [];
      if (semestriel) reasons.push('contrôle semestriel obligatoire');
      if (usageW > 0.6) reasons.push('usage élevé');
      if (panneW) reasons.push('panne récente');
      if (accidentW) reasons.push('post-accident');
      if (critW) reasons.push('état passé critique');
      if (ageW > 0.7 && !semestriel) reasons.push('contrôle ancien');
      if (!reasons.length) reasons.push('sélection aléatoire');

      const due = new Date(now + 7 * 86400000).toISOString().slice(0, 10);
      candidates.push({ v, weight: semestriel ? Math.max(weight, 1) : weight, reason: reasons.join(', '), due });
    }

    const slots = Math.max(0, MAX_OPEN - pending.length);
    for (const c of candidates.sort((a, b) => b.weight - a.weight).slice(0, slots)) {
      await this.repo.save(this.repo.create({
        vehicleCode: c.v.code, driverCode: c.v.driverCode ?? null,
        generatedAt: new Date().toISOString().slice(0, 10), dueDate: c.due,
        reason: c.reason, weight: +c.weight.toFixed(3), status: 'pending',
        categories: DEFAULT_CONTROL_CATEGORIES.map((cat) => ({ ...cat, etat: null, maintenance: false, comment: '' })),
      }));
      created += 1;
    }
    if (created) this.logger.log(`${created} demande(s) de controle periodique generee(s)`);
    return { created };
  }

  /**
   * Réponse au contrôle : relevé km + fiche par rubrique (bon/moyen/mauvais + commentaire +
   * signalement maintenance) → note calculée → évaluation véhicule + chauffeur ;
   * si un point est « mauvais » ou signalé maintenance → OT curatif « ouvert » créé.
   */
  async respond(
    id: string,
    body: {
      km?: number; etat?: string; score?: number; note?: string; photoId?: string;
      categories?: { key: string; label: string; etat?: string; maintenance?: boolean; comment?: string }[];
    },
  ): Promise<ControlRequest> {
    const row = await this.findOne(id);
    const cats = body.categories ?? [];
    // Note : fournie, sinon moyenne des rubriques renseignées.
    const rated = cats.filter((c) => c.etat && ETAT_SCORE[c.etat] != null);
    const autoScore = rated.length ? Math.round((rated.reduce((s, c) => s + ETAT_SCORE[c.etat!], 0) / rated.length) * 10) / 10 : null;
    const score = body.score ?? autoScore ?? undefined;
    const etatGeneral = body.etat ?? cats.find((c) => c.key === 'general')?.etat ?? null;

    // OT curatif si un point est mauvais / signalé.
    const flagged = cats.filter((c) => c.etat === 'mauvais' || c.maintenance);
    let otNum: string | null = null;
    if (flagged.length && row.vehicleCode) {
      const last = await this.ots.find({ order: { num: 'DESC' }, take: 1 });
      const maxN = last[0] ? parseInt(last[0].num.replace(/\D/g, ''), 10) || 0 : 0;
      otNum = `OT-${String(maxN + 1).padStart(4, '0')}`;
      await this.ots.save(this.ots.create({
        num: otNum, vehicleCode: row.vehicleCode, type: 'CURATIVE',
        title: `Contrôle périodique — ${flagged.map((c) => c.label).join(', ')}`,
        priority: flagged.some((c) => c.etat === 'mauvais') ? 'HAUTE' : 'MOYENNE',
        status: 'ouvert', date: new Date().toISOString().slice(0, 10),
        operations: flagged.map((c) => ({ label: `${c.label} — ${c.etat ?? 'à vérifier'}${c.comment ? ` (${c.comment})` : ''}`, coutEstime: 0 })),
        statusHistory: [{ status: 'ouvert', at: new Date().toISOString(), note: `Issu du contrôle périodique ${row.id}` }],
      }));
    }

    Object.assign(row, {
      km: body.km ?? null, etat: etatGeneral, score: score ?? null,
      note: body.note ?? null, photoId: body.photoId ?? null,
      categories: cats.length ? cats : row.categories, otNum,
      status: 'done', respondedAt: new Date().toISOString().slice(0, 10),
    });
    const saved = await this.repo.save(row);

    if (score != null) {
      const date = saved.respondedAt!;
      await this.evals.save(this.evals.create({
        subjectType: 'vehicle', subjectCode: row.vehicleCode, date, score,
        criteria: { etat: etatGeneral, km: body.km, rubriques: cats }, note: body.note ?? null,
        source: 'controle_periodique', relatedVehicle: row.vehicleCode, relatedDriver: row.driverCode,
      }));
      if (row.driverCode) {
        await this.evals.save(this.evals.create({
          subjectType: 'driver', subjectCode: row.driverCode, date, score,
          criteria: { etat: etatGeneral }, note: body.note ?? null,
          source: 'controle_periodique', relatedVehicle: row.vehicleCode, relatedDriver: row.driverCode,
        }));
      }
    }
    if (body.km != null && row.vehicleCode) {
      const v = await this.vehicles.findOne({ where: { code: row.vehicleCode as never } });
      if (v && (v.km == null || body.km > v.km)) { v.km = body.km; await this.vehicles.save(v); }
    }
    return saved;
  }
}
