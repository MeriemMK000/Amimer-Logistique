import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenanceOrder } from './maintenance-orders.entity';
import { MaintenanceFlag } from './maintenance-flag.entity';
import { Vehicle } from '../vehicles/vehicles.entity';

export const OT_STATUSES = ['ouvert', 'diagnostic', 'valide', 'en_lancement', 'termine', 'annule'];

function parseDate(d?: string | null): Date | null {
  if (!d) return null;
  const p = d.split('/');
  if (p.length === 3) return new Date(+p[2], +p[1] - 1, +p[0]);
  const iso = new Date(d);
  return isNaN(iso.getTime()) ? null : iso;
}

@Injectable()
export class MaintenanceOrderService {
  constructor(
    @InjectRepository(MaintenanceOrder) private readonly repo: Repository<MaintenanceOrder>,
    @InjectRepository(MaintenanceFlag) private readonly flags: Repository<MaintenanceFlag>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<MaintenanceOrder[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<MaintenanceOrder> {
    const row = await this.repo.findOne({ where: { num: id as never } });
    if (!row) throw new NotFoundException('MaintenanceOrder ' + id + ' introuvable');
    return row;
  }

  /** N° d'OT suivant : OT-<compteur> (le client peut aussi l'imposer). */
  private async nextNum(): Promise<string> {
    const all = await this.repo.find();
    const maxN = all.reduce((mx, o) => {
      const g = /(\d+)\s*$/.exec(o.num ?? '');
      return g ? Math.max(mx, parseInt(g[1], 10)) : mx;
    }, 400);
    return `OT-${String(maxN + 1).padStart(4, '0')}`;
  }

  async create(data: Partial<MaintenanceOrder>): Promise<MaintenanceOrder> {
    requireFields(data as Record<string, unknown>, [
      { key: 'vehicleCode', label: 'véhicule' },
      { key: 'title', label: 'intitulé' },
      { key: 'type', label: 'type (préventif / curatif)' },
      { key: 'date', label: 'date' },
    ]);
    const status = data.status ?? 'ouvert';
    const ot = await this.repo.save(
      this.repo.create({
        ...data,
        num: data.num || (await this.nextNum()),
        status,
        statusHistory: [{ status, at: new Date().toISOString(), note: 'Creation' }],
        // Le detenteur du vehicule doit etre informe et valider chaque intervention.
        holderNotifiedAt: data.vehicleCode ? new Date().toISOString() : null,
        holderValidated: false,
      }),
    );
    if (ot.vehicleCode) await this.runAnomalyChecks(ot);
    return ot;
  }

  /** Validation de l'intervention par le detenteur du vehicule. */
  async holderValidate(id: string, by?: string): Promise<MaintenanceOrder> {
    const row = await this.findOne(id);
    row.holderValidated = true;
    row.holderValidatedAt = new Date().toISOString();
    row.holderValidatedBy = by ?? null;
    return this.repo.save(row);
  }

  async update(id: string, data: Partial<MaintenanceOrder>): Promise<MaintenanceOrder> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    const saved = await this.repo.save(row);
    if (data.operations && saved.vehicleCode) await this.runAnomalyChecks(saved);
    return saved;
  }

  /** Transition de statut avec historisation. */
  async changeStatus(id: string, status: string, note?: string): Promise<MaintenanceOrder> {
    const row = await this.findOne(id);
    row.status = status;
    row.statusHistory = [...(row.statusHistory ?? []), { status, at: new Date().toISOString(), note }];
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('maintenance-orders', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<MaintenanceOrder>[]): Promise<MaintenanceOrder[]> {
    await this.repo.clear();
    return this.repo.save(
      rows.map((row) =>
        this.repo.create({
          status: 'ouvert',
          ...row,
          statusHistory: row.statusHistory ?? [{ status: row.status ?? 'ouvert', at: new Date().toISOString() }],
        }),
      ),
    );
  }

  // ────────── Anti-fraude / anti-redondance ──────────
  async listFlags(vehicleCode?: string): Promise<MaintenanceFlag[]> {
    return this.flags.find({ where: vehicleCode ? { vehicleCode } : {}, order: { createdAt: 'DESC' } });
  }

  /** Analyse l'OT vs l'historique et enregistre des alertes si redondance. */
  async runAnomalyChecks(ot: MaintenanceOrder): Promise<string[]> {
    const warnings: string[] = [];
    const all = await this.repo.find({ where: { vehicleCode: ot.vehicleCode as never } });
    const now = new Date();
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());

    // Meme titre d'OT recemment
    const sameTitle = all.filter(
      (o) => o.num !== ot.num && (o.title ?? '').toLowerCase() === (ot.title ?? '').toLowerCase(),
    );
    const thirtyAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
    const sameTitle30 = sameTitle.filter((o) => { const d = parseDate(o.date); return d && d >= thirtyAgo; });
    const sameTitleRecent = sameTitle.filter((o) => { const d = parseDate(o.date); return d && d >= twoMonthsAgo; });

    if (sameTitle30.length) {
      // Re-ouverture tres rapide => reparation qui ne tient pas / double facturation.
      warnings.push(`"${ot.title}" deja traitee il y a moins de 30 j sur ${ot.vehicleCode} (OT ${sameTitle30.map((o) => o.num).join(', ')}) — reparation non tenue ou doublon ?`);
    } else if (sameTitleRecent.length) {
      warnings.push(`Anomalie "${ot.title}" deja traitee recemment (< 2 mois) sur ${ot.vehicleCode} (OT ${sameTitleRecent.map((o) => o.num).join(', ')}).`);
    }
    if (sameTitle.length >= 3) {
      warnings.push(`"${ot.title}" reglee ${sameTitle.length + 1} fois sur ${ot.vehicleCode} (verifier).`);
    }

    // Operations / pieces repetees — cumul + cadence sur 2 mois (ex. "X filtres en 2 mois", retour DG)
    const opCount: Record<string, number> = {};
    const opCountRecent: Record<string, number> = {};
    all.forEach((o) => {
      const d = parseDate(o.date);
      const recent = !!d && d >= twoMonthsAgo;
      (o.operations ?? []).forEach((op: { desc?: string; label?: string }) => {
        const key = (op.desc ?? op.label ?? '').toLowerCase().trim();
        if (!key) return;
        opCount[key] = (opCount[key] ?? 0) + 1;
        if (recent) opCountRecent[key] = (opCountRecent[key] ?? 0) + 1;
      });
    });
    (ot.operations ?? []).forEach((op: { desc?: string; label?: string }) => {
      const key = (op.desc ?? op.label ?? '').toLowerCase().trim();
      if (!key) return;
      if ((opCountRecent[key] ?? 0) < 3 && (opCount[key] ?? 0) >= 3) {
        warnings.push(`Operation "${op.desc ?? op.label}" realisee ${opCount[key]} fois sur ${ot.vehicleCode}.`);
      }
      if ((opCountRecent[key] ?? 0) >= 3) {
        warnings.push(`Cadence anormale : "${op.desc ?? op.label}" ${opCountRecent[key]} fois en 2 mois sur ${ot.vehicleCode} — verifier (fraude / usure anormale).`);
      }
    });

    for (const msg of warnings) {
      const exists = await this.flags.findOne({ where: { vehicleCode: ot.vehicleCode as never, message: msg } });
      if (!exists) {
        const kind = /cadence anormale|doublon|non tenue|fraude/i.test(msg) ? 'fraud' : 'redundancy';
        await this.flags.save(
          this.flags.create({ vehicleCode: ot.vehicleCode!, otNum: ot.num, kind, message: msg }),
        );
      }
    }
    return warnings;
  }

  // ────────── KPI / Coûts / Performance (Partie 3) ──────────
  async kpis(fromIso?: string, toIso?: string) {
    const from = fromIso ? new Date(fromIso) : null;
    const to = toIso ? new Date(toIso) : null;
    const inPeriod = (o: MaintenanceOrder) => {
      const d = parseDate(o.date);
      if (!d) return !from && !to;
      if (from && d < from) return false;
      if (to && d > to) return false;
      return true;
    };
    const all = await this.repo.find();
    const period = all.filter(inPeriod);
    const vlist = await this.vehicles.find();
    const typeOf = (code: string | null) => vlist.find((v) => v.code === code)?.type ?? '?';

    const countBy = (arr: MaintenanceOrder[], pred: (o: MaintenanceOrder) => boolean) => arr.filter(pred).length;
    const cost = (arr: MaintenanceOrder[]) => arr.reduce((s, o) => s + (o.totalCost ?? 0), 0);

    const byVehicle: Record<string, number> = {};
    period.forEach((o) => { if (o.vehicleCode) byVehicle[o.vehicleCode] = (byVehicle[o.vehicleCode] ?? 0) + 1; });
    const topVehicleOT = Object.entries(byVehicle).sort((a, b) => b[1] - a[1])[0] ?? null;

    const breakdownHoursPeriod = period.reduce((s, o) => s + (o.breakdownHours ?? 0), 0);
    const breakdownHoursCumul = all.reduce((s, o) => s + (o.breakdownHours ?? 0), 0);
    const hoursByVehiclePeriod: Record<string, number> = {};
    period.forEach((o) => { if (o.vehicleCode) hoursByVehiclePeriod[o.vehicleCode] = (hoursByVehiclePeriod[o.vehicleCode] ?? 0) + (o.breakdownHours ?? 0); });
    const mostStopped = Object.entries(hoursByVehiclePeriod).sort((a, b) => b[1] - a[1])[0] ?? null;

    const prev = (o: MaintenanceOrder) => (o.type ?? '').toUpperCase() === 'PERIODIQUE';
    const cur = (o: MaintenanceOrder) => (o.type ?? '').toUpperCase() === 'CURATIVE';
    const done = (o: MaintenanceOrder) => ['termine', 'TERMINE'].includes(o.status ?? '');

    const costByType: Record<string, number> = { LEGER: 0, LOURD: 0, ENGIN: 0, REMORQUE: 0 };
    period.forEach((o) => { const t = typeOf(o.vehicleCode); if (costByType[t] != null) costByType[t] += o.totalCost ?? 0; });

    const costByVehicle = Object.fromEntries(
      Object.keys(byVehicle).map((code) => [code, cost(period.filter((o) => o.vehicleCode === code))]),
    );

    // Performance : a temps vs en retard (approx : OT preventif fait avant/apres son echeance de date)
    const prevDone = period.filter((o) => prev(o) && done(o));
    const onTime = prevDone.length; // sans plan lie precis on considere fait = a temps
    const late = 0;

    return {
      period: { from: fromIso ?? null, to: toIso ?? null },
      otCountPeriod: period.length,
      otCountCumul: all.length,
      topVehicleOT: topVehicleOT ? { code: topVehicleOT[0], count: topVehicleOT[1] } : null,
      prevPeriod: countBy(period, prev), prevCumul: countBy(all, prev),
      curPeriod: countBy(period, cur), curCumul: countBy(all, cur),
      tauxPreventifRealise: prevDone.length && countBy(period, prev)
        ? Math.round((prevDone.length / countBy(period, prev)) * 100)
        : 0,
      tauxPannes: period.length ? Math.round((countBy(period, cur) / period.length) * 100) : 0,
      breakdownHoursPeriod, breakdownHoursCumul,
      mostStopped: mostStopped ? { code: mostStopped[0], hours: mostStopped[1] } : null,
      costPeriod: cost(period), costCumul: cost(all),
      costByType, costByVehicle,
      perf: {
        onTimePct: prevDone.length ? Math.round((onTime / prevDone.length) * 100) : 0,
        latePct: prevDone.length ? Math.round((late / prevDone.length) * 100) : 0,
      },
      topCostlyVehicles: Object.entries(costByVehicle)
        .sort((a, b) => (b[1] as number) - (a[1] as number))
        .slice(0, 5)
        .map(([code, c]) => ({ code, cost: c })),
    };
  }
}
