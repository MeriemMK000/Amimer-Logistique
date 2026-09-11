import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MonthlyKmReading } from './monthly-km-reading.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { FuelEntry } from '../fuel-entries/fuel-entries.entity';
import { EngineFuelEntry } from '../engine-fuel-entries/engine-fuel-entries.entity';
import { FuelStockService } from '../fuel-stock/fuel-stock.service';
import { FuelCardMovement } from '../fuel-card-movements/fuel-card-movements.entity';
import { FuelStockOp } from '../fuel-stock/fuel-stock.entity';
import { Mission } from '../missions/missions.entity';
import { SitePointage } from '../site-pointage/site-pointage.entity';
import { VehicleAssignment } from '../vehicle-assignments/vehicle-assignments.entity';
import { Alert } from '../alerts/alerts.entity';
import { KmReading } from '../km-readings/km-readings.entity';
import { AppConfigService } from '../app-config/app-config.service';
import { canonFuel, fuelPrice, FuelType, FUEL_TYPES } from '../common/fuel-types';

/** Catégorie de contrôle (retour DG) → méthode de mesure du « fait ». */
export type FuelCategory = 'mission' | 'permanent' | 'engin_site' | 'vl_site';

export interface VehicleFuelControl {
  vehicleCode: string;
  label: string;
  type: string | null;
  fuelType: FuelType;
  category: FuelCategory;
  method: 'km_mensuel' | 'heures_engin';
  controlMethod: 'mission' | 'km_difference' | 'hours';
  usage: string;
  reading: { kmStart: number | null; kmEnd: number | null; hoursStart: number | null; hoursEnd: number | null; tankStart: number | null; tankEnd: number | null; openingConfirmedAt?: string | null; closingConfirmedAt?: string | null } | null;
  openingDone?: boolean;
  closingDone?: boolean;
  closingExpected?: boolean;   // le mois est-il terminé (relevé de clôture dû) ?
  readingComplete?: boolean;   // relevé début + fin OK pour ce mois
  readingStatus: string | null;
  requestedAt: string | null;
  respondedAt: string | null;
  declaredBy: string | null;
  driverCode: string | null;
  isCommercial: boolean;

  // ── ce qui a été acheté / fourni ──
  litresAchetes: number;               // Σ pleins de la période (tous canaux, carte comprise)
  litresBySource: Record<string, number>;
  montant: number;

  // ── correction réservoir (retour DG) ──
  tankStart: number | null;
  tankEnd: number | null;
  deltaTank: number;                   // réservoir fin − réservoir début
  tankDeclared: boolean;
  litresNets: number;                  // litresAchetes − deltaTank  ← la vraie conso

  // ── ce qui a réellement été fait ──
  kmMissions: number;
  kmOdometer: number | null;           // relevé compteur fin − début
  kmSitePointage: number | null;       // différentiel compteur relevé sur le pointage site (vie sur chantier)
  kmFait: number | null;               // compteur si dispo, sinon km missions
  kmNonJustifie: number | null;        // km compteur non couverts par des missions (usage à surveiller)
  hoursFait: number | null;            // engins

  // ── comparaison à la norme constructeur ──
  norme: number | null;                // L/100 km ou L/h
  litresTheoriques: number | null;     // kmFait × norme / 100  (ce qui aurait dû être consommé)
  kmTheorique: number | null;          // litresNets / norme × 100 (ce que le carburant « paie »)
  ecartLitres: number | null;          // litresNets − litresTheoriques  (+ = trop de carburant)
  ecartPct: number | null;
  consoReelle: number | null;

  verdict: 'conforme' | 'surveiller' | 'anomalie' | 'incomplet';
  flags: string[];                     // ex : 'reservoir_non_declare', 'km_incoherent', 'carburant_sans_km'

  // rétro-compat (bilan) :
  kmMonth: number | null;
  hoursMonth: number | null;
  litresFournis: number;
  litresCartes: number;
  litresStock: number;
  seuil: number | null;
  kmMissing: boolean;
  reconEcart: number;
}

@Injectable()
export class FuelControlService implements OnModuleInit {
  private readonly logger = new Logger(FuelControlService.name);

  constructor(
    @InjectRepository(MonthlyKmReading) private readonly readings: Repository<MonthlyKmReading>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(FuelEntry) private readonly fuel: Repository<FuelEntry>,
    @InjectRepository(EngineFuelEntry) private readonly engineFuel: Repository<EngineFuelEntry>,
    @InjectRepository(FuelCardMovement) private readonly cardMoves: Repository<FuelCardMovement>,
    @InjectRepository(FuelStockOp) private readonly stock: Repository<FuelStockOp>,
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    @InjectRepository(SitePointage) private readonly sitePointage: Repository<SitePointage>,
    @InjectRepository(VehicleAssignment) private readonly assignments: Repository<VehicleAssignment>,
    @InjectRepository(Alert) private readonly alerts: Repository<Alert>,
    @InjectRepository(KmReading) private readonly kmReadings: Repository<KmReading>,
    private readonly fuelStock: FuelStockService,
    private readonly config: AppConfigService,
  ) {}

  onModuleInit() {
    setTimeout(() => this.refreshMissingKmAlert().catch((e) => this.logger.warn(String(e))), 5000);
  }

  findReadings(month?: string): Promise<MonthlyKmReading[]> {
    return this.readings.find({ where: month ? { month } : {}, order: { month: 'DESC' } });
  }

  /** Un relevé de DÉBUT est complet quand km/heures ET réservoir de départ sont renseignés (retour DG). */
  private static openingComplete(r: MonthlyKmReading | null | undefined): boolean {
    return !!r && (r.kmStart != null || r.hoursStart != null) && r.tankStart != null;
  }
  /** Un relevé de FIN est complet quand km/heures ET réservoir de fin sont renseignés. */
  private static closingComplete(r: MonthlyKmReading | null | undefined): boolean {
    return !!r && (r.kmEnd != null || r.hoursEnd != null) && r.tankEnd != null;
  }

  /** Upsert du relevé km / heures / RÉSERVOIR d'un véhicule pour un mois. */
  async upsertReading(data: Partial<MonthlyKmReading>): Promise<MonthlyKmReading> {
    if (!data.vehicleCode || !data.month) throw new NotFoundException('vehicleCode et month requis');
    const today = new Date().toISOString().slice(0, 10);
    const firstOfMonth = `${data.month}-01`;
    const existing = await this.readings.findOne({ where: { vehicleCode: data.vehicleCode, month: data.month } });
    const row = existing ?? this.readings.create({ status: 'done', vehicleCode: data.vehicleCode, month: data.month });
    Object.assign(row, data);
    // Les deux demandes sont réputées émises le 1er du mois (retour DG : on n'attend pas la fin du mois).
    if (!row.openingRequestedAt) row.openingRequestedAt = firstOfMonth;
    if (!row.closingRequestedAt) row.closingRequestedAt = firstOfMonth;
    // Confirmation OUVERTURE : km/heures ET réservoir de DÉBUT renseignés.
    if (FuelControlService.openingComplete(row) && !row.openingConfirmedAt) row.openingConfirmedAt = today;
    // Confirmation CLÔTURE : km/heures ET réservoir de FIN renseignés.
    if (FuelControlService.closingComplete(row)) {
      if (!row.closingConfirmedAt) row.closingConfirmedAt = today;
      if (row.status === 'pending') { row.status = 'done'; row.respondedAt = row.respondedAt ?? today; }
    }
    const saved = await this.readings.save(row);
    // Retour DG : le relevé de CLÔTURE alimente le compteur véhicule → sert à la maintenance
    // et à la programmation des entretiens périodiques.
    await this.syncOdometerFromReading(saved);
    return saved;
  }

  /**
   * Retour DG : « Les relevés km seront ensuite utilisés en maintenance et programmation des
   * entretiens périodiques. » — un relevé de CLÔTURE (km ou heures de fin de mois) devient
   * un prélèvement compteur (`km_readings` source `releve_mensuel`, 1 par véhicule × mois,
   * mis à jour si le relevé est corrigé) et met à jour `vehicle.km` / `vehicle.hourMeter`.
   * Le moteur km (`KmReadingService.compute`) et les échéances préventives repartent de là.
   */
  private async syncOdometerFromReading(r: MonthlyKmReading): Promise<void> {
    if (!r.vehicleCode || !r.month) return;
    const v = await this.vehicles.findOne({ where: { code: r.vehicleCode as never } });
    if (!v) return;
    // date du prélèvement = dernier jour du mois du relevé (ou aujourd'hui si le mois est en cours).
    const [y, m] = r.month.split('-').map(Number);
    const lastOfMonth = new Date(y, m, 0).toISOString().slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    const readingDate = lastOfMonth > today ? today : lastOfMonth;

    if (r.kmEnd != null && Number.isFinite(r.kmEnd)) {
      const tag = `mois ${r.month}`;
      const prev = (await this.kmReadings.find({ where: { vehicleCode: r.vehicleCode, source: 'releve_mensuel' } }))
        .find((k) => (k.note ?? '').includes(tag));
      if (prev) {
        prev.km = Math.round(r.kmEnd); prev.date = readingDate;
        await this.kmReadings.save(prev);
      } else {
        await this.kmReadings.save(this.kmReadings.create({
          vehicleCode: r.vehicleCode, date: readingDate, km: Math.round(r.kmEnd),
          source: 'releve_mensuel', note: `Relevé de clôture — ${tag} (contrôle carburant)`,
        }));
      }
      if ((v.km ?? 0) < Math.round(r.kmEnd)) { v.km = Math.round(r.kmEnd); await this.vehicles.save(v); }
    }
    if (r.hoursEnd != null && Number.isFinite(r.hoursEnd) && (v.hourMeter ?? 0) < Math.round(r.hoursEnd)) {
      v.hourMeter = Math.round(r.hoursEnd);
      await this.vehicles.save(v);
    }
  }

  /** Demandes de relevé km à saisir (chauffeur) — pour les véhicules détenus. */
  async pendingRequestsForVehicles(vehicleCodes: string[]): Promise<MonthlyKmReading[]> {
    if (!vehicleCodes.length) return [];
    const rows = await this.readings.find({ where: { status: 'pending' } });
    return rows.filter((r) => r.vehicleCode && vehicleCodes.includes(r.vehicleCode)).sort((a, b) => (a.month ?? '').localeCompare(b.month ?? ''));
  }

  /** Déclaration km par le chauffeur (app mobile). */
  async declareKm(vehicleCode: string, month: string, kmEnd: number, opts?: { hoursEnd?: number; photoId?: string; by?: string }): Promise<MonthlyKmReading> {
    const row = await this.readings.findOne({ where: { vehicleCode, month } });
    const patch: Partial<MonthlyKmReading> = {
      vehicleCode, month, kmEnd: opts?.hoursEnd != null ? row?.kmEnd ?? null : Math.round(kmEnd),
      hoursEnd: opts?.hoursEnd != null ? Math.round(opts.hoursEnd) : row?.hoursEnd ?? null,
      photoId: opts?.photoId ?? row?.photoId ?? null,
      status: 'done', respondedAt: new Date().toISOString().slice(0, 10),
      declaredBy: opts?.by ?? 'chauffeur',
    };
    const saved = row ? await this.readings.save(Object.assign(row, patch)) : await this.readings.save(this.readings.create(patch));
    await this.syncOdometerFromReading(saved);
    return saved;
  }

  /**
   * Retour DG : « petit menu de vérification » — pour un mois donné, l'état des DEUX demandes
   * distinctes (DÉBUT / FIN) de chaque véhicule : qui a donné km + réservoir de début, qui a
   * donné km + réservoir de fin. Séparé de l'analyse de consommation.
   */
  async releveSuivi(month: string) {
    const [vehicles, assignments, readings] = await Promise.all([
      this.vehicles.find(),
      this.assignments.find(),
      this.readings.find({ where: { month } }),
    ]);
    const nowMonth = new Date().toISOString().slice(0, 7);
    const t = new Date();
    const day = month === nowMonth ? t.getDate() : 32;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const dueDate = `${month}-${String(lastDay).padStart(2, '0')}`;
    const monthOver = month < nowMonth || (month === nowMonth && t.getDate() >= lastDay);
    const openingOverdueAfter = 5; // jours

    const items = vehicles
      .filter((v) => (v.type ?? '').toUpperCase() !== 'REMORQUE' && (v.status ?? '').toUpperCase() !== 'HORS_SERVICE')
      .map((v) => {
        const isEngin = (v.type ?? '').toUpperCase() === 'ENGIN';
        const r = readings.find((x) => x.vehicleCode === v.code) ?? null;
        const assign = assignments.find((a) => a.vehicleCode === v.code
          && (!a.dateEnd || a.dateEnd >= `${month}-01`) && (!a.dateStart || a.dateStart <= `${month}-31`));
        const controlMethod: 'mission' | 'km_difference' | 'hours' =
          (['mission', 'km_difference', 'hours'].includes(assign?.controlType ?? '') ? assign!.controlType : null) as 'mission' | 'km_difference' | 'hours' | null
          ?? (isEngin ? 'hours' : assign?.assigneeName || assign?.siteCode ? 'km_difference' : 'mission');
        const openingDone = FuelControlService.openingComplete(r);
        const closingDone = FuelControlService.closingComplete(r);
        return {
          vehicleCode: v.code, label: `${v.brand ?? ''} ${v.model ?? ''}`.trim(), type: v.type,
          isEngin, unit: isEngin ? 'h' : 'km', controlMethod,
          driverCode: v.driverCode ?? assign?.driverCode ?? null,
          usage: assign?.assigneeName ? `voiture de service — ${assign.assigneeName}`
            : assign?.siteCode ? `site ${assign.siteCode}` : isEngin ? 'engin' : 'mission',
          debut: {
            valeur: isEngin ? r?.hoursStart ?? null : r?.kmStart ?? null,
            reservoir: r?.tankStart ?? null,
            fait: openingDone,
            demandeLe: r?.openingRequestedAt ?? `${month}-01`,
            faitLe: r?.openingConfirmedAt ?? null,
            enRetard: !openingDone && day > openingOverdueAfter,
            statut: openingDone ? 'fait' : day > openingOverdueAfter ? 'en_retard' : 'a_faire',
          },
          fin: {
            valeur: isEngin ? r?.hoursEnd ?? null : r?.kmEnd ?? null,
            reservoir: r?.tankEnd ?? null,
            fait: closingDone,
            demandeLe: r?.closingRequestedAt ?? `${month}-01`,
            faitLe: r?.closingConfirmedAt ?? null,
            echeance: dueDate,
            enRetard: !closingDone && monthOver,
            statut: closingDone ? 'fait' : monthOver ? 'en_retard' : 'a_venir',
          },
        };
      });

    return {
      month, dueDate, monthOver,
      items,
      resume: {
        total: items.length,
        debutManquant: items.filter((i) => !i.debut.fait).length,
        finManquant: items.filter((i) => !i.fin.fait).length,
        complet: items.filter((i) => i.debut.fait && i.fin.fait).length,
      },
    };
  }

  private monthMatch(d: string | null | undefined, month: string): boolean {
    if (!d) return false;
    const s = String(d).trim();
    // ISO YYYY-MM(-DD) ou YYYY/MM
    let m = s.match(/^(\d{4})[-/](\d{1,2})/);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}` === month;
    // DD/MM/YYYY · DD-MM-YYYY · DD/MM · DD-MM (année courante si absente)
    m = s.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
    if (m) {
      const mo = m[2].padStart(2, '0');
      const yr = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : month.slice(0, 4);
      return `${yr}-${mo}` === month;
    }
    return false;
  }

  /**
   * Contrôle carburant mensuel — retour DG :
   *  - vraie conso = Σ pleins de la période − (réservoir fin − réservoir début)
   *  - véhicules missions : km FAIT = km des missions (le système les connaît) ; km THÉORIQUE =
   *    litres nets ÷ norme constructeur ; si km fait ≪ km théorique → trop de carburant = suspect
   *  - véhicules permanents / VL site : km FAIT = compteur fin − début
   *  - engins site : heures (pointage / relevé) × norme L/h
   */
  async monthReport(month: string): Promise<VehicleFuelControl[]> {
    const [vehicles, fuel, cardMoves, stockOps, missions, pointage, assignments, readings, prevReadings, prices, engineFuel] = await Promise.all([
      this.vehicles.find(),
      this.fuel.find(),
      this.cardMoves.find(),
      this.stock.find(),
      this.missions.find(),
      this.sitePointage.find(),
      this.assignments.find(),
      this.readings.find({ where: { month } }),
      this.readings.find({ where: { month: this.prevMonth(month) } }),
      this.config.get('FUEL_PRICES').then((p) => (p ?? {}) as Record<string, number>),
      this.engineFuel.find(),
    ]);
    const r2 = (n: number) => Math.round(n * 100) / 100;

    const out: VehicleFuelControl[] = [];
    for (const v of vehicles) {
      if ((v.type ?? '').toUpperCase() === 'REMORQUE') continue;
      const isEngin = (v.type ?? '').toUpperCase() === 'ENGIN';
      const reading = readings.find((r) => r.vehicleCode === v.code) ?? null;
      const prev = prevReadings.find((r) => r.vehicleCode === v.code) ?? null;

      const assign = assignments.find((a) => a.vehicleCode === v.code
        && (!a.dateEnd || a.dateEnd >= `${month}-01`) && (!a.dateStart || a.dateStart <= `${month}-31`));
      const category: FuelCategory = isEngin ? 'engin_site'
        : assign?.assigneeName ? 'permanent'
          : assign?.siteCode ? 'vl_site'
            : 'mission';
      // Méthode de contrôle (retour DG) : explicite sur l'affectation, sinon déduite.
      const controlMethod: 'mission' | 'km_difference' | 'hours' =
        (['mission', 'km_difference', 'hours'].includes(assign?.controlType ?? '') ? assign!.controlType : null) as 'mission' | 'km_difference' | 'hours' | null
        ?? (isEngin ? 'hours' : (category === 'permanent' || category === 'vl_site') ? 'km_difference' : 'mission');
      const useHours = controlMethod === 'hours';
      const usage = assign?.assigneeName ? `voiture de service — ${assign.assigneeName}`
        : assign?.siteCode ? `affecté site ${assign.siteCode}`
          : v.isCommercial ? 'commercial (type mission)' : 'mission';

      // ── litres achetés (registre unique : carte + régie + stock + pompe + manuel) ──
      const vFuel = fuel.filter((f) => f.vehicleCode === v.code && this.monthMatch(f.date, month));
      const litresBySource: Record<string, number> = {};
      let litresAchetes = 0;
      let montant = 0;
      const typeLiters: Partial<Record<FuelType, number>> = {};
      for (const f of vFuel) {
        const src = f.source ?? 'manuel';
        const ft = canonFuel(f.fuelType ?? v.fuel, f.grade);
        litresBySource[src] = r2((litresBySource[src] ?? 0) + (f.qty ?? 0));
        typeLiters[ft] = r2((typeLiters[ft] ?? 0) + (f.qty ?? 0));
        litresAchetes += f.qty ?? 0;
        montant += f.amount ?? (f.qty ?? 0) * (f.unitPrice ?? (fuelPrice(prices, ft) ?? 0));
      }
      // Engins : pleins saisis dans le registre dédié (engine_fuel_entries).
      if (isEngin) {
        for (const e of engineFuel.filter((x) => x.vehicleCode === v.code && this.monthMatch(x.date, month))) {
          const ft = canonFuel(e.fuelType ?? v.fuel);
          litresBySource['engin_dedie'] = r2((litresBySource['engin_dedie'] ?? 0) + (e.qty ?? 0));
          typeLiters[ft] = r2((typeLiters[ft] ?? 0) + (e.qty ?? 0));
          litresAchetes += e.qty ?? 0;
          montant += (e.qty ?? 0) * (e.unitPrice ?? (fuelPrice(prices, ft) ?? 0));
        }
      }
      litresAchetes = r2(litresAchetes);
      const fuelType = (Object.entries(typeLiters).sort((a, b) => b[1] - a[1])[0]?.[0] as FuelType) ?? canonFuel(v.fuel);
      const litresCartes = r2(litresBySource['carte'] ?? 0);
      const litresStock = r2(litresBySource['stock_site'] ?? 0);

      // ── correction réservoir ──
      const tankStart = reading?.tankStart ?? prev?.tankEnd ?? null;
      const tankEnd = reading?.tankEnd ?? null;
      const tankDeclared = tankStart != null && tankEnd != null;
      const deltaTank = tankDeclared ? r2(tankEnd! - tankStart!) : 0;
      const litresNets = r2(litresAchetes - deltaTank);

      // ── km / heures FAIT ──
      const kmMissions = Math.round(missions
        .filter((m) => m.vehicleCode === v.code && ['EN_COURS', 'TERMINEE', 'CLOTUREE'].includes(m.status ?? '')
          && (this.monthMatch(m.dateEnd, month) || this.monthMatch(m.dateStart, month)))
        .reduce((s, m) => s + (m.distance ?? 0), 0));

      // Pointage site du mois (retour DG : engins/véhicules affectés à un site n'ont pas de
      // missions → on récupère leurs relevés compteur / heures depuis le pointage journalier).
      const vPointage = pointage.filter((p) => p.targetCode === v.code && this.monthMatch(p.date, month));
      const ptNums = (get: (p: SitePointage) => number | null | undefined) => vPointage.map(get).filter((x): x is number => x != null);
      const ptKmStart = ptNums((p) => p.kmStart);
      const ptKmEnd = ptNums((p) => p.kmEnd);
      const ptHoursStart = ptNums((p) => p.hoursStart);
      const ptHoursEnd = ptNums((p) => p.hoursEnd);
      const ptKmOdo = ptKmStart.length && ptKmEnd.length ? Math.max(0, Math.max(...ptKmEnd) - Math.min(...ptKmStart)) : null;
      const ptHoursMeter = ptHoursStart.length && ptHoursEnd.length ? Math.max(0, Math.max(...ptHoursEnd) - Math.min(...ptHoursStart)) : null;
      const ptDaysHours = vPointage.reduce((s, p) => s + (p.immobilized ? 0 : (p.fraction ?? p.quantity ?? 0) * 8), 0);

      const kmOdometer = reading?.kmStart != null && reading?.kmEnd != null
        ? Math.max(0, reading.kmEnd - reading.kmStart)
        : ptKmOdo;

      let hoursFait: number | null = null;
      if (useHours) {
        if (reading?.hoursStart != null && reading?.hoursEnd != null) hoursFait = r2(Math.max(0, reading.hoursEnd - reading.hoursStart));
        else if (ptHoursMeter != null && ptHoursMeter > 0) hoursFait = r2(ptHoursMeter);
        else hoursFait = ptDaysHours > 0 ? r2(ptDaysHours) : null;
      }
      // km FAIT selon la méthode de contrôle (retour DG) :
      //  · mission        → km RÉELS (compteur si dispo, sinon km des missions connues du système)
      //  · km_difference  → km début → km fin de mois UNIQUEMENT (relevé obligatoire)
      const kmFait: number | null = useHours ? null
        : controlMethod === 'km_difference' ? kmOdometer
          : (kmOdometer ?? (kmMissions > 0 ? kmMissions : null));

      // ── norme constructeur & comparaison ──
      const norme = useHours ? (v.normCorrH ?? v.normOffH ?? null) : (v.normCorr ?? v.normOff ?? null);
      const seuil = norme != null ? r2(norme * 1.15) : null;
      const base = useHours ? hoursFait : kmFait;
      const perUnit = useHours ? 1 : 100; // L/h vs L/100km

      let litresTheoriques: number | null = null;
      let kmTheorique: number | null = null;
      let ecartLitres: number | null = null;
      let ecartPct: number | null = null;
      let consoReelle: number | null = null;
      if (norme != null && base != null && base > 0) {
        litresTheoriques = r2((base * norme) / perUnit);
        kmTheorique = r2((litresNets / norme) * perUnit);
        ecartLitres = r2(litresNets - litresTheoriques);
        ecartPct = Math.round((ecartLitres / Math.max(1, litresTheoriques)) * 100);
        consoReelle = r2((litresNets / base) * perUnit);
      }

      // ── km roulés vs km justifiés par des missions (uniquement pour la méthode 'mission') ──
      const kmNonJustifie = controlMethod === 'mission' && kmOdometer != null
        ? Math.max(0, kmOdometer - kmMissions) : null;
      // Le compteur dépasse LARGEMENT les missions enregistrées.
      const kmExcessif = kmNonJustifie != null && kmNonJustifie > 300
        && kmOdometer! > Math.max(200, kmMissions) * 1.5;
      // Deux natures d'anomalie DISTINCTES (retour DG) :
      //  · km ↔ carburant incohérents : le carburant ne « paie » pas les km (compteur gonflé OU pleins manquants)
      //  · activité non justifiée : les km sont cohérents avec le carburant, mais roulés hors mission
      const kmVsCarburant = kmExcessif && ecartPct != null && ecartPct < -12;
      const activiteNonJustifiee = kmExcessif && !kmVsCarburant;

      // ── relevés OUVERTURE / CLÔTURE (retour DG : OBLIGATOIRES pour TOUS les véhicules,
      //    2 fois par mois — début & fin — quel que soit le type de contrôle et même sans
      //    activité carburant : sert à la conso, à déceler les km hors mission ET à la maintenance) ──
      // Retour DG : « fait » = km/heures ET réservoir renseignés (les 2 valeurs). Un km auto-prérempli
      // seul (sans réservoir) ne compte pas → il faut confirmer.
      const openingDone = FuelControlService.openingComplete(reading);
      const closingDone = FuelControlService.closingComplete(reading);
      const hasActivity = litresAchetes > 0 || kmMissions > 0 || vPointage.length > 0;
      // Le relevé de CLÔTURE n'est attendu qu'une fois le mois terminé (ou le dernier jour).
      const nowMonth = new Date().toISOString().slice(0, 7);
      const today = new Date();
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
      const closingExpected = month < nowMonth || (month === nowMonth && today.getDate() >= lastDayOfMonth);
      const readingComplete = openingDone && (!closingExpected || closingDone);
      const noActivityAtAll = litresAchetes === 0 && (kmFait ?? 0) === 0 && (hoursFait ?? 0) === 0 && kmMissions === 0;

      // ── flags & verdict ──
      const flags: string[] = [];
      const kmMissing = !useHours && litresAchetes > 0 && kmFait == null;
      const hoursMissing = useHours && litresAchetes > 0 && hoursFait == null;
      if (!openingDone) flags.push('releve_ouverture_manquant');
      if (closingExpected && !closingDone) flags.push('releve_cloture_manquant');
      if (litresAchetes > 0 && !tankDeclared) flags.push('reservoir_non_declare');
      if (ecartPct != null && ecartPct > 15) flags.push('surconsommation');
      if (kmVsCarburant) flags.push('km_carburant_incoherent');
      if (activiteNonJustifiee) flags.push('activite_non_justifiee');
      if (kmMissing) flags.push('km_manquant');
      if (hoursMissing) flags.push('heures_manquantes');
      // Carburant saisi 2× : dotation site (pointage) ET sortie de cuve OU plein engin dédié
      // pour le même véhicule sur le mois → risque de double comptage.
      const dot = litresBySource['dotation_site'] ?? 0;
      if (dot > 0 && ((litresBySource['stock_site'] ?? 0) > 0 || (litresBySource['engin_dedie'] ?? 0) > 0)) {
        flags.push('carburant_double_source');
      }

      // Écart POSITIF (> théorique) = sur-conso : vol / fuite / conduite / plein sur autre véhicule.
      // Écart NÉGATIF marqué (< théorique) = compteur gonflé OU pleins non déclarés.
      // Retour DG : les km roulés hors missions validées sont une DONNÉE IMPORTANTE à surveiller,
      // pas une anomalie en soi. Seule l'incohérence km ↔ carburant est une anomalie.
      let verdict: VehicleFuelControl['verdict'];
      if (!readingComplete) verdict = 'incomplet';                    // relevé début / fin manquant → priorité DG
      else if (kmMissing || hoursMissing) verdict = 'incomplet';
      else if (noActivityAtAll) verdict = 'conforme';                 // relevés faits, aucune conso à analyser ce mois
      else if (ecartPct == null) verdict = 'incomplet';
      else if (ecartPct > 15) verdict = 'anomalie';
      else if (kmVsCarburant) verdict = 'anomalie';
      else if (ecartPct > 5 || ecartPct < -15 || kmExcessif) verdict = 'surveiller';
      else verdict = 'conforme';

      // Retour DG : on suit TOUS les véhicules chaque mois (relevés obligatoires) — on n'exclut
      // que les remorques (déjà filtrées) et les véhicules hors service / cédés.
      if ((v.status ?? '').toUpperCase() === 'HORS_SERVICE' && !reading && !hasActivity) continue;

      out.push({
        vehicleCode: v.code, label: `${v.brand ?? ''} ${v.model ?? ''}`.trim(), type: v.type,
        fuelType, category, method: useHours ? 'heures_engin' : 'km_mensuel', controlMethod, usage,
        reading: reading ? { kmStart: reading.kmStart, kmEnd: reading.kmEnd, hoursStart: reading.hoursStart, hoursEnd: reading.hoursEnd, tankStart: reading.tankStart, tankEnd: reading.tankEnd, openingConfirmedAt: reading.openingConfirmedAt, closingConfirmedAt: reading.closingConfirmedAt } : null,
        readingStatus: reading?.status ?? null, requestedAt: reading?.requestedAt ?? null,
        respondedAt: reading?.respondedAt ?? null, declaredBy: reading?.declaredBy ?? null,
        driverCode: v.driverCode ?? null, isCommercial: !!v.isCommercial,
        openingDone, closingDone, closingExpected, readingComplete,
        litresAchetes, litresBySource, montant: Math.round(montant),
        tankStart, tankEnd, deltaTank, tankDeclared, litresNets,
        kmMissions, kmOdometer, kmSitePointage: ptKmOdo, kmFait, hoursFait, kmNonJustifie,
        norme, litresTheoriques, kmTheorique, ecartLitres, ecartPct, consoReelle,
        verdict, flags,
        // rétro-compat
        kmMonth: kmFait, hoursMonth: hoursFait,
        litresFournis: litresAchetes, litresCartes, litresStock, seuil,
        kmMissing: kmMissing || hoursMissing,
        reconEcart: r2(litresAchetes - litresCartes - litresStock),
      });
    }
    const rank = (v: string) => ({ anomalie: 0, incomplet: 1, surveiller: 2, conforme: 3 }[v] ?? 4);
    return out.sort((a, b) => rank(a.verdict) - rank(b.verdict) || b.litresNets - a.litresNets);
  }

  private prevMonth(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return new Date(y, m - 2, 1).toISOString().slice(0, 7);
  }

  /**
   * Retour DG « pour les sites » — consommation CUMULÉE des véhicules / engins d'un chantier :
   *  · véhicule léger : on cumule le gasoil de l'aller (mission « aller chercher »), du retour
   *    et de la vie sur site, et on rapporte aux km cumulés (km missions + différentiel compteur
   *    du pointage site) → L/100 km « km de km », comparé à la norme constructeur.
   *  · engin : heures de fonctionnement (pointage) × norme L/h.
   * Sert à comparer aux normes puis à refacturer par centre de coût + site.
   */
  async siteFuelSummary(site: string, month: string) {
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const [report, assignments, pointage] = await Promise.all([
      this.monthReport(month),
      this.assignments.find(),
      this.sitePointage.find(),
    ]);
    const monthStart = `${month}-01`;
    const monthEnd = `${month}-31`;
    const assignedCodes = new Set(
      assignments
        .filter((a) => a.siteCode === site
          && (!a.dateEnd || a.dateEnd >= monthStart) && (!a.dateStart || a.dateStart <= monthEnd))
        .map((a) => a.vehicleCode)
        .filter((c): c is string => !!c),
    );
    // On inclut aussi les véhicules simplement pointés sur le site ce mois-ci (sans affectation formelle).
    for (const p of pointage) {
      if (p.siteCode === site && p.targetType !== 'external' && p.targetCode && this.monthMatch(p.date, month)) {
        assignedCodes.add(p.targetCode);
      }
    }

    const items = report
      .filter((r) => assignedCodes.has(r.vehicleCode))
      .map((r) => {
        const isEngin = r.method === 'heures_engin' || r.controlMethod === 'hours';
        const kmMissions = r.kmMissions ?? 0;
        const kmSite = r.kmSitePointage ?? 0;
        const kmCumule = isEngin ? null : r2(kmMissions + kmSite);
        const litresCumules = r.litresNets;
        const consoCumulee = isEngin
          ? (r.hoursFait && r.hoursFait > 0 ? r2(litresCumules / r.hoursFait) : null)
          : (kmCumule && kmCumule > 0 ? r2((litresCumules / kmCumule) * 100) : null);
        const norme = r.norme;
        const ecartPct = norme != null && consoCumulee != null
          ? Math.round(((consoCumulee - norme) / norme) * 100)
          : null;
        return {
          vehicleCode: r.vehicleCode, label: r.label, type: r.type,
          mode: isEngin ? 'heures' : 'km_de_km',
          controlMethod: r.controlMethod,
          litresBySource: r.litresBySource,
          litresCumules,
          kmMissions, kmSite, kmCumule,
          hoursFait: r.hoursFait,
          consoCumulee, norme, uniteNorme: isEngin ? 'L/h' : 'L/100km',
          ecartPct,
          verdict: r.verdict, flags: r.flags,
          readingComplete: r.readingComplete,
        };
      })
      .sort((a, b) => (b.litresCumules ?? 0) - (a.litresCumules ?? 0));

    return {
      site, month,
      items,
      totals: {
        litres: r2(items.reduce((s, i) => s + (i.litresCumules ?? 0), 0)),
        km: r2(items.reduce((s, i) => s + (i.kmCumule ?? 0), 0)),
        heures: r2(items.reduce((s, i) => s + (i.hoursFait ?? 0), 0)),
        nbAnomalie: items.filter((i) => i.verdict === 'anomalie').length,
        nbIncomplet: items.filter((i) => i.verdict === 'incomplet').length,
      },
    };
  }

  /**
   * BILAN CARBURANT d'une période — VENTILÉ PAR TYPE DE CARBURANT (retour DG) :
   * pour chaque type (Gasoil / Sans plomb / Super / GPL) :
   *   stock cuve début + approvisionnements + achats directs (carte / régie / pompe / manuel)
   *   = consommations ventilées (missions / permanents / engins / externes) + stock cuve fin + écart
   * en litres ET en dinars. Un manque de gasoil ne se compense pas avec un surplus d'essence.
   */
  async bilanCarburant(month: string, site?: string) {
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const [report, cuves, engineEntries, fuelAll, stockOps, vehicles] = await Promise.all([
      this.monthReport(month),
      this.fuelStock.balance(site, month),
      this.engineFuel.find(),
      this.fuel.find(),
      this.stock.find(),
      this.vehicles.find(),
    ]);

    type BilanCat = 'missions' | 'permanents' | 'vlSite' | 'engins' | 'externes';
    const BILAN_CATS: BilanCat[] = ['missions', 'permanents', 'vlSite', 'engins', 'externes'];
    const catByCode = new Map<string, BilanCat>();
    for (const r of report) {
      catByCode.set(r.vehicleCode, r.category === 'engin_site' ? 'engins'
        : r.category === 'permanent' ? 'permanents'
          : r.category === 'vl_site' ? 'vlSite'
            : 'missions');
    }
    const catOfCode = (code: string | null): BilanCat => {
      if (!code) return 'missions';
      if (catByCode.has(code)) return catByCode.get(code)!;
      const v = vehicles.find((x) => x.code === code);
      return (v?.type ?? '').toUpperCase() === 'ENGIN' ? 'engins' : 'missions';
    };
    // ── Cuves : par site × type (déjà ventilé) ──
    const cuveBlocks = cuves.map((c) => {
      const t = canonFuel(c.fuelType);
      const stockFinTheorique = r2(c.stockDebutLiters + c.periodApproLiters - c.periodSortieLiters);
      return {
        siteCode: c.siteCode, fuelType: t, avgUnitPrice: c.avgUnitPrice,
        stockDebut: c.stockDebutLiters, stockDebutValue: c.stockDebutValue,
        appros: c.periodApproLiters, approsValue: c.periodApproValue,
        sorties: c.periodSortieLiters, sortiesValue: c.periodSortieValue,
        stockFinTheorique, stockFinReel: c.stockLiters,
        ecart: r2(c.stockLiters - stockFinTheorique),
        whereItGoes: c.whereItGoes,
      };
    });

    type CatAgg = { liters: number; value: number; items: Array<{ code: string; label: string; usage: string; liters: number; value: number; km: number | null; hours: number | null; verdict: string | null; ecartPct: number | null }> };
    type TypeBalance = ReturnType<typeof emptyBalance>;
    const emptyBalance = (fuelType: FuelType) => ({
      fuelType,
      entrees: { stockDebutCuves: 0, approsCuves: 0, approsValue: 0, achatsCartes: 0, achatsCartesValue: 0, achatsRegie: 0, achatsRegieValue: 0, achatsPompe: 0, achatsPompeValue: 0, achatsManuel: 0, achatsManuelValue: 0, achatsDotationSite: 0, achatsDotationSiteValue: 0, achatsEnginsDedies: 0, achatsEnginsDediesValue: 0, total: 0, totalValue: 0 },
      sorties: {
        missions: { liters: 0, value: 0, km: null as number | null, hours: null as number | null, consoKm: null as number | null, consoH: null as number | null, items: [] as CatAgg['items'] },
        permanents: { liters: 0, value: 0, km: null as number | null, hours: null as number | null, consoKm: null as number | null, consoH: null as number | null, items: [] as CatAgg['items'] },
        vlSite: { liters: 0, value: 0, km: null as number | null, hours: null as number | null, consoKm: null as number | null, consoH: null as number | null, items: [] as CatAgg['items'] },
        engins: { liters: 0, value: 0, km: null as number | null, hours: null as number | null, consoKm: null as number | null, consoH: null as number | null, items: [] as CatAgg['items'] },
        externes: { liters: 0, value: 0, km: null as number | null, hours: null as number | null, consoKm: null as number | null, consoH: null as number | null, items: [] as CatAgg['items'] },
        stockFinCuves: 0,
        total: 0, totalValue: 0,
      },
      // ── carburant immobilisé dans les réservoirs des véhicules (retour DG) ──
      reservoirsDebut: 0, reservoirsFin: 0, deltaReservoirs: 0, reservoirsNbDeclares: 0,
      reserveDebutTotale: 0, reserveFinTotale: 0, consoNette: 0,
      ecart: 0, tolerance: 0, reconcilie: true,
      // contrôle consommation (vraie conso vs norme constructeur, sur la flotte de ce type) :
      controle: { litresNets: 0, litresTheoriques: 0, ecartConso: 0, ecartConsoPct: 0, nbAnomalie: 0, nbSurveiller: 0, nbIncomplet: 0, nbVehicules: 0 },
      cuveEcart: 0,
    });
    const T: Record<FuelType, TypeBalance> = {
      GASOIL: emptyBalance('GASOIL'), SP: emptyBalance('SP'), SUPER: emptyBalance('SUPER'), GPL: emptyBalance('GPL'),
    };
    const catAgg: Record<FuelType, ReturnType<typeof this.blankCatAgg>> = {
      GASOIL: this.blankCatAgg(), SP: this.blankCatAgg(), SUPER: this.blankCatAgg(), GPL: this.blankCatAgg(),
    };

    // ── Cuves → stock début / appros / stock fin par type ──
    for (const c of cuveBlocks) {
      const b = T[c.fuelType].entrees;
      b.stockDebutCuves = r2(b.stockDebutCuves + c.stockDebut);
      b.approsCuves = r2(b.approsCuves + c.appros);
      b.approsValue += c.approsValue;
      T[c.fuelType].sorties.stockFinCuves = r2(T[c.fuelType].sorties.stockFinCuves + c.stockFinReel);
      T[c.fuelType].cuveEcart = r2(T[c.fuelType].cuveEcart + c.ecart);
    }

    // ── Contrôle consommation par type (vraie conso vs norme constructeur) ──
    // On ne cumule litresNets / litresTheoriques QUE pour les véhicules avec une
    // comparaison valable (verdict != incomplet) : sinon l'ecart % serait fausse
    // par des litres sans theorique en face.
    for (const r of report) {
      const tb = T[r.fuelType];
      const ctl = tb.controle;
      ctl.nbVehicules++;
      if (r.verdict === 'anomalie') ctl.nbAnomalie++;
      else if (r.verdict === 'surveiller') ctl.nbSurveiller++;
      else if (r.verdict === 'incomplet') ctl.nbIncomplet++;
      if (r.verdict !== 'incomplet' && r.litresTheoriques != null) {
        ctl.litresNets = r2(ctl.litresNets + r.litresNets);
        ctl.litresTheoriques = r2(ctl.litresTheoriques + r.litresTheoriques);
      }
      // Carburant dans les réservoirs (véhicules ayant déclaré début ET fin).
      if (r.tankDeclared && r.tankStart != null && r.tankEnd != null) {
        tb.reservoirsDebut = r2(tb.reservoirsDebut + r.tankStart);
        tb.reservoirsFin = r2(tb.reservoirsFin + r.tankEnd);
        tb.reservoirsNbDeclares++;
      }
    }
    for (const ft of FUEL_TYPES) {
      const ctl = T[ft].controle;
      ctl.ecartConso = r2(ctl.litresNets - ctl.litresTheoriques);
      ctl.ecartConsoPct = ctl.litresTheoriques > 0 ? Math.round((ctl.ecartConso / ctl.litresTheoriques) * 100) : 0;
      T[ft].deltaReservoirs = r2(T[ft].reservoirsFin - T[ft].reservoirsDebut);
    }

    // ── Fuel entries (registre unique : carte / régie / pompe / manuel / stock_site) ──
    const monthFuel = fuelAll.filter((f) => this.monthMatch(f.date, month));
    for (const f of monthFuel) {
      const v = vehicles.find((x) => x.code === f.vehicleCode);
      const ft = canonFuel(f.fuelType ?? v?.fuel, f.grade);
      const L = f.qty ?? 0;
      const val = f.amount ?? L * (f.unitPrice ?? 0);
      const src = f.source ?? 'manuel';
      // Entrées : les achats directs (pas les sorties de cuve, qui étaient déjà des appros).
      const e = T[ft].entrees;
      if (src === 'carte') { e.achatsCartes = r2(e.achatsCartes + L); e.achatsCartesValue += val; }
      else if (src === 'regie') { e.achatsRegie = r2(e.achatsRegie + L); e.achatsRegieValue += val; }
      else if (src === 'pompe_externe') { e.achatsPompe = r2(e.achatsPompe + L); e.achatsPompeValue += val; }
      else if (src === 'dotation_site') { e.achatsDotationSite = r2(e.achatsDotationSite + L); e.achatsDotationSiteValue += val; }
      else if (src === 'manuel' || src === 'import') { e.achatsManuel = r2(e.achatsManuel + L); e.achatsManuelValue += val; }
      // Sorties : consommation ventilée par catégorie.
      const cat = catOfCode(f.vehicleCode);
      const ca = catAgg[ft][cat];
      ca.liters = r2(ca.liters + L); ca.value += val;
      const rr = report.find((x) => x.vehicleCode === f.vehicleCode);
      this.pushItem(ca, f.vehicleCode ?? '—', v ? `${v.brand ?? ''} ${v.model ?? ''}`.trim() : '', rr, L, val);
    }

    // ── Engins : pleins en saisie dédiée (engine_fuel_entries) ──
    for (const en of engineEntries) {
      if (!this.monthMatch(en.date, month)) continue;
      const v = vehicles.find((x) => x.code === en.vehicleCode);
      const ft = canonFuel(en.fuelType ?? v?.fuel);
      const L = en.qty ?? 0;
      const val = L * (en.unitPrice ?? 0);
      T[ft].entrees.achatsEnginsDedies = r2(T[ft].entrees.achatsEnginsDedies + L);
      T[ft].entrees.achatsEnginsDediesValue += val;
      const ca = catAgg[ft].engins;
      ca.liters = r2(ca.liters + L); ca.value += val;
      const rr = report.find((x) => x.vehicleCode === en.vehicleCode);
      this.pushItem(ca, en.vehicleCode ?? '—', v ? `${v.brand ?? ''} ${v.model ?? ''}`.trim() : 'engin', rr, L, val);
    }

    // ── Externes : sorties cuve vers un bénéficiaire externe (par type) ──
    for (const o of stockOps) {
      if (o.opType !== 'sortie' || o.targetKind !== 'external' || !this.monthMatch(o.date, month)) continue;
      const ft = canonFuel(o.fuelType);
      const L = o.liters ?? 0;
      const val = L * (o.unitPrice ?? 0);
      const ca = catAgg[ft].externes;
      ca.liters = r2(ca.liters + L); ca.value += val;
      ca.items.push({ code: 'EXT', label: o.targetLabel ?? o.targetCode ?? 'externe', usage: 'externe', liters: r2(L), value: Math.round(val), km: null, hours: null, verdict: null, ecartPct: null });
    }

    // ── Consolidation par type ──
    const global = emptyBalance('GASOIL');
    (global as { fuelType: string }).fuelType = 'GLOBAL';
    for (const ft of FUEL_TYPES) {
      const tb = T[ft];
      const e = tb.entrees;
      e.total = r2(e.stockDebutCuves + e.approsCuves + e.achatsCartes + e.achatsRegie + e.achatsPompe + e.achatsManuel + e.achatsDotationSite + e.achatsEnginsDedies);
      e.totalValue = Math.round(e.approsValue + e.achatsCartesValue + e.achatsRegieValue + e.achatsPompeValue + e.achatsManuelValue + e.achatsDotationSiteValue + e.achatsEnginsDediesValue);
      for (const cat of BILAN_CATS) {
        const ca = catAgg[ft][cat];
        const dst = tb.sorties[cat];
        dst.liters = r2(ca.liters); dst.value = Math.round(ca.value);
        // km / heures / conso : à partir des items uniques (part homogène km OU heures).
        const items = ca.items.sort((a, b) => b.liters - a.liters);
        const kmItems = items.filter((x) => x.km != null && x.km > 0 && (x.hours == null || x.hours === 0));
        const hrItems = items.filter((x) => x.hours != null && x.hours > 0);
        const km = kmItems.reduce((s, x) => s + (x.km ?? 0), 0);
        const hours = hrItems.reduce((s, x) => s + (x.hours ?? 0), 0);
        dst.km = km > 0 ? Math.round(km) : null;
        dst.hours = hours > 0 ? r2(hours) : null;
        dst.consoKm = km > 0 ? r2((kmItems.reduce((s, x) => s + x.liters, 0) / km) * 100) : null;
        dst.consoH = hours > 0 ? r2(hrItems.reduce((s, x) => s + x.liters, 0) / hours) : null;
        dst.items = items;
      }
      tb.sorties.total = r2(BILAN_CATS.reduce((s, cat) => s + tb.sorties[cat].liters, 0));
      tb.sorties.totalValue = BILAN_CATS.reduce((s, cat) => s + tb.sorties[cat].value, 0);

      // ── réserve totale = cuves + réservoirs · conso réelle = brut − Δréservoirs ──
      tb.reserveDebutTotale = r2(tb.entrees.stockDebutCuves + tb.reservoirsDebut);
      tb.reserveFinTotale = r2(tb.sorties.stockFinCuves + tb.reservoirsFin);
      tb.consoNette = r2(tb.sorties.total - tb.deltaReservoirs);

      // Écart (identique quelle que soit la présentation) :
      //   réserve début (cuves+rés.) + achats − conso réelle − réserve fin (cuves+rés.)
      const achats = r2(e.total - e.stockDebutCuves);
      tb.ecart = r2(tb.reserveDebutTotale + achats - tb.consoNette - tb.reserveFinTotale);
      tb.tolerance = r2(Math.max(15, e.total * 0.03));
      tb.reconcilie = Math.abs(tb.ecart) <= tb.tolerance;

      // roll-up global
      const ge = global.entrees; const te = e;
      ge.stockDebutCuves = r2(ge.stockDebutCuves + te.stockDebutCuves);
      ge.approsCuves = r2(ge.approsCuves + te.approsCuves); ge.approsValue += te.approsValue;
      ge.achatsCartes = r2(ge.achatsCartes + te.achatsCartes); ge.achatsCartesValue += te.achatsCartesValue;
      ge.achatsRegie = r2(ge.achatsRegie + te.achatsRegie); ge.achatsRegieValue += te.achatsRegieValue;
      ge.achatsPompe = r2(ge.achatsPompe + te.achatsPompe); ge.achatsPompeValue += te.achatsPompeValue;
      ge.achatsManuel = r2(ge.achatsManuel + te.achatsManuel); ge.achatsManuelValue += te.achatsManuelValue;
      ge.achatsDotationSite = r2(ge.achatsDotationSite + te.achatsDotationSite); ge.achatsDotationSiteValue += te.achatsDotationSiteValue;
      ge.achatsEnginsDedies = r2(ge.achatsEnginsDedies + te.achatsEnginsDedies); ge.achatsEnginsDediesValue += te.achatsEnginsDediesValue;
      ge.total = r2(ge.total + te.total); ge.totalValue += te.totalValue;
      for (const cat of BILAN_CATS) {
        global.sorties[cat].liters = r2(global.sorties[cat].liters + tb.sorties[cat].liters);
        global.sorties[cat].value += tb.sorties[cat].value;
      }
      global.sorties.stockFinCuves = r2(global.sorties.stockFinCuves + tb.sorties.stockFinCuves);
      global.sorties.total = r2(global.sorties.total + tb.sorties.total);
      global.sorties.totalValue += tb.sorties.totalValue;
      global.reservoirsDebut = r2(global.reservoirsDebut + tb.reservoirsDebut);
      global.reservoirsFin = r2(global.reservoirsFin + tb.reservoirsFin);
      global.reservoirsNbDeclares += tb.reservoirsNbDeclares;
      global.cuveEcart = r2(global.cuveEcart + tb.cuveEcart);
    }
    global.deltaReservoirs = r2(global.reservoirsFin - global.reservoirsDebut);
    global.reserveDebutTotale = r2(global.entrees.stockDebutCuves + global.reservoirsDebut);
    global.reserveFinTotale = r2(global.sorties.stockFinCuves + global.reservoirsFin);
    global.consoNette = r2(global.sorties.total - global.deltaReservoirs);
    const globalAchats = r2(global.entrees.total - global.entrees.stockDebutCuves);
    global.ecart = r2(global.reserveDebutTotale + globalAchats - global.consoNette - global.reserveFinTotale);
    global.tolerance = r2(Math.max(20, global.entrees.total * 0.03));
    global.reconcilie = Math.abs(global.ecart) <= global.tolerance;

    return {
      month, site: site ?? null,
      parType: T,
      global,
      cuves: cuveBlocks,
      // rétro-compat (frontend actuel) :
      entrees: {
        stockDebutCuves: global.entrees.stockDebutCuves, approsCuves: global.entrees.approsCuves, approsValue: global.entrees.approsValue,
        achatsCartes: global.entrees.achatsCartes, achatsCartesValue: global.entrees.achatsCartesValue,
        achatsRegie: global.entrees.achatsRegie, achatsRegieValue: global.entrees.achatsRegieValue,
        achatsPompeExterne: global.entrees.achatsPompe, achatsPompeValue: global.entrees.achatsPompeValue,
        achatsManuel: global.entrees.achatsManuel, achatsManuelValue: global.entrees.achatsManuelValue,
        achatsDotationSite: global.entrees.achatsDotationSite, achatsDotationSiteValue: global.entrees.achatsDotationSiteValue,
        achatsEnginsDedies: global.entrees.achatsEnginsDedies,
        total: global.entrees.total,
      },
      sorties: {
        missions: { ...global.sorties.missions, items: T.GASOIL.sorties.missions.items },
        permanents: { ...global.sorties.permanents, items: T.GASOIL.sorties.permanents.items },
        engins: { ...global.sorties.engins, items: T.GASOIL.sorties.engins.items },
        externes: { ...global.sorties.externes, items: T.GASOIL.sorties.externes.items },
        total: global.sorties.total,
      },
      stock: {
        debut: global.entrees.stockDebutCuves, appros: global.entrees.approsCuves,
        finReel: global.sorties.stockFinCuves,
        finTheorique: r2(global.entrees.stockDebutCuves + global.entrees.approsCuves - cuveBlocks.reduce((s, c) => s + c.sorties, 0)),
        ecart: r2(cuveBlocks.reduce((s, c) => s + c.ecart, 0)),
      },
      ecartGlobal: global.ecart,
      reconcilie: global.reconcilie,
      parItem: report
        .filter((r) => r.litresFournis > 0 || r.kmMonth || r.hoursMonth)
        .map((r) => ({
          vehicleCode: r.vehicleCode, label: r.label, type: r.type, fuelType: r.fuelType, usage: r.usage,
          categorie: catByCode.get(r.vehicleCode) ?? 'missions',
          km: r.kmFait, kmMissions: r.kmMissions, kmNonJustifie: r.kmNonJustifie, hours: r.hoursFait,
          litresAchetes: r.litresAchetes, litresNets: r.litresNets, deltaTank: r.deltaTank, tankDeclared: r.tankDeclared,
          litresBySource: r.litresBySource,
          consoReelle: r.consoReelle, norme: r.norme, litresTheoriques: r.litresTheoriques, kmTheorique: r.kmTheorique,
          ecartLitres: r.ecartLitres, ecartPct: r.ecartPct, verdict: r.verdict, flags: r.flags,
          readingStatus: r.readingStatus, declaredBy: r.declaredBy,
        })),
    };
  }

  private blankCatAgg() {
    const c = () => ({ liters: 0, value: 0, items: [] as Array<{ code: string; label: string; usage: string; liters: number; value: number; km: number | null; hours: number | null; verdict: string | null; ecartPct: number | null }> });
    return { missions: c(), permanents: c(), vlSite: c(), engins: c(), externes: c() };
  }

  private pushItem(
    ca: { items: Array<{ code: string; label: string; usage: string; liters: number; value: number; km: number | null; hours: number | null; verdict: string | null; ecartPct: number | null }> },
    code: string, label: string, rr: VehicleFuelControl | undefined, liters: number, value: number,
  ): void {
    const existing = ca.items.find((x) => x.code === code);
    if (existing) { existing.liters = Math.round((existing.liters + liters) * 100) / 100; existing.value = Math.round(existing.value + value); }
    else ca.items.push({ code, label, usage: rr?.usage ?? '', liters: Math.round(liters * 100) / 100, value: Math.round(value), km: rr?.kmFait ?? null, hours: rr?.hoursFait ?? null, verdict: rr?.verdict ?? null, ecartPct: rr?.ecartPct ?? null });
  }

  private async upsertAlert(title: string, desc: string | null): Promise<void> {
    const existing = await this.alerts.findOne({ where: { title, category: 'carb' } });
    if (desc) {
      if (existing) { existing.description = desc; existing.priority = 'HAUTE'; await this.alerts.save(existing); }
      else await this.alerts.save(this.alerts.create({ type: 'dg', title, description: desc, timeLabel: 'auto', category: 'carb', priority: 'HAUTE' }));
    } else if (existing) {
      await this.alerts.delete(existing.id);
    }
  }

  /**
   * Cron : gère les DEUX DEMANDES DISTINCTES de relevé par véhicule et par mois (retour DG) —
   *   • DÉBUT de mois : km/heures + réservoir de départ — émise dès le 1er, pour TOUS les véhicules
   *   • FIN de mois   : km/heures + réservoir de fin — émise aussi dès le 1er (étape planifiée),
   *                     due le dernier jour du mois
   * On n'attend pas la fin du mois pour créer la demande de fin. Le mois précédent reste suivi
   * pour les véhicules qui ont eu de l'activité (correction du km + maintenance).
   * 2 alertes séparées (« sans relevé de début » / « sans relevé de fin ») + 1 alerte « km hors mission ».
   */
  @Cron(CronExpression.EVERY_DAY_AT_6AM)
  async refreshMissingKmAlert(): Promise<{ debutManquant: number; finManquant: number; created: number; horsMission: number }> {
    const now = new Date();
    const nowMonth = now.toISOString().slice(0, 7);
    const prevMonthStr = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
    const months = [nowMonth, prevMonthStr];
    const vehicles = await this.vehicles.find();
    const params = ((await this.config.get('PARAMS')) as { kmHorsMissionSeuil?: number } | null) ?? {};
    const seuilHorsMission = params.kmHorsMissionSeuil ?? 500;
    let created = 0;
    const debutMissing: string[] = [];
    const finMissing: string[] = [];
    const horsMission: string[] = [];

    for (const month of months) {
      const isCurrentMonth = month === nowMonth;
      const firstOfMonth = `${month}-01`;
      const [py, pm] = month.split('-').map(Number);
      const lastDay = new Date(py, pm, 0).getDate();
      const monthOver = month < nowMonth;
      const prevMonth = new Date(py, pm - 2, 1).toISOString().slice(0, 7);
      const report = await this.monthReport(month);

      // km hors missions validées (véhicules à contrôle mission).
      for (const r of report.filter((x) => x.controlMethod === 'mission'
        && (x.kmNonJustifie ?? 0) >= seuilHorsMission)) {
        horsMission.push(`${r.vehicleCode} : ${r.kmNonJustifie} km hors missions (${month})`);
      }

      for (const r of report) {
        const activity = r.litresAchetes > 0 || r.kmMissions > 0 || (r.kmOdometer ?? 0) > 0 || !!r.reading;
        // Mois passé : on ne réclame que pour les véhicules qui ont bougé.
        if (!isCurrentMonth && !activity) continue;

        const existing = await this.readings.findOne({ where: { vehicleCode: r.vehicleCode, month } });
        const v = vehicles.find((x) => x.code === r.vehicleCode);
        const prev = await this.readings.findOne({ where: { vehicleCode: r.vehicleCode, month: prevMonth } });
        // km/heures de début : simple PRÉ-REMPLISSAGE indicatif (report du mois précédent ou compteur).
        // Le RÉSERVOIR de début n'est PAS pré-rempli : le DG / chauffeur doit le donner explicitement
        // (retour DG : on veut savoir qui a donné son km début ET son réservoir début).
        const kmStart = existing?.kmStart ?? prev?.kmEnd ?? (r.method === 'km_mensuel' ? v?.km ?? null : null);
        const hoursStart = existing?.hoursStart ?? prev?.hoursEnd ?? (r.method === 'heures_engin' ? v?.hourMeter ?? null : null);

        // Crée / met à niveau la ligne : les 2 demandes sont émises le 1er du mois.
        if (!existing) {
          await this.readings.save(this.readings.create({
            vehicleCode: r.vehicleCode, month, status: 'pending',
            openingRequestedAt: firstOfMonth, closingRequestedAt: firstOfMonth,
            kmStart, hoursStart,
            driverCode: v?.driverCode ?? null, requestedAt: firstOfMonth,
          }));
          created++;
        } else {
          let dirty = false;
          if (!existing.openingRequestedAt) { existing.openingRequestedAt = firstOfMonth; dirty = true; }
          if (!existing.closingRequestedAt) { existing.closingRequestedAt = firstOfMonth; dirty = true; }
          if (existing.kmStart == null && kmStart != null) { existing.kmStart = kmStart; dirty = true; }
          if (existing.hoursStart == null && hoursStart != null) { existing.hoursStart = hoursStart; dirty = true; }
          if (!existing.driverCode && v?.driverCode) { existing.driverCode = v.driverCode; dirty = true; }
          if (existing.status !== 'pending' && existing.status !== 'done') { existing.status = 'pending'; dirty = true; }
          if (dirty) await this.readings.save(existing);
        }

        const cur = await this.readings.findOne({ where: { vehicleCode: r.vehicleCode, month } });
        if (!FuelControlService.openingComplete(cur)) debutMissing.push(`${r.vehicleCode} (${month})`);
        if (!FuelControlService.closingComplete(cur) && monthOver) finMissing.push(`${r.vehicleCode} (${month})`);
      }
    }

    const uniq = (a: string[]) => [...new Set(a)];
    // Nettoyage de l'ancienne alerte fusionnée (remplacée par 2 alertes distinctes).
    for (const t of ['Relevés km / réservoir de début & fin de mois manquants (contrôle carburant)',
      'Relevés km / réservoir de fin de mois manquants (contrôle carburant)']) {
      const old = await this.alerts.findOne({ where: { title: t, category: 'carb' } });
      if (old) await this.alerts.delete(old.id);
    }
    await this.upsertAlert(
      'Relevé de DÉBUT de mois manquant (km + réservoir)',
      debutMissing.length
        ? `${uniq(debutMissing).length} véhicule(s) n'ont pas donné leur km + réservoir de début de mois : ${uniq(debutMissing).slice(0, 12).join(', ')}${uniq(debutMissing).length > 12 ? '…' : ''}. → Carburant → Contrôle → Suivi des relevés.`
        : null,
    );
    await this.upsertAlert(
      'Relevé de FIN de mois manquant (km + réservoir)',
      finMissing.length
        ? `${uniq(finMissing).length} véhicule(s) n'ont pas donné leur km + réservoir de fin de mois : ${uniq(finMissing).slice(0, 12).join(', ')}${uniq(finMissing).length > 12 ? '…' : ''}. → Carburant → Contrôle → Suivi des relevés.`
        : null,
    );

    // Alerte dédiée : km roulés hors des missions validées (véhicules à contrôle mission).
    await this.upsertAlert(
      'Kilomètres hors missions validées (véhicules à contrôle par mission)',
      horsMission.length
        ? `${uniq(horsMission).length} véhicule(s)-mois avec des km hors du cadre autorisé : ${uniq(horsMission).slice(0, 12).join(' · ')}. À vérifier (usage privé, missions non déclarées, compteur). Seuil : ${seuilHorsMission} km.`
        : null,
    );

    return {
      debutManquant: uniq(debutMissing).length,
      finManquant: uniq(finMissing).length,
      created,
      horsMission: uniq(horsMission).length,
    };
  }
}
