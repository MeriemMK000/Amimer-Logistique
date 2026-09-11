/**
 * Seed FleetPro — insere EXACTEMENT les donnees de demonstration de v8.
 * Les donnees sont figees dans src/seed-data.json (genere depuis la maquette v8).
 *
 *   cd backend && npm run seed
 */
import 'reflect-metadata';
import { randomBytes } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { FuelStockService } from './fuel-stock/fuel-stock.service';
import { FuelControlService } from './fuel-control/fuel-control.service';
import { FuelCardMovementService } from './fuel-card-movements/fuel-card-movements.service';
import { RegiePurchasesService } from './regie-purchases/regie-purchases.service';
import { SitePointageService } from './site-pointage/site-pointage.service';
import { MissionService } from './missions/missions.service';
import { SchedulerService } from './scheduler/scheduler.service';
import * as seedData from './seed-data.json';

const n = (v: any) => (v === '—' || v === '' || v === undefined ? null : v);

// ── Décalage des dates de démo pour que l'activité la plus récente tombe « aujourd'hui »
//    (sinon la vue « Mois courant » est vide quand on démo en début de mois).
const DAY = 86400000;
let SHIFT = 0;
function computeShift(dates: (string | null | undefined)[]) {
  const ts = dates.map(toTs).filter((t): t is number => t != null);
  if (!ts.length) return;
  const newest = Math.max(...ts);
  const oldest = Math.min(...ts);
  const mid = (newest + oldest) / 2;
  // On recentre la fenêtre de données sur « aujourd'hui » : la moitié de l'activité
  // tombe donc dans le mois courant, le reste juste avant / juste après (missions planifiées).
  SHIFT = Math.round((Date.now() - mid) / DAY);
}
function toTs(s: string | null | undefined): number | null {
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (m) return Date.UTC(+m[3], +m[2] - 1, +m[1]);
  m = /^(\d{2})\/(\d{2})$/.exec(s);
  if (m) return Date.UTC(new Date().getFullYear(), +m[2] - 1, +m[1]);
  return null;
}
/** Décale une date (quel que soit son format) de SHIFT jours, renvoie en ISO YYYY-MM-DD. */
function shiftDate(s: string | null | undefined): string | null {
  const t = toTs(s);
  if (t == null) return n(s) as string | null;
  return new Date(t + SHIFT * DAY).toISOString().slice(0, 10);
}

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const ds = app.get(DataSource);
  const d = seedData as any;
  const PREV_PROGS = d.PREV_PROGS as any[];

  computeShift([
    ...d.MI.map((m: any) => m.dateD),
    ...d.MI.map((m: any) => m.dateF),
    ...d.MT.map((o: any) => o.dt),
  ]);

  const repo = (name: string) => ds.getRepository(name);

  // Ordre sans contrainte FK — on vide puis on insere.
  const tables = [
    'Vehicle', 'Driver', 'Mission', 'MaintenanceOrder', 'Supplier', 'PurchaseOrder',
    'FuelEntry', 'EngineFuelEntry', 'DpcRequest', 'LeaseContract', 'LeasePointage',
    'Alert', 'BusinessUnit', 'MaintenancePlan', 'Qualification', 'AppConfigEntry',
    'VehicleAssignment', 'ExternalVehicle', 'ExternalInvoice', 'SitePointage', 'FuelCard', 'FuelCardMovement', 'CommercialReport',
    'Incident', 'ControlRequest', 'AccessToken', 'PecRequest', 'Tire', 'TireMovement',
    'FuelStockOp', 'MonthlyKmReading', 'RegiePurchase', 'Notification',
  ];
  // NB : la table `places` (référentiel de lieux) n'est PAS vidée — elle est amorcée
  // automatiquement (PlacesService.onModuleInit) et s'enrichit des points ajoutés à la main.
  for (const t of tables) {
    try { await repo(t).query(`TRUNCATE TABLE "${(repo(t).metadata.tableName)}" RESTART IDENTITY CASCADE`); } catch { /* table peut ne pas exister au 1er run */ }
  }

  await repo('Vehicle').save(
    d.V.map((v: any) => ({
      code: v.c, brand: v.b, model: v.m, type: v.t, plate: n(v.pl), status: v.s,
      km: v.km, fuel: n(v.fu), ownership: v.ow,
      genre: n(v.genre), lessor: n(v.lessor), serviceYear: v.year ?? null,
      fiscalPower: v.cv ?? null, chassis: n(v.chassis), siteBase: n(v.site), seats: v.seats ?? null,
      tireCount: v.tires ?? null, maxTonnage: v.ton ?? null,
      breakdownStatus: n(v.bdStatus), repairEta: n(v.repairEta),
      leaseStart: n(v.locStart), leaseEnd: n(v.locEnd), leaseAlertDays: v.locAlertDays ?? null, leaseCost: v.locCost ?? null,
      // Retour DG : coût du véhicule PROPRE pour la refacturation — quotidien 8h + mensuel (démo).
      ownedDailyCost: (v.ow === 'PROPRE' || v.ow === 'LEASING')
        ? (v.ownedDaily ?? ({ LEGER: 2800, LOURD: 7500, ENGIN: 10000, REMORQUE: 900 } as Record<string, number>)[v.t] ?? 3000)
        : null,
      ownedMonthlyCost: (v.ow === 'PROPRE' || v.ow === 'LEASING')
        ? (v.ownedCost ?? ({ LEGER: 55000, LOURD: 160000, ENGIN: 220000, REMORQUE: 20000 } as Record<string, number>)[v.t] ?? 60000)
        : null,
      tankLiters: v.res, normOff: v.no ?? null, normCorr: v.nc ?? null, normOffH: v.noH ?? null, normCorrH: v.ncH ?? null,
      ctDate: n(v.ct), ctStatus: n(v.cts), insDate: n(v.ass), insPolicy: n(v.assn), insStatus: n(v.asss),
      greyCard: n(v.cg), vignette: n(v.vi), driverCode: n(v.dr),
      breakdownHours: v.panneH ?? 0, hourMeter: v.hm ?? null, hourlyCost: v.coutH ?? null,
      equipment: v.equip ?? [],
      isCommercial: ['FL-002', 'FL-010'].includes(v.c),
      // Marge de cession individuelle de demo (le reste heritant du type / global via Facturation BU).
      margePct: ({ 'FL-003': 18, 'FL-001': 20 } as Record<string, number>)[v.c] ?? null,
    })),
  );

  const drvAddr: Record<string, [string, number]> = {
    'EMP-101': ['Cité 200 logements, Bab Ezzouar', 12],
    'EMP-102': ['Rue des Frères Bouadou, Bir Mourad Raïs', 8],
    'EMP-103': ['Draria centre', 15],
  };
  await repo('Driver').save(
    d.D.map((x: any) => ({
      code: x.n, name: x.nm, license: x.lic, licenseExpiry: n(x.lx), quals: x.qual ?? [],
      status: x.s, hoursWeek: x.hw, hoursMonth: x.hm, fatigue: x.fat,
      vehicleCode: n(x.vh), permanent: !!x.perm, phone: n(x.tel),
      hourlyCost: x.coutH ?? null, dailyCost: x.coutJour ?? (x.coutH ? Math.round(x.coutH * 8) : null),
      plan: x.plan ?? [],
      apteMission: x.n !== 'EMP-112', // EMP-112 (Mebarki) ne part pas en mission par defaut
      personType: /directeur|daf|dg\b/i.test(String(x.nm ?? '')) ? 'utilisateur' : 'chauffeur',
      workLocation: 'Alger',
      maxWeeklyHours: 48,
      // Chauffeur dedie a une BU + centre de cout du referentiel (retour DG : refacturation).
      dedicatedTo: x.n === 'EMP-112' ? 'MOB' : null,
      dedicatedCa: x.n === 'EMP-112' ? 'MOB-PER' : null,
      address: drvAddr[x.n]?.[0] ?? null,
      workDistanceKm: drvAddr[x.n]?.[1] ?? null,
    })),
  );

  // 3e axe analytique : site / chantier de rattachement (retour DG).
  const MISSION_SITE: Record<string, string> = {
    'M-2026-0846': 'Hassi Messaoud', 'M-2026-0838': 'Oran Base', 'M-2026-0835': 'Ghardaïa',
    'M-2026-0847': 'Oran Base', 'M-2026-0840': 'Sétif Antenne',
  };
  // Demo allegee (retour DG) : jeu reduit de missions — 2 planifiees, 2 en cours, 1 terminee, 1 cloturee.
  const KEEP_MISSIONS = ['M-2026-0849', 'M-2026-0843', 'M-2026-0847', 'M-2026-0845', 'M-2026-0840', 'M-2026-0835'];
  const daysAgo = (nb: number) => new Date(Date.now() - nb * 86_400_000).toISOString().slice(0, 10);
  await repo('Mission').save(
    d.MI.filter((m: any) => KEEP_MISSIONS.includes(m.n)).map((m: any) => {
      const row: any = {
        num: m.n, driverCode: n(m.dr), vehicleCode: n(m.vh), fromLoc: m.fr, toLoc: m.to, status: m.s,
        dateStart: shiftDate(m.dateD), timeStart: n(m.heureD), dateEnd: shiftDate(m.dateF), timeEnd: n(m.heureF),
        distance: m.d, zone: n(m.z), cost: m.co ?? null, waypoints: m.wp ?? [], closed: !!m.closed,
        bu: n(m.bu), ca: n(m.ca), site: MISSION_SITE[m.n] ?? null,
      };
      // Demo : la mission terminee a une fin theorique depassee -> proposition de cloture J+1.
      if (m.n === 'M-2026-0840') { row.dateStart = daysAgo(6); row.dateEnd = daysAgo(3); }
      // Retour DG : onglets « à valider » vs « planifiées ». Les missions EN_COURS / TERMINEE / CLOTUREE
      // ont forcément été validées ; une PLANIFIEE est validée (0849) ou en attente (0843, 0851).
      if (['EN_COURS', 'TERMINEE', 'CLOTUREE'].includes(m.s) || m.n === 'M-2026-0849') {
        row.officeValidated = true;
        row.officeValidatedAt = shiftDate(m.dateD) ?? new Date().toISOString().slice(0, 10);
      }
      // La mission EN_COURS a déjà reçu son ordre de mission (émis au démarrage).
      if (m.s === 'EN_COURS') row.ordreEmisAt = new Date().toISOString();
      return row;
    }),
  );

  // Missions EN_COURS : les ancrer sur « maintenant » pour un avancement GPS realiste
  // (retour DG : une mission demarree doit montrer sa progression + position approximative).
  {
    const nowMs = Date.now();
    const speedKmh = 70;
    const enCours = await repo('Mission').find({ where: { status: 'EN_COURS' } });
    let k = 0;
    for (const m of enCours as any[]) {
      const total = m.distance ?? 120;
      const tripMin = (total / speedKmh) * 60;
      const frac = [0.35, 0.55, 0.7][k % 3]; // avancements varies pour la demo
      k++;
      const started = new Date(nowMs - tripMin * frac * 60000);
      const end = new Date(nowMs + tripMin * (1 - frac) * 60000);
      m.startedAt = started.toISOString();
      m.driverAccepted = true;
      m.driverAcceptedAt = started.toISOString();
      m.dateStart = started.toISOString().slice(0, 10);
      m.timeStart = started.toTimeString().slice(0, 5);
      m.dateEnd = end.toISOString().slice(0, 10);
      m.timeEnd = end.toTimeString().slice(0, 5);
      await repo('Mission').save(m);
    }
  }

  // Coherence : un vehicule affecte a une mission en cours doit etre EN_MISSION
  // (corrige des incoherences de la maquette v8, ex. FL-005).
  const activeVehCodes = d.MI
    .filter((m: any) => KEEP_MISSIONS.includes(m.n) && ['EN_COURS', 'MODIFIEE'].includes(m.s))
    .map((m: any) => n(m.vh))
    .filter(Boolean);
  if (activeVehCodes.length) {
    await repo('Vehicle')
      .createQueryBuilder()
      .update()
      .set({ status: 'EN_MISSION' })
      .where('code IN (:...codes) AND status = :dispo', { codes: activeVehCodes, dispo: 'DISPONIBLE' })
      .execute();
  }

  const OT_STATUS_MAP: Record<string, string> = { PLANIFIE: 'valide', EN_COURS: 'en_lancement', TERMINE: 'termine', ANNULE: 'annule' };
  // Cohérence démo « véhicules en panne » : le statut de l'OT reflète la prise en charge du véhicule.
  //   FL-018 → en réparation (OT en atelier) · FL-065 → pris en charge (OT validé, pas démarré)
  //   FL-042 → non pris en charge (OT juste déclaré).
  const OT_STATUS_OVERRIDE: Record<string, string> = { 'OT-0413': 'valide', 'OT-0410': 'ouvert' };
  const vhPanne: Record<string, number> = Object.fromEntries((d.V as any[]).map((v) => [v.c, v.panneH ?? 0]));
  await repo('MaintenanceOrder').save(
    d.MT.map((o: any) => {
      const status = OT_STATUS_OVERRIDE[o.n] ?? OT_STATUS_MAP[o.s] ?? 'ouvert';
      return {
        num: o.n, vehicleCode: o.vh, type: o.t, title: o.ti, priority: o.pr, status,
        partsCost: o.pi, laborCost: o.mo, totalCost: o.co, date: shiftDate(o.dt), supplierCode: n(o.frn), operations: o.ops ?? [],
        breakdownHours: o.t === 'CURATIVE' && status !== 'termine' ? (vhPanne[o.vh] || null) : null,
        statusHistory: [{ status, at: new Date().toISOString(), note: 'Import initial' }],
        // Le detenteur du vehicule doit valider chaque intervention.
        holderNotifiedAt: o.vh ? shiftDate(o.dt) : null,
        holderValidated: status === 'termine' ? true : false,
      };
    }),
  );

  await repo('Supplier').save(
    d.FOURNISSEURS.map((s: any) => ({ code: s.code, name: s.nom, contact: n(s.contact), phone: n(s.tel), email: n(s.email), city: n(s.ville) })),
  );

  await repo('PurchaseOrder').save(
    d.BC_LIST.map((b: any) => ({ num: b.n, otNum: n(b.ot), supplierCode: n(b.frn), date: shiftDate(b.date), amount: b.montant, status: b.statut, items: b.items ?? [] })),
  );

  // Registre unique des pleins. Les pleins « carte » sont créés via les passages de carte
  // (plus bas) ; la régie et le stock site créent leurs propres pleins via leur service.
  // Ici : achats directs à la pompe (hors réseau NAFTAL) + saisies manuelles.
  const FU_SOURCE = ['pompe_externe', 'pompe_externe', 'manuel'];
  await repo('FuelEntry').save(
    // FL-055 / FL-060 : engins alimentés uniquement depuis la cuve du site (voir plus bas).
    d.FU.filter((f: any) => !['FL-055', 'FL-060'].includes(f.vh)).map((f: any, i: number) => {
      const grade = String(f.ty ?? '').toUpperCase() === 'ESSENCE' ? (f.grade ?? 'SP') : (f.grade ?? null);
      return {
        date: shiftDate(f.dt), vehicleCode: f.vh, driverCode: n(f.dr), fuelType: f.ty, grade, qty: f.q, unitPrice: f.px,
        amount: Math.round((f.q ?? 0) * (f.px ?? 0)),
        kmEnd: f.km2 ?? null, kmStart: f.km1 ?? null, tankBalance: f.rb ?? null, norm: f.no ?? null,
        closed: !!f.closed, source: FU_SOURCE[i % FU_SOURCE.length],
      };
    }),
  );

  // Stock carburant site — cuve Hassi Messaoud (litres). Approvisionnements + sorties.
  {
    const tm = new Date().toISOString().slice(0, 7);
    const pm = (() => { const x = new Date(); x.setMonth(x.getMonth() - 1); return x.toISOString().slice(0, 7); })();
    const gasoilPx = (d.FUEL_PRICES?.GASOIL ?? 45) as number;
    const ops: any[] = [
      { siteCode: 'Hassi Messaoud', opType: 'initial', date: `${pm}-01`, fuelType: 'GASOIL', liters: 1500, amount: Math.round(1500 * gasoilPx), supplier: 'Stock de départ (inventaire cuve)' },
      { siteCode: 'Hassi Messaoud', opType: 'appro', date: `${pm}-28`, fuelType: 'GASOIL', liters: 5000, amount: Math.round(5000 * gasoilPx), supplier: 'NAFTAL — dépôt Hassi Messaoud' },
      { siteCode: 'Hassi Messaoud', opType: 'appro', date: `${tm}-10`, fuelType: 'GASOIL', liters: 3000, amount: Math.round(3000 * (gasoilPx + 1)), supplier: 'NAFTAL — dépôt Hassi Messaoud' },
      // Engins site : carburant servi depuis la cuve du chantier (modèle « réserve + entrées/sorties »).
      // FL-055 ≈ conforme sur ses heures ; FL-060 sur-consomme (anomalie).
      { siteCode: 'Hassi Messaoud', opType: 'sortie', date: `${tm}-03`, fuelType: 'GASOIL', liters: 320, targetKind: 'vehicle', targetCode: 'FL-055', targetLabel: 'JCB 3CX' },
      { siteCode: 'Hassi Messaoud', opType: 'sortie', date: `${tm}-12`, fuelType: 'GASOIL', liters: 360, targetKind: 'vehicle', targetCode: 'FL-055', targetLabel: 'JCB 3CX' },
      { siteCode: 'Hassi Messaoud', opType: 'sortie', date: `${tm}-06`, fuelType: 'GASOIL', liters: 260, targetKind: 'vehicle', targetCode: 'FL-060', targetLabel: 'Engin loué' },
      { siteCode: 'Hassi Messaoud', opType: 'sortie', date: `${tm}-14`, fuelType: 'GASOIL', liters: 175, targetKind: 'vehicle', targetCode: 'FL-060', targetLabel: 'Engin loué' },
      { siteCode: 'Hassi Messaoud', opType: 'sortie', date: `${tm}-08`, fuelType: 'GASOIL', liters: 90, targetKind: 'vehicle', targetCode: 'FL-003', targetLabel: 'MAN TGS — mise à dispo' },
      { siteCode: 'Hassi Messaoud', opType: 'sortie', date: `${tm}-09`, fuelType: 'GASOIL', liters: 150, targetKind: 'external', targetLabel: 'Camion sous-traitant TP (Transbat)', businessUnit: 'OPS', costCenter: 'OPS-CHT' },
      // Inventaire physique de fin de mois : la jauge de cuve indique ~480 L de moins que la théorie
      // → écart d'inventaire à investiguer (retour DG : « l'importance des contrôles »).
      { siteCode: 'Hassi Messaoud', opType: 'initial', date: `${tm}-27`, fuelType: 'GASOIL', liters: 7660, amount: Math.round(7660 * gasoilPx), supplier: 'Inventaire physique cuve (jauge) — écart constaté' },
    ];
    const fuelStockSvc = app.get(FuelStockService);
    for (const o of ops) await fuelStockSvc.create(o);

    // Relevés km / heures + RÉSERVOIR début-fin de mois (contrôle carburant, retour DG :
    // vraie conso = Σ pleins − (réservoir fin − réservoir début)).
    await repo('MonthlyKmReading').save([
      { vehicleCode: 'FL-001', month: tm, kmStart: 141000, kmEnd: 143870, tankStart: 20, tankEnd: 35, status: 'done', declaredBy: 'bureau' },
      { vehicleCode: 'FL-002', month: tm, kmStart: 96200, kmEnd: 97650, tankStart: 15, tankEnd: 50, status: 'done', declaredBy: 'bureau' },
      { vehicleCode: 'FL-003', month: tm, kmStart: 311800, kmEnd: 314100, tankStart: 80, tankEnd: 120, status: 'done', declaredBy: 'bureau' },
      { vehicleCode: 'FL-055', month: tm, hoursStart: 1240, hoursEnd: 1288, tankStart: 60, tankEnd: 40, status: 'done', declaredBy: 'bureau' },
      // FL-005 volontairement sans relevé -> demande auto + alerte rouge
    ]);

    // Bons d'achat carburant en régie (retour DG) — pré-autorisation + QR.
    const regieSvc = app.get(RegiePurchasesService);
    const b1 = await regieSvc.create({ vehicleCode: 'FL-002', driverCode: 'EMP-102', fuelType: 'GASOIL', date: `${tm}-04`, validUntil: `${tm}-06`, maxLiters: 45, maxAmount: 2500, reason: 'Déplacement Sétif — station hors réseau NAFTAL', issuedBy: 'Chargé exploitation' });
    await regieSvc.consume(b1.id, { actualLiters: 42, actualAmount: 2310, actualDate: `${tm}-05`, station: 'Station Sétif Est' });
    await regieSvc.create({ vehicleCode: 'FL-018', driverCode: null, fuelType: 'GASOIL', date: `${tm}-11`, validUntil: `${tm}-14`, maxLiters: 60, maxAmount: 3200, reason: 'Panne — remorquage, plein d\'appoint', issuedBy: 'Chargé exploitation' });
    // Véhicule affecté au dépôt d'Alger : achat régie (station hors réseau) — canal à récupérer dans le contrôle.
    const b3 = await regieSvc.create({ vehicleCode: 'FL-010', driverCode: null, fuelType: 'GASOIL', date: `${tm}-13`, validUntil: `${tm}-16`, maxLiters: 25, maxAmount: 1400, reason: 'Tournée dépôt Alger — station hors réseau NAFTAL', issuedBy: 'Chef de parc' });
    await regieSvc.consume(b3.id, { actualLiters: 22, actualAmount: 1210, actualDate: `${tm}-13`, station: 'Station Dar El Beïda' });

    try {
      const sch = app.get(SchedulerService);
      const r = await sch.refreshEquipmentExpiryAlerts();
      console.log(`Alertes équipement (auto) : ${r.created} créées`);
    } catch (e) {
      console.warn('refreshEquipmentExpiryAlerts (seed) :', (e as Error).message);
    }
  }

  // FL-055 / FL-060 sont alimentés depuis la cuve du site (sorties de stock) → on ne double
  // pas avec des pleins engins dédiés. FL-065 garde ses pleins directs (pompe).
  await repo('EngineFuelEntry').save(
    d.FUE.filter((f: any) => !['FL-055', 'FL-060'].includes(f.vh)).map((f: any) => ({
      date: shiftDate(f.dt), vehicleCode: f.vh, operator: n(f.op), fuelType: f.ty, qty: f.q, unitPrice: f.px,
      hourEnd: f.h2 ?? null, hourStart: f.h1 ?? null, normH: f.noH ?? null, closed: !!f.closed,
    })),
  );

  const nowY = new Date().getFullYear();
  const dPlus = (nb: number) => new Date(Date.now() + nb * 86_400_000).toISOString().slice(0, 10);
  await repo('DpcRequest').save([
    ...d.DPC.map((r: any) => ({
      code: r.code, dateSaisie: shiftDate(r.dateSaisie), dateAller: shiftDate(r.dateAller), dateRetour: shiftDate(r.dateRetour),
      depAller: n(r.depAller), destAller: n(r.destAller), depRetour: n(r.depRetour), destRetour: n(r.destRetour),
      bu: n(r.bu), structure: n(r.structure), priorite: n(r.priorite), urgence: n(r.urgence),
      statut: r.statut, notes: n(r.notes), demandeur: n(r.demandeur), missionRef: n(r.missionRef),
      pax: r.pax ?? null, tonnage: r.tonnage ?? null,
      source: 'interne',
    })),
    // Reçue via le FORMULAIRE PUBLIC (retour DG) — entre en attente de validation.
    {
      code: `DPC-${nowY}-0005`, source: 'formulaire', statut: 'EN_ATTENTE',
      dateSaisie: dPlus(-1), dateAller: dPlus(9), dateRetour: dPlus(11),
      depAller: 'Alger', destAller: 'Béjaïa', depRetour: 'Béjaïa', destRetour: 'Alger',
      structure: 'Délégation partenaire (4 pers.)', priorite: 'NORMALE', urgence: 'NORMALE',
      demandeur: 'Sonatrach — R. Belkacem', demandeurTel: '0661 22 33 44', demandeurEmail: 'r.belkacem@example.dz',
      organisation: 'Sonatrach', pax: 4, distanceKm: 260,
      notes: 'Reçue via formulaire public',
    },
    // Récupérée de la PLATEFORME AMIMER ÉNERGIE — déjà validée de leur côté.
    {
      code: `DPC-${nowY}-0006`, source: 'amimer_energie', statut: 'VALIDEE',
      dateSaisie: dPlus(-2), dateAller: dPlus(6), dateRetour: dPlus(8),
      depAller: 'Alger', destAller: 'Hassi Messaoud', depRetour: 'Hassi Messaoud', destRetour: 'Alger',
      bu: 'Énergie', structure: 'Équipe forage (6 pers.)', priorite: 'HAUTE', urgence: 'NORMALE',
      demandeur: 'Amimer Énergie — Direction Ops', organisation: 'Amimer Énergie',
      pax: 6, distanceKm: 850, refExterne: 'AE-2026-1187',
      notes: 'Import plateforme Amimer Énergie — mission validée',
    },
    // ── Deux demandes sur le MÊME AXE Alger→Constantine, dates proches → groupables (retour DG) ──
    {
      code: `DPC-${nowY}-0007`, source: 'interne', statut: 'VALIDEE',
      dateSaisie: dPlus(-3), dateAller: dPlus(4), dateRetour: dPlus(5),
      depAller: 'Alger', destAller: 'Constantine', depRetour: 'Constantine', destRetour: 'Alger',
      bu: 'COM', structure: 'Équipe commerciale salon Est', priorite: 'HAUTE', urgence: 'NORMALE',
      demandeur: 'M. Benali', demandeurEmail: 'm.benali@example.dz', demandeurTel: '0550 41 22 08', pax: 3, distanceKm: 430,
    },
    {
      code: `DPC-${nowY}-0008`, source: 'formulaire', statut: 'VALIDEE',
      dateSaisie: dPlus(-3), dateAller: dPlus(4), dateRetour: dPlus(5),
      depAller: 'Alger', destAller: 'Sétif', depRetour: 'Sétif', destRetour: 'Alger',
      bu: 'LOG', structure: 'Auditeurs (dépose Sétif)', priorite: 'NORMALE', urgence: 'NORMALE',
      demandeur: 'Cabinet Audit — S. Kaci', organisation: 'Cabinet Audit', demandeurTel: '0770 55 44 33', demandeurEmail: 's.kaci@cabinet-audit.dz',
      pax: 2, distanceKm: 300,
    },
    // ── Paire NON transformée, même axe, pour tester le regroupement EN DIRECT (démo DG) :
    //    Alger→Constantine (4 pers.) + dépose Sétif (3 pers.) → pic 7 à bord ⇒ seul le minibus passe.
    {
      code: `DPC-${nowY}-0009`, source: 'interne', statut: 'VALIDEE',
      dateSaisie: dPlus(-2), dateAller: dPlus(1), dateRetour: dPlus(2),
      depAller: 'Alger', destAller: 'Constantine', depRetour: 'Constantine', destRetour: 'Alger',
      bu: 'OPS', structure: 'Équipe technique chantier Est', priorite: 'HAUTE', urgence: 'NORMALE',
      demandeur: 'A. Touati', pax: 4, distanceKm: 430,
    },
    {
      code: `DPC-${nowY}-0010`, source: 'formulaire', statut: 'VALIDEE',
      dateSaisie: dPlus(-2), dateAller: dPlus(1), dateRetour: dPlus(2),
      depAller: 'Alger', destAller: 'Sétif', depRetour: 'Sétif', destRetour: 'Alger',
      bu: 'MNT', structure: 'Formateurs (dépose Sétif)', priorite: 'NORMALE', urgence: 'NORMALE',
      demandeur: 'Centre Formation — H. Zerrouki', organisation: 'Centre Formation', demandeurTel: '0661 90 12 34',
      pax: 3, distanceKm: 300,
    },
  ]);

  // Mission de démonstration qui REGROUPE les 2 demandes ci-dessus (via le service → répartition auto).
  try {
    const missionSvc = app.get(MissionService);
    await missionSvc.create({
      num: `M-${nowY}-0851`, fromLoc: 'Alger', toLoc: 'Constantine', dateStart: dPlus(4), timeStart: '07:00',
      dateEnd: dPlus(5), timeEnd: '19:00',
      vehicleCode: 'FL-030', driverCode: 'EMP-108', status: 'PLANIFIEE',
      dpcRefs: [`DPC-${nowY}-0007`, `DPC-${nowY}-0008`],
    });
    console.log('Mission groupée de démo créée (DPC-0007 + DPC-0008 → M-…-0851)');
  } catch (e) {
    console.warn('Mission groupée démo :', (e as Error).message);
  }

  await repo('LeaseContract').save(
    d.LOC_CONTRACTS.map((c: any) => ({
      id: c.id, vehicleCode: c.vh, num: c.num, dailyPrice: c.dailyPrice,
      immobilizationPrice: Math.round((c.dailyPrice ?? 0) * 0.5), // ~50% par defaut, modifiable
      startDate: c.startDate, endDate: c.endDate, notes: n(c.notes),
    })),
  );

  // Pointage location : fraction de journee (0 = absent, 1 = journee entiere de 8 h).
  // Demo allegee (retour DG) : on ne garde que le mois courant + on limite a 2 vehicules loues
  // pour pouvoir verifier les calculs de facturation location a la main.
  const curMonth = new Date().toISOString().slice(0, 7);
  const ptKeepVh = ['FL-010', 'FL-042'];
  await repo('LeasePointage').save(
    d.LOC_POINTAGE
      .map((p: any) => {
        const date = shiftDate(p.date) ?? p.date;
        const fraction = p.present ? 1 : 0;
        return { vehicleCode: p.vh, date, fraction, present: fraction > 0, notes: n(p.notes) };
      })
      .filter((p: any) => p.fraction > 0 && (p.date ?? '').slice(0, 7) === curMonth && ptKeepVh.includes(p.vehicleCode)),
  );
  // Quelques journees recentes en demi-journee / heures pour la demo (mois courant).
  const recentWeekday = (back: number) => {
    const x = new Date();
    let seen = 0;
    while (true) {
      const dow = x.getDay();
      if (dow !== 5 && dow !== 6) { if (seen === back) break; seen++; }
      x.setDate(x.getDate() - 1);
    }
    return x.toISOString().slice(0, 10);
  };
  const demoFr: [string, number, number][] = [
    ['FL-010', 0, 0.5], ['FL-010', 1, 0.125], ['FL-055', 0, 0.75], ['FL-055', 2, 0.25], ['FL-060', 1, 0.5],
  ];
  for (const [vh, back, fraction] of demoFr) {
    const date = recentWeekday(back);
    const existing = await repo('LeasePointage').findOne({ where: { vehicleCode: vh, date } as any });
    if (existing) { (existing as any).fraction = fraction; (existing as any).present = true; await repo('LeasePointage').save(existing); }
    else await repo('LeasePointage').save({ vehicleCode: vh, date, fraction, present: true, notes: '' } as any);
  }
  // Jours d'immobilisation (I) de demo : vehicule immobilise sur place.
  for (const [vh, back] of [['FL-042', 3], ['FL-042', 4], ['FL-055', 5], ['FL-060', 3], ['FL-060', 4]] as [string, number][]) {
    const date = recentWeekday(back);
    const existing = await repo('LeasePointage').findOne({ where: { vehicleCode: vh, date } as any });
    if (existing) { (existing as any).immobilized = true; (existing as any).fraction = 1; (existing as any).present = true; await repo('LeasePointage').save(existing); }
    else await repo('LeasePointage').save({ vehicleCode: vh, date, fraction: 1, immobilized: true, present: true, notes: 'Immobilisé sur place' } as any);
  }

  await repo('Alert').save(
    d.AL.map((a: any) => ({ type: n(a.ty), title: a.ti, description: n(a.ds), timeLabel: n(a.tm), category: n(a.cat), priority: a.pr })),
  );

  await repo('BusinessUnit').save(
    d.BU_CA.map((b: any) => ({ code: b.code, name: b.nom, ca: b.ca ?? [], manager: b.manager ?? null })),
  );

  // Modeles d'entretien preventif (Partie 3) : converti depuis PREV_PROGS v8.
  const parseInterval = (s: string): { trigger: string; value: number } => {
    const km = s.match(/([\d\s]+)\s*km/i);
    if (km) return { trigger: 'KM', value: parseInt(km[1].replace(/\s/g, ''), 10) };
    const mois = s.match(/(\d+)\s*mois/i);
    if (mois) return { trigger: 'KM', value: 20000 }; // fallback km
    return { trigger: 'KM', value: 10000 };
  };
  await repo('MaintenancePlan').save(
    PREV_PROGS.map((p: any) => {
      const iv = parseInterval(p.interval ?? '');
      return {
        name: p.nom,
        targetKind: 'vehicles',
        targetVehicles: p.vh ?? [],
        trigger: iv.trigger,
        intervalValue: iv.value,
        operations: (p.travaux ?? []).map((t: string) => ({ label: t, coutEstime: Math.round((p.cout ?? 0) / Math.max(1, (p.travaux ?? []).length)) })),
        alertThresholdPct: 90,
        active: true,
      };
    }),
  );

  await repo('Qualification').save([
    { code: 'ADR', label: 'ADR — matieres dangereuses', description: 'Transport de matieres dangereuses (route)', sensitive: true },
    { code: 'Frigo', label: 'Frigorifique', description: 'Conduite de vehicule frigorifique', sensitive: false },
    { code: 'Matieres Dangereuses', label: 'Matieres dangereuses (etendu)', description: 'Habilitation etendue matieres dangereuses', sensitive: true },
    { code: 'Citerne', label: 'Citerne', description: 'Transport en citerne', sensitive: true },
    { code: 'Transport Personnes', label: 'Transport de personnes', description: 'Transport de personnel / delegations', sensitive: true },
  ]);

  await repo('AppConfigEntry').save([
    { key: 'FUEL_PRICES', value: d.FUEL_PRICES },
    // + km quotidien autorise (trajet domicile tolere avant de compter en non-productif).
    { key: 'PARAMS', value: { ...d.PARAMS, dailyAllowedKm: 3, kmHorsMissionSeuil: 500, joursOuvresMois: 22 } },
    { key: 'BAREME_MISSION', value: d.BAREME_MISSION },
    { key: 'MARGE_TYPE', value: d.MARGE_TYPE },
    { key: 'MARGE_PCT', value: d.MARGE_PCT },
    { key: 'FRAIS_RULES', value: { defaultRadiusKm: 50, byLocation: { Alger: 50, Oran: 60, 'Hassi Messaoud': 100 } } },
    // Retour DG : listes Flotte modifiables (Type / Genre / Carburant / Propriete).
    {
      key: 'VEHICLE_LISTS',
      value: {
        type: ['LEGER', 'LOURD', 'ENGIN', 'REMORQUE'],
        genre: ['VIP', 'CTTE', 'CAM', 'TR', 'ENGIN', 'REMORQUE'],
        fuel: ['GASOIL', 'ESSENCE', 'GPL'],
        ownership: ['PROPRE', 'LEASING', 'LOCATION'],
      },
    },
    // Retour DG : poids de l'algo de proposition vehicule + chauffeur (modale mission + planification).
    {
      key: 'PROPOSAL_CONFIG',
      value: {
        weights: { fat: 35, hrs: 20, qual: 20, dedicated: 20, doc: 10, km: 15, conso: 10 },
        enabled: { fat: true, hrs: true, qual: true, dedicated: true, doc: true, km: true, conso: false },
      },
    },
    // Evaluation chauffeurs — parametrable (echelle /20 ou /5, poids des criteres).
    {
      key: 'EVAL_CONFIG',
      value: {
        scale: 20,
        criteria: [
          { key: 'conduite', label: 'Conduite', weight: 30 },
          { key: 'accidentologie', label: 'Accidentologie', weight: 25 },
          { key: 'assiduite', label: 'Assiduité', weight: 15 },
          { key: 'materiel', label: 'État du matériel affecté', weight: 15 },
          { key: 'discretion', label: 'Discrétion', weight: 10 },
          { key: 'presentation', label: 'Présentation', weight: 5 },
        ],
      },
    },
  ]);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const prevMonth = (() => { const x = new Date(); x.setMonth(x.getMonth() - 1); return x.toISOString().slice(0, 7); })();

  // Tous les vehicules loues + affectes ont une affectation site (retour DG : facturation par site).
  const ctPrice: Record<string, number> = Object.fromEntries(
    (d.LOC_CONTRACTS as any[]).map((c) => [c.vh, c.dailyPrice ?? 0]),
  );
  const assignRows: Record<string, unknown>[] = [
    { vehicleCode: 'FL-055', driverCode: null, withDriver: false, kind: 'permanent', dateStart: `${prevMonth}-01`, dateEnd: null, siteCode: 'Hassi Messaoud', businessUnit: 'OPS', vehicleMonthlyCost: 180000, note: 'JCB 3CX dédié chantier Gassi Touil' },
    { vehicleCode: 'FL-060', driverCode: null, withDriver: false, kind: 'permanent', dateStart: `${prevMonth}-01`, dateEnd: null, siteCode: 'Hassi Messaoud', businessUnit: 'OPS', vehicleMonthlyCost: 165000, note: 'Engin loué chantier Hassi Messaoud' },
    { vehicleCode: 'FL-003', driverCode: 'EMP-101', withDriver: true, kind: 'periode', dateStart: `${thisMonth}-05`, dateEnd: `${thisMonth}-25`, siteCode: 'Hassi Messaoud', businessUnit: 'OPS', vehicleMonthlyCost: 120000, note: 'Mise à disposition avec chauffeur' },
    { vehicleCode: 'FL-042', driverCode: null, withDriver: false, kind: 'permanent', dateStart: `${prevMonth}-01`, dateEnd: null, siteCode: 'Oran Base', businessUnit: 'LOG', vehicleMonthlyCost: 72000, note: 'Kangoo Express loué (SOVAC) — base Oran' },
    { vehicleCode: 'FL-010', driverCode: null, withDriver: false, kind: 'permanent', dateStart: `${prevMonth}-01`, dateEnd: null, siteCode: 'Alger Dépôt', businessUnit: 'LOG', vehicleMonthlyCost: 85000, note: 'Fiat Doblo loué (EURL SAADNA) — dépôt Alger' },
    // Affectations permanentes de voitures a des responsables (retour DG) : BU + centre de cout du referentiel.
    { vehicleCode: 'FL-002', driverCode: null, withDriver: false, kind: 'permanent', dateStart: `${prevMonth}-01`, dateEnd: null, businessUnit: 'COM', costCenter: 'COM-VEN', structure: 'Direction Commerciale', assigneeName: 'M. Kaci — Directeur Commercial', dailyHomeKm: 30, fuelCardNumber: 'NAFTAL-4588', monthlyFuelCap: 25000, vehicleMonthlyCost: 60000, note: 'Voiture de fonction' },
    { vehicleCode: 'FL-025', driverCode: 'EMP-105', withDriver: true, kind: 'permanent', dateStart: `${prevMonth}-01`, dateEnd: null, businessUnit: 'ADM', costCenter: 'ADM-ACH', structure: 'Direction Administrative & Financière', assigneeName: 'Mme Bensalem — DAF', dailyHomeKm: 18, fuelCardNumber: 'NAFTAL-4591', monthlyFuelCap: 20000, vehicleMonthlyCost: 65000, note: 'Voiture de fonction — avec chauffeur dédié' },
  ];
  // Retour DG « logique affectation site » : marqueur centre analytique + jeton d'ordre de mission.
  await repo('VehicleAssignment').save(assignRows.map((a) => ({
    ...a,
    costCenterKind: a.costCenterKind ?? (a.siteCode ? 'site' : a.assigneeName ? 'person' : 'bu'),
    purpose: a.purpose ?? (a.siteCode ? 'Mise à disposition chantier' : null),
    verifyToken: a.verifyToken ?? randomBytes(9).toString('hex'),
  })));

  await repo('ExternalVehicle').save([
    { label: 'Camion sous-traitant TP', plate: '00123-116-31', owner: 'SARL Transbat', contact: '0550 11 22 33', siteCode: 'Hassi Messaoud', fuelType: 'Diesel', kind: 'LOURD', supplier: 'SARL Transbat', unitRate: 18000, rateUnit: 'day', active: true, note: 'Reçoit du carburant sur site — facture contrôlée au pointage' },
  ]);

  // Pointage site — retour DG : engins ET véhicules affectés à un site n'ont pas de missions.
  //  - engins : pointage horaire (compteur h début→fin) → conso L/h vs norme constructeur.
  //  - véhicules : km début→fin + toute dotation/achat carburant (dotation site, régie, carte).
  // Passe par le SERVICE pour que `fuelLiters` crée le plein lié (source 'dotation_site').
  {
    const spSvc = app.get(SitePointageService);
    const mk = (o: {
      vh: string; site: string; bu: string; ca: string; type: string; price: number;
      dom: number; frac: number; immo?: boolean;
      fuel?: number; km1?: number; km2?: number; h1?: number; h2?: number;
    }) => spSvc.create({
      siteCode: o.site, date: `${thisMonth}-${String(o.dom).padStart(2, '0')}`,
      targetType: o.type, targetCode: o.vh, unit: 'day',
      quantity: o.immo ? 1 : o.frac, fraction: o.immo ? 1 : o.frac, immobilized: !!o.immo,
      businessUnit: o.bu, ca: o.ca, dayPrice: o.price, source: 'grid',
      fuelLiters: o.fuel ?? null, kmStart: o.km1 ?? null, kmEnd: o.km2 ?? null,
      hoursStart: o.h1 ?? null, hoursEnd: o.h2 ?? null,
    });

    // FL-055 (engin, Hassi Messaoud) : 48 h au compteur ; carburant depuis la cuve (680 L) → conforme.
    for (const [dom, frac, h1, h2] of [[2, 1, 1240, 1252], [3, 1, 1252, 1264], [4, 0.5, 1264, 1270], [5, 1, 1270, 1288]] as const) {
      await mk({ vh: 'FL-055', site: 'Hassi Messaoud', bu: 'OPS', ca: 'OPS-CHT', type: 'engin', price: ctPrice['FL-055'] ?? 11667, dom, frac, h1, h2 });
    }
    await mk({ vh: 'FL-055', site: 'Hassi Messaoud', bu: 'OPS', ca: 'OPS-CHT', type: 'engin', price: ctPrice['FL-055'] ?? 11667, dom: 8, frac: 1, immo: true });

    // FL-060 (engin, Hassi Messaoud) : 28 h au compteur ; carburant cuve (435 L) → sur-conso (anomalie).
    for (const [dom, frac, h1, h2] of [[1, 1, 6302, 6310], [2, 0.5, 6310, 6316], [3, 1, 6316, 6324], [4, 1, 6324, 6330]] as const) {
      await mk({ vh: 'FL-060', site: 'Hassi Messaoud', bu: 'OPS', ca: 'OPS-CHT', type: 'engin', price: ctPrice['FL-060'] ?? 9500, dom, frac, h1, h2 });
    }

    // FL-042 (véhicule léger, Oran Base) : pas de mission — km + dotation carburant du site au pointage.
    //   ≈ 760 km · 40 L de dotation → conso ≈ 5,3 L/100 (conforme, norme 5,5).
    for (const [dom, km1, km2, fuel] of [[1, 51000, 51120, 7], [4, 51120, 51240, 7], [6, 51240, 51360, 7], [8, 51360, 51470, 6], [11, 51470, 51600, 6], [13, 51600, 51760, 7]] as const) {
      await mk({ vh: 'FL-042', site: 'Oran Base', bu: 'LOG', ca: 'LOG-EXP', type: 'vehicule', price: ctPrice['FL-042'] ?? 2400, dom, frac: 1, km1, km2, fuel });
    }

    // FL-010 (véhicule léger, Alger Dépôt) : km au pointage ; carburant = pompe + régie (aucune dotation).
    //   ≈ 850 km ; 38 L pompe + 22 L régie = 60 L → sur-conso (anomalie, norme 5,8).
    for (const [dom, km1, km2] of [[2, 88000, 88110], [4, 88110, 88230], [7, 88230, 88350], [9, 88350, 88470], [11, 88470, 88600], [14, 88600, 88720], [16, 88720, 88850]] as const) {
      await mk({ vh: 'FL-010', site: 'Alger Dépôt', bu: 'LOG', ca: 'LOG-EXP', type: 'vehicule', price: ctPrice['FL-010'] ?? 3270, dom, frac: 1, km1, km2 });
    }
  }

  // Demandes de relevé km (status: pending) — véhicules avec carburant mais sans relevé fin de mois.
  // Exécuté APRÈS le pointage site pour que les véhicules déjà couverts (km/heures au pointage) ne soient pas réclamés.
  try {
    const fc = app.get(FuelControlService);
    const res = await fc.refreshMissingKmAlert();
    console.log(`Relevés km demandés (auto) : ${res.created} créés / début ${res.debutManquant} · fin ${res.finManquant} manquants`);
  } catch (e) {
    console.warn('refreshMissingKmAlert (seed) :', (e as Error).message);
  }

  const cards = await repo('FuelCard').save([
    { cardNumber: 'NAFTAL-4587', manager: 'K. Azzedine', vehicleCode: 'FL-001', monthlyCap: 40000, active: true, note: null },
    { cardNumber: 'NAFTAL-4588', manager: 'K. Azzedine', vehicleCode: 'FL-002', monthlyCap: 25000, active: true, note: 'Carte commercial (essence)' },
  ]);
  // Passages de carte du mois → créés via le service : chacun devient un plein « carte » dans
  // le registre unique. FL-002 : ~200 L d'essence sur septembre (exemple DG du contrôle réservoir).
  {
    const mvSvc = app.get(FuelCardMovementService);
    const mvs = [
      { cardId: (cards[0] as any).id, cardNumber: 'NAFTAL-4587', date: `${thisMonth}-03`, vehicleCode: 'FL-001', liters: 55, amount: 8140, station: 'Naftal Rouiba', km: 87600 },
      { cardId: (cards[0] as any).id, cardNumber: 'NAFTAL-4587', date: `${thisMonth}-14`, vehicleCode: 'FL-001', liters: 50, amount: 7400, station: 'Naftal Alger', km: 88250 },
      { cardId: (cards[1] as any).id, cardNumber: 'NAFTAL-4588', date: `${thisMonth}-05`, vehicleCode: 'FL-002', liters: 14, amount: 770, station: 'Naftal Chéraga', km: 96900, fuelType: 'ESSENCE', grade: 'SP' },
      { cardId: (cards[1] as any).id, cardNumber: 'NAFTAL-4588', date: `${thisMonth}-12`, vehicleCode: 'FL-002', liters: 12, amount: 660, station: 'Naftal Alger Centre', km: 97250, fuelType: 'ESSENCE', grade: 'SP' },
      { cardId: (cards[1] as any).id, cardNumber: 'NAFTAL-4588', date: `${thisMonth}-22`, vehicleCode: 'FL-002', liters: 10, amount: 580, station: 'Naftal Chéraga (Super)', km: 97600, fuelType: 'ESSENCE', grade: 'SUPER' },
    ];
    for (const m of mvs) await mvSvc.create(m).catch((e) => console.warn('card mv seed:', (e as Error).message));
  }

  await repo('CommercialReport').save([
    { vehicleCode: 'FL-002', month: prevMonth, kmStart: 43800, kmEnd: 45050, fuelLiters: 120, note: 'RAS', source: 'manual' },
  ]);

  await repo('Incident').save([
    { vehicleCode: 'FL-010', driverCode: 'EMP-115', date: `${prevMonth}-18`, type: 'Accident matériel', description: 'Choc arrière sur parking, feu cassé.', photos: [], status: 'envoye_assurance', statusHistory: [{ status: 'declare', at: `${prevMonth}-18`, note: 'Déclaration' }, { status: 'envoye_assurance', at: `${prevMonth}-19`, note: 'Envoi CAAR' }], insurerSentAt: `${prevMonth}-19`, estimatedCost: 65000, note: null },
    { vehicleCode: 'FL-025', driverCode: null, date: `${thisMonth}-02`, type: 'Bris de glace', description: 'Pare-brise fissuré (gravillon autoroute).', photos: [], status: 'declare', statusHistory: [{ status: 'declare', at: `${thisMonth}-02`, note: 'Déclaration' }], estimatedCost: 28000, note: null },
  ]);

  const CTRL_CATS = [
    { key: 'general', label: 'État général' },
    { key: 'mecanique', label: 'Mécanique (moteur, transmission, freinage)' },
    { key: 'suspension', label: 'Suspension' },
    { key: 'documents', label: 'Documents' },
    { key: 'feux', label: 'Feux et signalisation' },
    { key: 'pneumatique', label: 'Pneumatique' },
  ];
  await repo('ControlRequest').save([
    {
      vehicleCode: 'FL-001', driverCode: 'EMP-101', generatedAt: `${thisMonth}-01`, dueDate: `${thisMonth}-08`,
      reason: 'usage élevé, contrôle ancien', weight: 0.78, status: 'pending',
      categories: CTRL_CATS.map((c) => ({ ...c, etat: null, maintenance: false, comment: '' })),
    },
    {
      vehicleCode: 'FL-005', driverCode: null, generatedAt: `${prevMonth}-25`, dueDate: `${prevMonth}-30`,
      reason: 'post-accident, état passé critique', weight: 0.72, status: 'done', km: 45200, etat: 'moyen', score: 12,
      note: 'Freins à revoir, pneu AVD usé', respondedAt: `${prevMonth}-29`,
      categories: CTRL_CATS.map((c) => ({
        ...c,
        etat: c.key === 'mecanique' ? 'moyen' : c.key === 'pneumatique' ? 'mauvais' : 'bon',
        maintenance: c.key === 'pneumatique',
        comment: c.key === 'pneumatique' ? 'Pneu AVD à remplacer' : '',
      })),
    },
  ]);

  const drivers: any[] = await repo('Driver').find();
  await repo('AccessToken').save(
    drivers.map((dr, idx) => ({
      token: `drv-${String(dr.code).toLowerCase().replace(/[^a-z0-9]/g, '')}-demo${idx}`,
      kind: 'driver', subjectCode: dr.code, label: dr.name,
      expiresAt: '2027-12-31', active: true,
    })),
  );

  await repo('PecRequest').save([
    { ref: 'PEC-2026-0001', requesterName: 'M. Bensalem', phone: '0661 22 33 44', email: null, organisation: 'Amimer Énergie', structure: 'Équipe forage (6 pers.)', fromLoc: 'Alger', toLoc: 'Hassi Messaoud', dateAller: `${thisMonth}-12`, dateRetour: `${thisMonth}-20`, pax: 6, source: 'amimer_energie', status: 'nouvelle' },
    { ref: 'PEC-2026-0002', requesterName: 'Mme Haddad', phone: '0770 11 22 33', email: null, organisation: 'Direction RH', structure: 'Délégation officielle', fromLoc: 'Alger', toLoc: 'Boumerdès', dateAller: `${thisMonth}-08`, dateRetour: `${thisMonth}-08`, pax: 3, source: 'public', status: 'nouvelle' },
  ]);

  // ── Pneumatiques ─────────────────────────────────────────────────────────────
  // Entrée en stock = référence / dimensions / série / coût (SANS véhicule).
  // L'affectation à un véhicule se fait au montage (sortie de stock).
  const tireStock = [
    { reference: 'MICH-XZE2-315', brand: 'Michelin', dimensions: '315/80 R22.5', serialNumber: 'MI24A0451', purchaseCost: 78000 },
    { reference: 'MICH-XZE2-315', brand: 'Michelin', dimensions: '315/80 R22.5', serialNumber: 'MI24A0452', purchaseCost: 78000 },
    { reference: 'BRID-R150-295', brand: 'Bridgestone', dimensions: '295/80 R22.5', serialNumber: 'BS24C1180', purchaseCost: 71000 },
    { reference: 'GOOD-KMAX-315', brand: 'Goodyear', dimensions: '315/70 R22.5', serialNumber: 'GY24E0092', purchaseCost: 69000 },
    { reference: 'MICH-PRIM4-205', brand: 'Michelin', dimensions: '205/55 R16', serialNumber: 'MI24P7731', purchaseCost: 14500 },
    { reference: 'MICH-PRIM4-205', brand: 'Michelin', dimensions: '205/55 R16', serialNumber: 'MI24P7732', purchaseCost: 14500 },
  ];
  const mounted = [
    { reference: 'MICH-XZE2-315', brand: 'Michelin', dimensions: '315/80 R22.5', serialNumber: 'MI23A9001', purchaseCost: 76000, vh: 'FL-003', pos: 'AVG', km: 84000 },
    { reference: 'MICH-XZE2-315', brand: 'Michelin', dimensions: '315/80 R22.5', serialNumber: 'MI23A9002', purchaseCost: 76000, vh: 'FL-003', pos: 'AVD', km: 84000 },
    { reference: 'BRID-R150-295', brand: 'Bridgestone', dimensions: '295/80 R22.5', serialNumber: 'BS23C4410', purchaseCost: 70000, vh: 'FL-003', pos: 'ARG ext.', km: 84000 },
    { reference: 'GOOD-EFFIC-205', brand: 'Goodyear', dimensions: '205/55 R16', serialNumber: 'GY23P0155', purchaseCost: 13800, vh: 'FL-002', pos: 'AVG', km: 44000 },
    { reference: 'GOOD-EFFIC-205', brand: 'Goodyear', dimensions: '205/55 R16', serialNumber: 'GY23P0156', purchaseCost: 13800, vh: 'FL-002', pos: 'AVD', km: 44000 },
  ];
  const stockRows = await repo('Tire').save(tireStock.map((t) => ({ ...t, status: 'stock', purchaseDate: `${prevMonth}-05` })));
  for (const s of stockRows as any[]) {
    await repo('TireMovement').save({ tireId: s.id, type: 'achat', date: s.purchaseDate, note: 'Entrée en stock' });
  }
  const mDay = recentWeekday(2);
  const mountedRows = await repo('Tire').save(
    mounted.map((t) => ({
      reference: t.reference, brand: t.brand, dimensions: t.dimensions, serialNumber: t.serialNumber, purchaseCost: t.purchaseCost,
      status: 'monte', currentVehicle: t.vh, position: t.pos, mountKm: t.km, mountDate: mDay, purchaseDate: `${prevMonth}-01`,
    })),
  );
  for (let i = 0; i < (mountedRows as any[]).length; i++) {
    const r = (mountedRows as any[])[i];
    const m = mounted[i];
    await repo('TireMovement').save({ tireId: r.id, type: 'achat', date: `${prevMonth}-01`, note: 'Entrée en stock' });
    await repo('TireMovement').save({
      tireId: r.id, type: 'montage', toVehicle: m.vh, position: m.pos, km: m.km, date: mDay,
      signedBy: 'Atelier', holderValidated: m.vh === 'FL-002' ? true : false, // FL-003 : en attente validation détenteur
    });
  }

  const counts = await Promise.all(tables.map(async (t) => `${t}=${await repo(t).count()}`));
  console.log('Seed termine :', counts.join(', '));
  await app.close();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
