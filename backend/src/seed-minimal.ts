/**
 * Seed MINIMAL FleetPro (retour DG — 2026-09-04, maj 2026-09-05 : test contrôle engins).
 * « Vide la base, laisse un seul cas partout pour tester le projet de A à Z. »
 *
 *   6 véhicules  : 2 légers · 2 lourds · 2 engins   (tous DISPONIBLE, base propre)
 *   5 personnes  : 2 chauffeurs légers · 2 chauffeurs lourds · 1 directeur
 *   2 demandes PEC internes « à valider »  +  1 demande publique
 *   Carburant, missions, OT, incidents, pneus, pointages, alertes  →  VIDE
 *   Référentiels conservés : paramètres, business units, qualifications, modèles d'entretien
 *
 *   Prêt pour un CONTRÔLE ENGINS individuel (retour DG) :
 *     - FL-055 (JCB) + FL-060 (CAT) affectés au chantier « Hassi Messaoud », contrôle PAR HEURES
 *     - normes L/h cohérentes (normCorrH = normOffH × 1 + %correction)
 *     - cuve chantier « Hassi Messaoud » : stock de départ saisi (2000 L), aucun mouvement
 *     → le DG saisit lui-même : pleins engin / sorties cuve + relevés heures & réservoir début/fin de mois
 *
 *   cd backend && npm run seed:minimal
 */
import 'reflect-metadata';
import { randomBytes } from 'crypto';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';
import { SchedulerService } from './scheduler/scheduler.service';
import * as seedData from './seed-data.json';

async function seedMinimal() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const ds = app.get(DataSource);
  const d = seedData as any;
  const repo = (name: string) => ds.getRepository(name);

  const todayISO = new Date().toISOString().slice(0, 10);
  const dPlus = (nb: number) => new Date(Date.now() + nb * 86_400_000).toISOString().slice(0, 10);
  const rnd = () => randomBytes(9).toString('hex');

  // ── 1. On vide TOUT (mêmes tables que le seed complet, `places` non touchée) ──
  const tables = [
    'Vehicle', 'Driver', 'Mission', 'MaintenanceOrder', 'Supplier', 'PurchaseOrder',
    'FuelEntry', 'EngineFuelEntry', 'DpcRequest', 'LeaseContract', 'LeasePointage',
    'Alert', 'BusinessUnit', 'MaintenancePlan', 'VehicleMaintenancePlan', 'Qualification', 'AppConfigEntry',
    'VehicleAssignment', 'ExternalVehicle', 'ExternalInvoice', 'SitePointage', 'FuelCard', 'FuelCardMovement', 'CommercialReport',
    'Incident', 'ControlRequest', 'AccessToken', 'PecRequest', 'Tire', 'TireMovement',
    'FuelStockOp', 'MonthlyKmReading', 'RegiePurchase', 'Notification',
    'Evaluation', 'KmReading', 'MaintenanceFlag', 'Attachment',
  ];
  for (const t of tables) {
    try { await repo(t).query(`TRUNCATE TABLE "${repo(t).metadata.tableName}" RESTART IDENTITY CASCADE`); } catch { /* table absente : on ignore */ }
  }

  // ── 2. Référentiels (indispensables au fonctionnement des écrans) ──
  await repo('AppConfigEntry').save([
    { key: 'FUEL_PRICES', value: d.FUEL_PRICES },
    { key: 'PARAMS', value: { ...d.PARAMS, dailyAllowedKm: 3, kmHorsMissionSeuil: 500, joursOuvresMois: 22 } },
    { key: 'BAREME_MISSION', value: d.BAREME_MISSION },
    { key: 'MARGE_TYPE', value: d.MARGE_TYPE },
    { key: 'MARGE_PCT', value: d.MARGE_PCT },
    { key: 'FRAIS_RULES', value: { defaultRadiusKm: 50, byLocation: { Alger: 50, Oran: 60, 'Hassi Messaoud': 100 } } },
    // Retour DG : listes Flotte modifiables (Type / Genre / Carburant / Propriété).
    {
      key: 'VEHICLE_LISTS',
      value: {
        type: ['LEGER', 'LOURD', 'ENGIN', 'REMORQUE'],
        genre: ['VIP', 'CTTE', 'CAM', 'TR', 'ENGIN', 'REMORQUE'],
        fuel: ['GASOIL', 'ESSENCE', 'GPL'],
        ownership: ['PROPRE', 'LEASING', 'LOCATION'],
      },
    },
    // Retour DG : poids de l'algo de proposition véhicule + chauffeur (modale mission + planification).
    {
      key: 'PROPOSAL_CONFIG',
      value: {
        weights: { fat: 35, hrs: 20, qual: 20, dedicated: 20, doc: 10, km: 15, conso: 10 },
        enabled: { fat: true, hrs: true, qual: true, dedicated: true, doc: true, km: true, conso: false },
      },
    },
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

  await repo('BusinessUnit').save(d.BU_CA.map((b: any) => ({ code: b.code, name: b.nom, ca: b.ca ?? [], manager: b.manager ?? null })));

  await repo('Qualification').save([
    { code: 'ADR', label: 'ADR — matières dangereuses', description: 'Transport de matières dangereuses (route)', sensitive: true },
    { code: 'Frigo', label: 'Frigorifique', description: 'Conduite de véhicule frigorifique', sensitive: false },
    { code: 'Citerne', label: 'Citerne', description: 'Transport en citerne', sensitive: true },
    { code: 'Transport Personnes', label: 'Transport de personnes', description: 'Transport de personnel / délégations', sensitive: true },
  ]);

  // ── 3. Fournisseurs (nécessaires pour créer un OT / bon d'achat) ──
  await repo('Supplier').save([
    { code: 'FRN-001', name: 'Falcon Motors (agent Fiat / Iveco)', contact: 'M. Larbi', phone: '021 55 10 10', email: null, city: 'Alger' },
    { code: 'FRN-002', name: 'AS Trucks — poids lourd', contact: 'M. Sahnoun', phone: '036 84 22 33', email: null, city: 'Sétif' },
  ]);

  // ── 4. LES 6 VÉHICULES (2 légers · 2 lourds · 2 engins) — tous DISPONIBLE ──
  const V = (o: Record<string, unknown>) => ({
    plate: null, km: 120000, tankLiters: 60, ctStatus: 'VALIDE', insStatus: 'VALIDE',
    breakdownHours: 0, equipment: [], isCommercial: false, margePct: null,
    status: 'DISPONIBLE', ...o,
  });
  // norme corrigée = norme constructeur × (1 + % correction), % par défaut = 5 (retour DG G2).
  const r2 = (n: number) => Math.round(n * 100) / 100;
  await repo('Vehicle').save([
    // Légers
    V({ code: 'FL-025', brand: 'Audi', model: 'A6 2.0 TDI', type: 'LEGER', fuel: 'GASOIL', ownership: 'LEASING',
        km: 88000, tankLiters: 65, normOff: 5.6, normCorr: r2(5.6 * 1.05), normCorrectionPct: 5, driverCode: null, fiscalPower: 11, seats: 5,
        genre: 'Voiture particulière', isCommercial: false, ownedDailyCost: 3000, ownedMonthlyCost: 65000, hourlyCost: 369,
        ctDate: dPlus(-245), ctExpiry: dPlus(120), insDate: dPlus(200), plate: '00125-116-16' }),
    V({ code: 'FL-010', brand: 'Fiat', model: 'Doblo Cargo 1.6 MJT', type: 'LEGER', fuel: 'GASOIL', ownership: 'LOCATION',
        km: 61000, tankLiters: 60, normOff: 5.5, normCorr: r2(5.5 * 1.05), normCorrectionPct: 5, driverCode: 'EMP-115', fiscalPower: 7, seats: 2,
        genre: 'Fourgonnette', lessor: 'EURL SAADNA',
        ctDate: dPlus(-100), ctExpiry: dPlus(80), insDate: dPlus(20),
        leaseStart: '2025-04-01', leaseEnd: '2027-03-31', leaseAlertDays: 30, leaseCost: 2833, plate: '00110-116-16' }),
    // Lourds
    V({ code: 'FL-001', brand: 'Hino', model: '300 815 (benne 3.5T)', type: 'LOURD', fuel: 'GASOIL', ownership: 'PROPRE',
        km: 141000, tankLiters: 100, normOff: 8.5, normCorr: r2(8.5 * 1.05), normCorrectionPct: 5, driverCode: 'EMP-102', maxTonnage: 3.5,
        ownedDailyCost: 4300, ownedMonthlyCost: 95000, hourlyCost: 540,
        genre: 'Camion benne', ctDate: dPlus(-140), ctExpiry: dPlus(40), insDate: dPlus(150), plate: '00101-116-16' }),
    V({ code: 'FL-003', brand: 'MAN', model: 'TGS 33.400 6x4', type: 'LOURD', fuel: 'GASOIL', ownership: 'PROPRE',
        km: 312000, tankLiters: 300, normOff: 28, normCorr: r2(28 * 1.05), normCorrectionPct: 5, driverCode: 'EMP-101', maxTonnage: 33,
        ownedDailyCost: 8200, ownedMonthlyCost: 180000, hourlyCost: 1023,
        genre: 'Tracteur routier', ctDate: dPlus(-275), ctExpiry: dPlus(90), insDate: dPlus(180), plate: '00103-116-16' }),
    // Engins — contrôle PAR HEURES (retour DG). norme L/h : normCorrH = normOffH × (1 + %).
    V({ code: 'FL-055', brand: 'JCB', model: '3CX (rétrochargeur)', type: 'ENGIN', fuel: 'GASOIL', ownership: 'LOCATION',
        km: 0, tankLiters: 130, normOffH: 12.5, normCorrH: r2(12.5 * 1.05), normCorrectionPct: 5, hourMeter: 1240, hourlyCost: 15000, driverCode: null,
        genre: 'Engin de chantier', lessor: 'ALGERIA LOC ENGINS', siteBase: 'Hassi Messaoud',
        leaseStart: '2025-11-01', leaseEnd: '2026-10-10', leaseAlertDays: 30, leaseCost: 11667, plate: 'ENGIN-055' }),
    V({ code: 'FL-060', brand: 'Caterpillar', model: '428F2 (rétrochargeur)', type: 'ENGIN', fuel: 'GASOIL', ownership: 'LOCATION',
        km: 0, tankLiters: 160, normOffH: 11, normCorrH: r2(11 * 1.05), normCorrectionPct: 5, hourMeter: 6300, hourlyCost: 18000, driverCode: null,
        genre: 'Engin de chantier', lessor: 'ALGERIA LOC ENGINS', siteBase: 'Hassi Messaoud',
        leaseStart: '2025-07-01', leaseEnd: '2027-06-30', leaseAlertDays: 30, leaseCost: 14000, plate: 'ENGIN-060' }),
  ]);

  // ── 5. LES 5 PERSONNES (2 chauffeurs légers · 2 chauffeurs lourds · 1 directeur) ──
  const weekPlan = (t: string) => Array.from({ length: 7 }, (_, i) => (
    i === 5 || i === 6 ? { t: 'REP', h1: '', h2: '' } : { t, h1: '07:00', h2: '17:00' }
  ));
  await repo('Driver').save([
    // Chauffeurs légers
    { code: 'EMP-105', name: 'Slimani Karim', license: 'B', licenseExpiry: dPlus(400), quals: [], status: 'DISPONIBLE',
      hoursWeek: 0, hoursMonth: 0, fatigue: 0.2, vehicleCode: 'FL-025', permanent: false, phone: '0550 11 22 33',
      hourlyCost: 900, dailyCost: 7000, plan: weekPlan('DIS'), apteMission: true, workLocation: 'Alger', maxWeeklyHours: 48,
      address: 'Kouba, Alger', workDistanceKm: 9 },
    { code: 'EMP-115', name: 'Khelifi Amine', license: 'B', licenseExpiry: dPlus(500), quals: [], status: 'DISPONIBLE',
      hoursWeek: 0, hoursMonth: 0, fatigue: 0.15, vehicleCode: 'FL-010', permanent: false, phone: '0661 44 55 66',
      hourlyCost: 900, dailyCost: 7000, plan: weekPlan('DIS'), apteMission: true, workLocation: 'Alger', maxWeeklyHours: 48,
      address: 'Bab Ezzouar, Alger', workDistanceKm: 12 },
    // Chauffeurs lourds
    { code: 'EMP-101', name: 'Benmoussa Youcef', license: 'C+E', licenseExpiry: dPlus(45), quals: ['ADR', 'Frigo'],
      status: 'DISPONIBLE', hoursWeek: 0, hoursMonth: 0, fatigue: 0.25, vehicleCode: 'FL-003', permanent: true,
      phone: '0555 12 34 56', hourlyCost: 1200, dailyCost: 9200, plan: weekPlan('DIS'), apteMission: true, workLocation: 'Alger',
      maxWeeklyHours: 48, address: 'Cité 200 logements, Bab Ezzouar', workDistanceKm: 12 },
    { code: 'EMP-102', name: 'Hadj Ali Rachid', license: 'C+E', licenseExpiry: dPlus(450), quals: ['ADR'],
      status: 'DISPONIBLE', hoursWeek: 0, hoursMonth: 0, fatigue: 0.3, vehicleCode: 'FL-001', permanent: true,
      phone: '0770 98 76 54', hourlyCost: 1200, dailyCost: 9200, plan: weekPlan('DIS'), apteMission: true, workLocation: 'Alger',
      maxWeeklyHours: 48, address: 'Bir Mourad Raïs, Alger', workDistanceKm: 8 },
    // Directeur (utilisateur — voiture de service FL-025, ne part pas en mission)
    { code: 'EMP-200', name: 'Kamal Azouaou — Directeur Général', license: 'B', licenseExpiry: dPlus(600),
      quals: [], status: 'DISPONIBLE', hoursWeek: 0, hoursMonth: 0, fatigue: 0, vehicleCode: null, permanent: true,
      phone: '0550 00 00 00', hourlyCost: null, plan: [], apteMission: false, personType: 'utilisateur', workLocation: 'Alger',
      dedicatedTo: 'ADM', dedicatedCa: 'ADM-DG', maxWeeklyHours: null,
      address: 'Hydra, Alger', workDistanceKm: 6 },
  ]);

  // ── 6. Affectations ──
  //   · FL-025 : voiture de service du directeur (contrôle par différence km)
  //   · FL-055 / FL-060 : engins affectés au chantier Hassi Messaoud (contrôle PAR HEURES)
  await repo('VehicleAssignment').save([
    { vehicleCode: 'FL-025', driverCode: null, withDriver: false, kind: 'permanent',
      dateStart: dPlus(-30), dateEnd: null, businessUnit: 'LOG', costCenter: null,
      structure: 'Direction Générale', assigneeName: 'Kamal Azouaou — Directeur Général',
      controlType: 'km_difference', costCenterKind: 'person',
      dailyHomeKm: 12, fuelCardNumber: null, monthlyFuelCap: 20000, vehicleMonthlyCost: 65000,
      verifyToken: rnd(), note: 'Voiture de fonction — Directeur Général' },
    { vehicleCode: 'FL-055', driverCode: null, withDriver: false, kind: 'permanent',
      dateStart: dPlus(-60), dateEnd: null, siteCode: 'Hassi Messaoud', businessUnit: 'UOP', costCenter: 'UOP-CHT',
      controlType: 'hours', costCenterKind: 'site', vehicleMonthlyCost: 350000,
      purpose: 'Mise à disposition chantier', verifyToken: rnd(),
      note: 'JCB 3CX — rétrochargeur dédié chantier Hassi Messaoud' },
    { vehicleCode: 'FL-060', driverCode: null, withDriver: false, kind: 'permanent',
      dateStart: dPlus(-60), dateEnd: null, siteCode: 'Hassi Messaoud', businessUnit: 'UOP', costCenter: 'UOP-CHT',
      controlType: 'hours', costCenterKind: 'site', vehicleMonthlyCost: 420000,
      purpose: 'Mise à disposition chantier', verifyToken: rnd(),
      note: 'CAT 428F2 — rétrochargeur dédié chantier Hassi Messaoud' },
  ]);

  // ── 6b. Cuve carburant du chantier « Hassi Messaoud » : stock de départ uniquement.
  //        (le DG saisit ensuite les approvisionnements et les sorties vers les engins.)
  const gasoilPx = Number(d.FUEL_PRICES?.GASOIL) || 30;
  await repo('FuelStockOp').save([
    { siteCode: 'Hassi Messaoud', opType: 'initial', date: dPlus(-30), fuelType: 'GASOIL',
      liters: 2000, amount: Math.round(2000 * gasoilPx), supplier: 'Stock de départ (inventaire cuve chantier)',
      note: 'Stock initial de la cuve — point de départ de l’inventaire' },
  ]);

  // ── 6c. Véhicule / engin EXTERNE sur le chantier (retour DG : contrôle facture fournisseur).
  await repo('ExternalVehicle').save([
    { label: 'Rétrochargeur sous-traitant TP', plate: '00456-116-31', owner: 'SARL Transbat',
      contact: '0550 11 22 33', siteCode: 'Hassi Messaoud', fuelType: 'GASOIL', kind: 'ENGIN',
      supplier: 'SARL Transbat', unitRate: 22000, rateUnit: 'day', active: true,
      note: 'Loué au fournisseur — on pointe et on contrôle sa facture' },
  ]);

  // ── 7. Contrats de location (véhicules loués) ──
  await repo('LeaseContract').save([
    { id: 'LC-001', vehicleCode: 'FL-010', num: 'CTR-2025-010', dailyPrice: 2833, immobilizationPrice: 1417, startDate: '2025-04-01', endDate: '2027-03-31', notes: 'Fiat Doblo — EURL SAADNA' },
    { id: 'LC-003', vehicleCode: 'FL-055', num: 'CTR-2025-055', dailyPrice: 11667, immobilizationPrice: 5834, startDate: '2025-11-01', endDate: '2026-10-10', notes: 'JCB 3CX — chantier Hassi Messaoud' },
    { id: 'LC-004', vehicleCode: 'FL-060', num: 'CTR-2025-060', dailyPrice: 14000, immobilizationPrice: 7000, startDate: '2025-07-01', endDate: '2027-06-30', notes: 'CAT 428F2 — chantier Hassi Messaoud' },
  ]);

  // ── 8. Modèles d'entretien préventif (référence, ciblés sur les 6 véhicules gardés) ──
  const KEEP = ['FL-025', 'FL-010', 'FL-001', 'FL-003', 'FL-055', 'FL-060'];
  await repo('MaintenancePlan').save([
    { name: 'Vidange moteur', targetKind: 'vehicles', targetVehicles: ['FL-001', 'FL-003'], trigger: 'KM', intervalValue: 10000,
      operations: [{ label: 'Vidange + filtre huile', coutEstime: 18000 }, { label: 'Filtre à air', coutEstime: 6000 }],
      alertThresholdPct: 90, active: true },
    { name: 'Révision freins', targetKind: 'vehicles', targetVehicles: ['FL-001', 'FL-003', 'FL-025', 'FL-010'], trigger: 'KM', intervalValue: 30000,
      operations: [{ label: 'Contrôle + remplacement plaquettes', coutEstime: 22000 }],
      alertThresholdPct: 90, active: true },
    { name: 'Révision engin (heures)', targetKind: 'vehicles', targetVehicles: ['FL-055', 'FL-060'], trigger: 'HOURS', intervalValue: 500,
      operations: [{ label: 'Vidange hydraulique + graissage', coutEstime: 45000 }],
      alertThresholdPct: 90, active: true },
  ].filter((p) => p.targetVehicles.every((v) => KEEP.includes(v)) || p.targetVehicles.some((v) => KEEP.includes(v))));

  // ── 9. Demandes PEC « à valider » (2 internes + 1 publique) ──
  await repo('DpcRequest').save([
    { code: `DPC-${new Date().getFullYear()}-0001`, source: 'interne', statut: 'EN_ATTENTE',
      dateSaisie: todayISO, dateAller: dPlus(5), dateRetour: dPlus(6),
      depAller: 'Alger', destAller: 'Béjaïa', depRetour: 'Béjaïa', destRetour: 'Alger',
      bu: 'LOG', structure: 'Livraison matériel (2 palettes)', priorite: 'HAUTE', urgence: 'NORMALE',
      demandeur: 'Service Logistique', demandeurTel: '0550 10 20 30', tonnage: 0.9, distanceKm: 260,
      notes: 'À valider — affecter un camion léger' },
    { code: `DPC-${new Date().getFullYear()}-0002`, source: 'interne', statut: 'EN_ATTENTE',
      dateSaisie: todayISO, dateAller: dPlus(7), dateRetour: dPlus(9),
      depAller: 'Alger', destAller: 'Hassi Messaoud', depRetour: 'Hassi Messaoud', destRetour: 'Alger',
      bu: 'UOP', structure: 'Transfert équipe chantier (5 pers.)', priorite: 'HAUTE', urgence: 'NORMALE',
      demandeur: 'Kamal Azouaou — Direction Générale', demandeurTel: '0550 00 00 00', demandeurEmail: 'kamalazouaou@amimer.com', pax: 5, distanceKm: 850,
      notes: 'À valider — transport de personnel' },
    { code: `DPC-${new Date().getFullYear()}-0003`, source: 'formulaire', statut: 'EN_ATTENTE',
      dateSaisie: todayISO, dateAller: dPlus(10), dateRetour: dPlus(12),
      depAller: 'Alger', destAller: 'Constantine', depRetour: 'Constantine', destRetour: 'Alger',
      structure: 'Délégation partenaire (3 pers.)', priorite: 'NORMALE', urgence: 'NORMALE',
      demandeur: 'Sonatrach — R. Belkacem', demandeurTel: '0661 22 33 44', demandeurEmail: 'r.belkacem@example.dz',
      organisation: 'Sonatrach', pax: 3, distanceKm: 430,
      notes: 'Reçue via le formulaire public — à valider' },
  ]);

  // ── 10. Une demande de prise en charge externe (file PEC publique) ──
  await repo('PecRequest').save([
    { ref: `PEC-${new Date().getFullYear()}-0001`, requesterName: 'Mme Haddad', phone: '0770 11 22 33', email: null,
      organisation: 'Direction RH', structure: 'Délégation officielle (3 pers.)', fromLoc: 'Alger', toLoc: 'Boumerdès',
      dateAller: dPlus(4), dateRetour: dPlus(4), pax: 3, source: 'public', status: 'nouvelle' },
  ]);

  // ── 11. Liens magiques (app chauffeur) pour les 5 personnes ──
  const people = await repo('Driver').find();
  await repo('AccessToken').save(
    people.map((p: any) => ({
      token: `drv-${String(p.code).toLowerCase().replace(/[^a-z0-9]/g, '')}`,
      kind: 'driver', subjectCode: p.code, label: p.name, expiresAt: '2027-12-31', active: true,
    })),
  );

  // ── 12. Alertes automatiques (échéances CT / assurance / location / équilibre flotte) ──
  try {
    const sch = app.get(SchedulerService);
    await sch.refreshAll();
  } catch (e) { console.warn('refreshAll (seed) :', (e as Error).message); }

  const counts = await Promise.all(tables.map(async (t) => {
    try { return `${t}=${await repo(t).count()}`; } catch { return `${t}=n/a`; }
  }));
  console.log('Seed MINIMAL terminé :');
  console.log('  ' + counts.filter((c) => !c.endsWith('=0') && !c.endsWith('=n/a')).join(' · '));
  console.log('  Liens chauffeur : drv-emp101 / drv-emp102 / drv-emp105 / drv-emp115 / drv-emp200 (directeur)');
  await app.close();
}

seedMinimal().catch((e) => { console.error(e); process.exit(1); });
