import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenancePlansService } from '../maintenance-plans/maintenance-plans.service';
import { Alert } from '../alerts/alerts.entity';
import { Driver } from '../drivers/drivers.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { MaintenanceOrder } from '../maintenance-orders/maintenance-orders.entity';

/** Types de véhicules conduits par un chauffeur (les engins ont des opérateurs dédiés). */
const DRIVEN_TYPES = ['LEGER', 'LOURD'];
const BALANCE_ALERT_TITLE = 'Équilibre flotte — sur / sous-effectif chauffeurs (14 j)';
const BLOCKED_STATUSES = ['EN_PANNE', 'HORS_SERVICE', 'EN_MAINTENANCE', 'EN_ENTRETIEN'];
const OPEN_OT = ['ouvert', 'diagnostic', 'valide', 'en_lancement'];
const DRIVER_UNAVAIL = ['EN_CONGE', 'CONGE', 'INDISPONIBLE', 'ABSENT'];

const dayMs = 86_400_000;
// Arithmétique de dates en UTC (évite les décalages de fuseau sur la timeline).
const startOfDay = (d: Date) => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); return x; };
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * dayMs);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Estime une durée de réparation en jours à partir des opérations d'un OT ("2h", "3 j", "1 jour"…). */
function repairDaysFromOps(ops: unknown): number {
  if (!Array.isArray(ops)) return 0;
  let hours = 0;
  for (const o of ops as { duree?: string }[]) {
    const s = String(o?.duree ?? '').toLowerCase();
    const mj = s.match(/([\d.]+)\s*(j|jour)/);
    const mh = s.match(/([\d.]+)\s*h/);
    if (mj) hours += parseFloat(mj[1]) * 8;
    else if (mh) hours += parseFloat(mh[1]);
  }
  return hours > 0 ? Math.ceil(hours / 8) : 0;
}

export interface FleetBalanceDay {
  date: string;
  driversAvailable: number;
  vehiclesAvailable: number;
  byType: Record<string, number>;
  surplusDrivers: number; // > 0 : sureffectif chauffeurs · < 0 : sous-effectif (manque de chauffeurs)
  state: 'SUREFFECTIF' | 'SOUSEFFECTIF' | 'EQUILIBRE';
}

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);

  constructor(
    private readonly plans: MaintenancePlansService,
    @InjectRepository(Alert) private readonly alerts: Repository<Alert>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(MaintenanceOrder) private readonly ots: Repository<MaintenanceOrder>,
  ) {}

  /**
   * Simulation d'équilibre flotte sur 14 jours (retour DG) : par type de véhicule,
   * en tenant compte du plan de maintenance préventive, des pannes actuelles et du
   * délai prévisionnel de remise en marche (durée des opérations de l'OT ouvert, sinon
   * défaut selon la priorité / le statut). Renvoie une timeline jour par jour + les
   * jours en sur-effectif / sous-effectif chauffeurs.
   */
  async simulateFleetBalance(horizonDays = 14): Promise<{
    horizonDays: number;
    driversAvailable: number;
    timeline: FleetBalanceDay[];
    outages: { vehicleCode: string; type: string | null; from: string; to: string; reason: string }[];
    summary: { firstSureffectifDay: string | null; firstSouseffectifDay: string | null; maxSurplus: number; maxDeficit: number };
  }> {
    const today = startOfDay(new Date());
    const [vehicles, drivers, ots, due] = await Promise.all([
      this.vehicles.find(),
      this.drivers.find(),
      this.ots.find(),
      this.plans.computeDue().catch(() => [] as { vehicleCode: string; planName: string; overdue: boolean; alert: boolean; remaining: number }[]),
    ]);

    const outages: { vehicleCode: string; type: string | null; from: Date; to: Date; reason: string }[] = [];

    // 1) Pannes / maintenances en cours → date de remise en service estimée.
    for (const v of vehicles) {
      if (!BLOCKED_STATUSES.includes((v.status ?? '').toUpperCase())) continue;
      const ot = ots
        .filter((o) => o.vehicleCode === v.code && OPEN_OT.includes((o.status ?? '').toLowerCase()))
        .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
      let days = repairDaysFromOps(ot?.operations);
      if (!days) {
        const pr = (ot?.priority ?? '').toUpperCase();
        days = pr === 'CRITIQUE' ? 5 : pr === 'HAUTE' ? 3 : pr === 'MOYENNE' ? 2 : (v.status ?? '').toUpperCase() === 'EN_PANNE' ? 4 : 3;
      }
      const start = ot?.date && new Date(ot.date) > today ? new Date(ot.date) : today;
      outages.push({
        vehicleCode: v.code, type: v.type, from: today, to: addDays(startOfDay(start), days),
        reason: ot ? `OT ${ot.num} (${ot.status}) — réparation estimée ${days} j` : `${v.status} — remise en marche ~${days} j`,
      });
    }

    // 2) Échéances préventives dans l'horizon → 1 jour d'immobilisation.
    for (const d of due) {
      if (!d.overdue && !d.alert) continue;
      const already = outages.find((o) => o.vehicleCode === d.vehicleCode);
      if (already) continue;
      const offset = d.overdue ? 0 : Math.min(horizonDays - 1, Math.max(1, Math.round(horizonDays * 0.4)));
      const v = vehicles.find((x) => x.code === d.vehicleCode);
      outages.push({
        vehicleCode: d.vehicleCode, type: v?.type ?? null,
        from: addDays(today, offset), to: addDays(today, offset + 1),
        reason: `${d.overdue ? 'Entretien en retard' : 'Entretien à prévoir'} — ${d.planName}`,
      });
    }

    const driversAvailable = drivers.filter((d) => !DRIVER_UNAVAIL.includes((d.status ?? '').toUpperCase())).length;

    const timeline: FleetBalanceDay[] = [];
    for (let i = 0; i < horizonDays; i++) {
      const day = addDays(today, i);
      const byType: Record<string, number> = {};
      let vehiclesAvailable = 0;
      for (const T of DRIVEN_TYPES) {
        const avail = vehicles.filter((v) => {
          if ((v.type ?? '').toUpperCase() !== T) return false;
          return !outages.some((o) => o.vehicleCode === v.code && day >= o.from && day < o.to);
        }).length;
        byType[T] = avail;
        vehiclesAvailable += avail;
      }
      const surplusDrivers = driversAvailable - vehiclesAvailable;
      timeline.push({
        date: iso(day),
        driversAvailable,
        vehiclesAvailable,
        byType,
        surplusDrivers,
        state: surplusDrivers > 0 ? 'SUREFFECTIF' : surplusDrivers < 0 ? 'SOUSEFFECTIF' : 'EQUILIBRE',
      });
    }

    const firstSureffectifDay = timeline.find((t) => t.surplusDrivers > 0)?.date ?? null;
    const firstSouseffectifDay = timeline.find((t) => t.surplusDrivers < 0)?.date ?? null;
    const maxSurplus = Math.max(0, ...timeline.map((t) => t.surplusDrivers));
    const maxDeficit = Math.max(0, ...timeline.map((t) => -t.surplusDrivers));

    return {
      horizonDays,
      driversAvailable,
      timeline,
      outages: outages.map((o) => ({ vehicleCode: o.vehicleCode, type: o.type, from: iso(o.from), to: iso(o.to), reason: o.reason })),
      summary: { firstSureffectifDay, firstSouseffectifDay, maxSurplus, maxDeficit },
    };
  }

  /** Genere les alertes d'echeance d'entretien preventif. Toutes les heures + au demarrage. */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshMaintenanceAlerts(): Promise<{ created: number }> {
    const due = await this.plans.computeDue();
    let created = 0;
    for (const d of due.filter((x) => x.alert || x.overdue)) {
      const title = `${d.overdue ? 'ENTRETIEN EN RETARD' : 'Entretien a prevoir'} — ${d.planName} (${d.vehicleCode})`;
      const exists = await this.alerts.findOne({ where: { title, category: 'maintenance' } });
      const unit = d.trigger === 'HOURS' ? 'h' : 'km';
      const desc = d.overdue
        ? `Depasse de ${Math.abs(d.remaining)} ${unit}. Echeance : ${d.nextDue} ${unit}. Ouvrir un OT.`
        : `Reste ${d.remaining} ${unit} avant echeance (${d.nextDue} ${unit}). Cout estime ${d.estimatedCost} DA.`;
      if (exists) {
        exists.description = desc;
        exists.priority = d.overdue ? 'CRITIQUE' : 'HAUTE';
        await this.alerts.save(exists);
      } else {
        await this.alerts.save(
          this.alerts.create({
            type: d.overdue ? 'dg' : 'wr',
            title,
            description: desc,
            timeLabel: 'auto',
            category: 'maintenance',
            priority: d.overdue ? 'CRITIQUE' : 'HAUTE',
          }),
        );
        created++;
      }
    }
    if (created) this.logger.log(`${created} alerte(s) d'echeance maintenance creee(s)`);
    return { created };
  }

  /**
   * Alerte d'équilibre flotte / chauffeurs sur 14 jours (demande DG).
   *
   * Le système simule jour par jour, en tenant compte du plan de maintenance
   * préventive, des pannes actuelles et du délai prévisionnel de remise en marche.
   * Il lève une alerte (catégorie « flotte ») dès qu'un jour de l'horizon est en
   * sur-effectif (chauffeurs > véhicules) ou en sous-effectif (véhicules à l'arrêt
   * faute de chauffeur). L'alerte est mise à jour à chaque passage et retirée
   * automatiquement quand l'horizon redevient équilibré.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshDriverBalanceAlert(): Promise<{ raised: boolean; surplus: number }> {
    const sim = await this.simulateFleetBalance(14);
    const drivers = await this.drivers.find();

    const existing = await this.alerts.findOne({
      where: [
        { title: BALANCE_ALERT_TITLE, category: 'flotte' },
        { title: BALANCE_ALERT_TITLE, category: 'chauf' },
      ],
    });

    const problemDays = sim.timeline.filter((t) => t.surplusDrivers !== 0);
    if (!problemDays.length) {
      if (existing) {
        await this.alerts.delete(existing.id);
        this.logger.log('Alerte equilibre flotte levee (horizon 14 j equilibre).');
      }
      return { raised: false, surplus: 0 };
    }

    const sureff = problemDays.filter((t) => t.surplusDrivers > 0);
    const souseff = problemDays.filter((t) => t.surplusDrivers < 0);
    const worst = Math.max(sim.summary.maxSurplus, sim.summary.maxDeficit);
    const priority = worst >= 2 ? 'CRITIQUE' : 'HAUTE';

    // Candidats au repos (jours de sur-effectif) : fatigue la plus élevée d'abord.
    const restCandidates = [...drivers]
      .filter((d) => (d.status ?? '').toUpperCase() === 'DISPONIBLE')
      .sort((a, b) => (b.fatigue ?? 0) - (a.fatigue ?? 0) || (b.hoursWeek ?? 0) - (a.hoursWeek ?? 0))
      .slice(0, Math.max(1, sim.summary.maxSurplus))
      .map((c) => `${c.name ?? c.code} (fatigue ${Math.round((c.fatigue ?? 0) * 100)}%)`)
      .join(' · ');

    const parts: string[] = [`Simulation sur ${sim.horizonDays} jours · ${sim.driversAvailable} chauffeur(s) disponible(s).`];
    if (sureff.length) {
      parts.push(
        `Sur-effectif chauffeurs à partir du ${sureff[0].date} (jusqu'à ${sim.summary.maxSurplus} chauffeur(s) sans véhicule). ` +
        `Planifier repos / récupération : ${restCandidates}.`,
      );
    }
    if (souseff.length) {
      parts.push(
        `Sous-effectif à partir du ${souseff[0].date} : jusqu'à ${sim.summary.maxDeficit} véhicule(s) à l'arrêt faute de chauffeur (renfort intérim / heures sup.).`,
      );
    }
    const outageList = sim.outages.slice(0, 6).map((o) => `${o.vehicleCode} indispo ${o.from}→${o.to} (${o.reason})`).join(' · ');
    if (outageList) parts.push(`Immobilisations prises en compte : ${outageList}.`);
    const description = parts.join(' ');

    if (existing) {
      existing.description = description;
      existing.priority = priority;
      existing.type = 'dg';
      existing.timeLabel = 'auto';
      existing.category = 'flotte';
      existing.title = BALANCE_ALERT_TITLE;
      await this.alerts.save(existing);
    } else {
      await this.alerts.save(
        this.alerts.create({
          type: 'dg', title: BALANCE_ALERT_TITLE, description,
          timeLabel: 'auto', category: 'flotte', priority,
        }),
      );
      this.logger.log(`Alerte equilibre flotte levee (sur ${sim.summary.maxSurplus} / sous ${sim.summary.maxDeficit}).`);
    }
    return { raised: true, surplus: sim.summary.maxSurplus - sim.summary.maxDeficit };
  }

  /**
   * Alertes d'expiration des équipements de sécurité (retour DG : extincteurs, trousses…
   * « on va avoir pas mal de procès à cause des expirations »).
   * Lève / met à jour une alerte par équipement expiré ou expirant sous 60 jours ;
   * retire les alertes des équipements redevenus valides ou supprimés.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshEquipmentExpiryAlerts(): Promise<{ created: number; cleared: number }> {
    const vehicles = await this.vehicles.find();
    const now = Date.now();
    const existing = await this.alerts.find({ where: { category: 'equipement' } });
    const seen = new Set<string>();
    let created = 0;
    for (const v of vehicles) {
      const eqs = Array.isArray(v.equipment) ? (v.equipment as { nom?: string; expiry?: string | null }[]) : [];
      for (const eq of eqs) {
        if (!eq?.expiry) continue;
        const days = Math.round((new Date(eq.expiry).getTime() - now) / dayMs);
        if (Number.isNaN(days) || days > 60) continue;
        const title = `Équipement ${days < 0 ? 'expiré' : 'à renouveler'} — ${eq.nom ?? 'équipement'} (${v.code})`;
        seen.add(title);
        const desc = days < 0
          ? `${eq.nom} du ${v.code} ${v.brand ?? ''} : validité dépassée depuis ${-days} j (échéance ${eq.expiry}). À remplacer.`
          : `${eq.nom} du ${v.code} ${v.brand ?? ''} : validité dans ${days} j (échéance ${eq.expiry}).`;
        const priority = days < 0 ? 'CRITIQUE' : days <= 30 ? 'HAUTE' : 'MOYENNE';
        const hit = existing.find((a) => a.title === title);
        if (hit) {
          hit.description = desc; hit.priority = priority;
          await this.alerts.save(hit);
        } else {
          await this.alerts.save(this.alerts.create({
            type: days < 0 ? 'dg' : 'wr', title, description: desc,
            timeLabel: 'auto', category: 'equipement', priority,
          }));
          created++;
        }
      }
    }
    const stale = existing.filter((a) => !seen.has(a.title ?? ''));
    for (const a of stale) await this.alerts.delete(a.id);
    return { created, cleared: stale.length };
  }

  /**
   * Alertes d'échéance des DOCUMENTS obligatoires (retour DG : « les alertes à l'approche
   * existaient avant ») : contrôle technique, assurance véhicule, permis de conduire.
   * Lève / met à jour une alerte par document expiré ou expirant sous 60 jours ;
   * retire les alertes des documents redevenus valides, renouvelés ou supprimés.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshDocumentExpiryAlerts(): Promise<{ created: number; cleared: number }> {
    const [vehicles, drivers] = await Promise.all([this.vehicles.find(), this.drivers.find()]);
    const now = Date.now();
    const WINDOW = 60;
    const existing = await this.alerts.find({
      where: [{ category: 'doc' }, { category: 'ass' }, { category: 'chauf' }],
    });
    const seen = new Set<string>();
    let created = 0;

    const upsert = async (title: string, description: string, days: number, category: string) => {
      seen.add(title);
      const priority = days < 0 ? 'CRITIQUE' : days <= 15 ? 'HAUTE' : days <= 30 ? 'MOYENNE' : 'BASSE';
      const type = days < 0 ? 'dg' : 'wr';
      const hit = existing.find((a) => a.title === title);
      if (hit) {
        hit.description = description; hit.priority = priority; hit.type = type; hit.timeLabel = 'auto';
        await this.alerts.save(hit);
      } else {
        await this.alerts.save(this.alerts.create({ type, title, description, timeLabel: 'auto', category, priority }));
        created++;
      }
    };
    const daysUntil = (d: string | null | undefined): number | null => {
      if (!d) return null;
      const n = Math.round((new Date(d).getTime() - now) / dayMs);
      return Number.isNaN(n) ? null : n;
    };

    for (const v of vehicles) {
      const label = `${v.code} ${v.brand ?? ''} ${v.model ?? ''}`.trim();
      // Contrôle technique
      if ((v.ctStatus ?? '').toUpperCase() !== 'N/A') {
        const days = daysUntil(v.ctExpiry);
        if (days != null && days <= WINDOW) {
          await upsert(
            `Contrôle technique ${days < 0 ? 'expiré' : 'à renouveler'} — ${v.code}`,
            days < 0
              ? `Le contrôle technique de ${label} est expiré depuis ${-days} j (échéance ${v.ctExpiry}). Le véhicule doit être immobilisé jusqu'à la visite.`
              : `Contrôle technique de ${label} à renouveler dans ${days} j (échéance ${v.ctExpiry}).`,
            days, 'doc',
          );
        }
      }
      // Assurance
      if ((v.insStatus ?? '').toUpperCase() !== 'N/A') {
        const days = daysUntil(v.insDate);
        if (days != null && days <= WINDOW) {
          await upsert(
            `Assurance ${days < 0 ? 'expirée' : 'à renouveler'} — ${v.code}`,
            days < 0
              ? `L'assurance de ${label} est expirée depuis ${-days} j (fin ${v.insDate}, police ${v.insPolicy ?? '—'}). Véhicule NON couvert — ne pas faire circuler.`
              : `Assurance de ${label} à renouveler dans ${days} j (fin ${v.insDate}).`,
            days, 'ass',
          );
        }
      }
    }

    for (const d of drivers) {
      const days = daysUntil(d.licenseExpiry);
      if (days == null || days > WINDOW) continue;
      const who = d.name ?? d.code;
      await upsert(
        `Permis ${days < 0 ? 'expiré' : 'à renouveler'} — ${who}`,
        days < 0
          ? `Le permis de ${who} (catégorie ${d.license ?? '—'}) est expiré depuis ${-days} j (échéance ${d.licenseExpiry}). Cette personne ne doit plus conduire.`
          : `Permis de ${who} (catégorie ${d.license ?? '—'}) à renouveler dans ${days} j (échéance ${d.licenseExpiry}).`,
        days, 'chauf',
      );
    }

    // Ne nettoie QUE les alertes générées par cette méthode (titres préfixés), pas les autres.
    const mine = /^(Contrôle technique|Assurance|Permis) (expiré|expirée|à renouveler) — /;
    const stale = existing.filter((a) => mine.test(a.title ?? '') && !seen.has(a.title ?? ''));
    for (const a of stale) await this.alerts.delete(a.id);
    if (created) this.logger.log(`${created} alerte(s) d'échéance documents / permis créée(s)`);
    return { created, cleared: stale.length };
  }

  /** Recalcule toutes les alertes automatiques. */
  async refreshAll() {
    const [m, b, e, doc] = await Promise.all([
      this.refreshMaintenanceAlerts(),
      this.refreshDriverBalanceAlert(),
      this.refreshEquipmentExpiryAlerts(),
      this.refreshDocumentExpiryAlerts(),
    ]);
    return { maintenance: m, driverBalance: b, equipment: e, documents: doc };
  }

  async onModuleInit() {
    // premier passage au demarrage (ne bloque pas le boot)
    setTimeout(() => this.refreshAll().catch(() => undefined), 3000);
  }
}
