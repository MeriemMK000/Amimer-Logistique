// Types metier — miroir des entites backend (portage demo-fleetpro-v8).

export interface Equipment { nom: string; qty: number; etat: 'BON' | 'USURE' | 'HS'; notes?: string; expiry?: string | null }

export interface Vehicle {
  code: string;
  brand: string; model: string; type: 'LEGER' | 'LOURD' | 'ENGIN' | 'REMORQUE' | (string & {});
  plate: string | null;
  status: 'DISPONIBLE' | 'EN_MISSION' | 'EN_MAINTENANCE' | 'EN_PANNE' | 'HORS_SERVICE';
  fuel: string | null;
  ownership: 'PROPRE' | 'LOCATION' | 'LEASING' | (string & {});
  km: number | null; tankLiters: number | null;
  leaseStart: string | null; leaseEnd: string | null; leaseAlertDays: number | null; leaseCost: number | null;
  /** Coût de possession d'un véhicule PROPRE (refacturation) — quotidien 8h prioritaire, sinon mensuel. */
  ownedDailyCost?: number | null;
  ownedMonthlyCost?: number | null;
  normOff: number | null; normCorr: number | null; normOffH: number | null; normCorrH: number | null; normCorrectionPct?: number | null;
  ctDate: string | null; ctStatus: string | null; ctExpiry?: string | null;
  insDate: string | null; insPolicy: string | null; insStatus: string | null;
  greyCard: string | null; vignette: string | null;
  driverCode: string | null;
  breakdownHours: number | null; hourMeter: number | null; hourlyCost: number | null;
  equipment: Equipment[] | null;
  isCommercial?: boolean | null;
  margePct?: number | null;
  // Champs issus des registres réels Amimer Énergie.
  genre?: 'VIP' | 'CTTE' | 'CAM' | 'TR' | 'ENGIN' | 'REMORQUE' | (string & {}) | null;
  lessor?: string | null;
  serviceYear?: number | null;
  fiscalPower?: number | null;
  chassis?: string | null;
  siteBase?: string | null;
  seats?: number | null;
  tireCount?: number | null;
  maxTonnage?: number | null;
  breakdownStatus?: 'non_pris_en_charge' | 'pris_en_charge' | 'en_reparation' | null;
  repairEta?: string | null;
}

export interface DriverPlanDay { t: string; h1: string; h2: string }
export interface Driver {
  code: string; name: string; license: string; licenseExpiry: string | null;
  quals: string[] | null;
  status: 'DISPONIBLE' | 'EN_MISSION' | 'EN_REPOS' | 'EN_CONGE' | 'INDISPONIBLE';
  hoursWeek: number | null; hoursMonth: number | null; fatigue: number | null;
  vehicleCode: string | null; permanent: boolean | null; phone: string | null;
  hourlyCost: number | null; dailyCost?: number | null; plan: DriverPlanDay[] | null;
  address?: string | null; workDistanceKm?: number | null; scaleUpScore?: number | null;
  apteMission?: boolean | null; dedicatedTo?: string | null; dedicatedCa?: string | null; workLocation?: string | null;
  maxWeeklyHours?: number | null;
  /** 'chauffeur' (conduit en mission) | 'utilisateur' (voiture de service, ne part pas en mission). */
  personType?: 'chauffeur' | 'utilisateur' | null;
}

/** Affectation d'un véhicule à une personne (voiture de service) ou à un site / chantier. */
export interface VehicleAssignment {
  id: string;
  vehicleCode: string | null;
  driverCode: string | null;
  withDriver: boolean | null;
  controlType?: 'mission' | 'km_difference' | 'hours' | null;
  kind: 'permanent' | 'periode' | null;
  dateStart: string | null;
  dateEnd: string | null;
  siteCode: string | null;
  businessUnit: string | null;
  costCenter: string | null;
  /** Retour DG : nature du centre analytique — 'site' pilote la proposition carburant du chantier. */
  costCenterKind?: 'site' | 'person' | 'bu' | null;
  purpose?: string | null;
  verifyToken?: string | null;
  ordreEmisAt?: string | null;
  vehicleMonthlyCost: number | null;
  assigneeName: string | null;
  structure: string | null;
  dailyHomeKm: number | null;
  fuelCardNumber: string | null;
  monthlyFuelCap: number | null;
  note: string | null;
  createdAt?: string | null;
}

export interface Mission {
  num: string; driverCode: string | null; vehicleCode: string | null;
  fromLoc: string; toLoc: string;
  status: 'PLANIFIEE' | 'EN_COURS' | 'TERMINEE' | 'CLOTUREE' | 'ANNULEE';
  dateStart: string | null; timeStart: string | null; dateEnd: string | null; timeEnd: string | null;
  distance: number | null; zone: string | null; cost: number | null;
  waypoints: string[] | null; closed: boolean | null;
  bu: string | null; ca: string | null; site?: string | null;
  frais: number | null; fraisConfirmed: boolean | null; fraisDateConfirm: string | null;
  fraisDetail: unknown[] | null; fraisCat: string | null; fraisZone: string | null;
  autoClotured: boolean | null; retType: string | null; waypointsRet: string[] | null;
  dAller?: number | null; dRetour?: number | null;
  requiredQual?: string | null; qualityCriteria?: string | null;
  fraisApplicable?: boolean | null; verifyToken?: string | null;
  startedAt?: string | null; finishedAt?: string | null;
  driverAccepted?: boolean | null; driverAcceptedAt?: string | null; pecRef?: string | null;
  officeValidated?: boolean | null; officeValidatedAt?: string | null;
  comment?: string | null; dpcRef?: string | null; clotureSuggested?: boolean | null;
  dpcRefs?: string[] | null;
  costSplit?: Array<{ dpcCode: string; bu: string | null; structure: string | null; pax: number; segmentKm: number; roundTrip: boolean; sharePct: number }> | null;
  pax?: number | null;
  tonnage?: number | null;
  ordreEmisAt?: string | null;
  routeGeo?: {
    from?: { name?: string; lat: number; lon: number } | null;
    to?: { name?: string; lat: number; lon: number } | null;
    source?: string;
  } | null;
}

export interface MaintenanceOperation { desc: string; duree: string; tech: string; statut: string }
export interface MaintenanceOrder {
  num: string; vehicleCode: string | null; type: string; title: string | null;
  priority: string | null; status: string | null;
  partsCost: number | null; laborCost: number | null; totalCost: number | null;
  date: string | null; supplierCode: string | null; operations: MaintenanceOperation[] | null;
  statusHistory?: { status: string; at: string; note?: string }[] | null;
  leaseRepairStatus?: string | null;
  sourceDeclarationId?: string | null;
  planId?: string | null;
  cmd?: string | null;
  breakdownHours?: number | null;
}

export interface Supplier { code: string; name: string; contact: string | null; phone: string | null; email: string | null; city: string | null }

export interface PurchaseOrderItem { desc: string; qty: number; pu: number; total: number }
export interface PurchaseOrder { num: string; otNum: string | null; supplierCode: string | null; date: string | null; amount: number | null; status: string | null; items: PurchaseOrderItem[] | null }

export interface FuelEntry {
  id: string; date: string; vehicleCode: string; driverCode: string | null; fuelType: string; grade?: string | null;
  qty: number; unitPrice: number; kmEnd: number | null; kmStart: number | null;
  tankBalance: number | null; norm: number | null; closed: boolean | null; kmCorr: number | null;
  cardNumber?: string | null; amount?: number | null; source?: string | null;
}
export interface EngineFuelEntry {
  id: string; date: string; vehicleCode: string; operator: string | null; fuelType: string;
  qty: number; unitPrice: number; hourEnd: number | null; hourStart: number | null; normH: number | null; closed: boolean | null;
}

export interface DpcRequest {
  code: string; dateSaisie: string | null; dateAller: string | null; dateRetour: string | null;
  depAller: string | null; destAller: string | null; depRetour: string | null; destRetour: string | null;
  bu: string | null; structure: string | null; priorite: string | null; urgence: string | null;
  statut: string; notes: string | null; demandeur: string | null; missionRef: string | null;
  source?: string | null; demandeurTel?: string | null; demandeurEmail?: string | null;
  organisation?: string | null; pax?: number | null; tonnage?: number | null; refExterne?: string | null; distanceKm?: number | null;
}

export interface LeaseContract { id: string; vehicleCode: string; num: string; dailyPrice: number; immobilizationPrice?: number | null; startDate: string; endDate: string; notes: string | null }
export interface LeasePointage { id: string; vehicleCode: string; date: string; fraction: number | null; immobilized?: boolean | null; present: boolean; notes: string | null }

export interface Alert { id: string; type: string | null; title: string; description: string | null; timeLabel: string | null; category: string | null; priority: string }

export interface CostCenter { code: string; nom: string }
export interface BusinessUnitManager { name?: string; email?: string }
export interface BusinessUnit { code: string; name: string; ca: CostCenter[] | null; manager?: BusinessUnitManager | null }

export interface PreventiveProgram { id: number; name: string; interval: string | null; travaux: string[] | null; cost: number | null; vehicules: string[] | null }

export interface FuelPrices { GASOIL: number; ESSENCE: number; GPL: number; SP?: number; SUPER?: number }
export interface Params { reposMin: number; vitMoy: number; locAlertDef: number; dailyAllowedKm?: number; joursOuvresMois?: number }
export interface EvalCriterion { key: string; label: string; weight: number }
export interface EvalConfig { scale: number; criteria: EvalCriterion[] }
export type MargeType = Record<string, number>;

// Retour DG : « le cœur de fonctionnement de notre système » — les poids de l'algorithme
// qui propose véhicule + chauffeur des missions. Configuré dans Paramètres, appliqué
// partout (modale mission + onglet Planification). Poids décoché → compte pour 0.
export interface ProposalConfig {
  weights: Record<string, number>;
  enabled: Record<string, boolean>;
}
