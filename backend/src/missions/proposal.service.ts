import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../drivers/drivers.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { Mission } from './missions.entity';
import { MaintenanceOrder } from '../maintenance-orders/maintenance-orders.entity';
import { VehicleAssignment } from '../vehicle-assignments/vehicle-assignments.entity';
import { AppConfigService } from '../app-config/app-config.service';

/** Statuts d'OT qui immobilisent le vehicule (en cours de reparation). */
const REPAIR_OT_STATUSES = ['ouvert', 'diagnostic', 'valide', 'en_lancement'];
/** Statuts vehicule qui interdisent une affectation en mission. */
const VEHICLE_BLOCKED = ['EN_PANNE', 'HORS_SERVICE', 'EN_ENTRETIEN', 'EN_MAINTENANCE'];
/** Statuts chauffeur indisponibles (recuperation, conge, indispo). */
const DRIVER_UNAVAILABLE = ['EN_REPOS', 'EN_CONGE', 'CONGE', 'INDISPONIBLE', 'ABSENT'];

export interface ProposalCriteria {
  vehicleType?: string;        // LEGER | LOURD | ENGIN
  requiredQual?: string;       // code qualification requis (vide = aucun)
  qualityCriteria?: string;    // delegation officielle, produits sensibles...
  durationDays?: number;       // duree estimee
  weights?: Partial<Record<'fat' | 'hrs' | 'qual' | 'km' | 'doc' | 'dedicated', number>>;
}

type WKey = 'fat' | 'hrs' | 'qual' | 'km' | 'doc' | 'dedicated';
const DEFAULT_W: Record<WKey, number> = { fat: 35, hrs: 20, qual: 20, km: 15, doc: 10, dedicated: 20 };

/**
 * Config « cœur du système » (retour DG) : les poids de l'algorithme de proposition
 * véhicule/chauffeur sont saisis dans Paramètres › Sélection automatique et stockés
 * sous la clé PROPOSAL_CONFIG. Ils s'appliquent AUSSI BIEN à la modale mission qu'à
 * l'onglet Planification. Un poids décoché → 0.
 */
interface ProposalConfig {
  weights?: Partial<Record<string, number>>;
  enabled?: Partial<Record<string, boolean>>;
}

@Injectable()
export class ProposalService {
  constructor(
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    @InjectRepository(MaintenanceOrder) private readonly ots: Repository<MaintenanceOrder>,
    @InjectRepository(VehicleAssignment) private readonly assignments: Repository<VehicleAssignment>,
    private readonly config: AppConfigService,
  ) {}

  /** Poids effectifs : défauts < config Paramètres (poids décoché → 0) < override explicite de l'appelant. */
  private async resolveWeights(override?: ProposalCriteria['weights']): Promise<Record<WKey, number>> {
    const cfg = ((await this.config.get('PROPOSAL_CONFIG')) ?? null) as ProposalConfig | null;
    const w: Record<WKey, number> = { ...DEFAULT_W };
    for (const k of Object.keys(DEFAULT_W) as WKey[]) {
      const cv = cfg?.weights?.[k];
      if (typeof cv === 'number' && Number.isFinite(cv)) {
        w[k] = cfg?.enabled && cfg.enabled[k] === false ? 0 : cv;
      }
      const ov = override?.[k];
      if (typeof ov === 'number' && Number.isFinite(ov)) w[k] = ov;
    }
    return w;
  }

  async propose(c: ProposalCriteria) {
    const w = await this.resolveWeights(c.weights);
    const totalW = Object.values(w).reduce((s, x) => s + x, 0) || 1;
    const allDrivers = await this.drivers.find();
    const allVehicles = await this.vehicles.find();
    const missions = await this.missions.find();
    const allOts = await this.ots.find();
    const allAssignments = await this.assignments.find();

    // Voitures de service : affectees en permanence a une personne, actives a ce jour (retour DG).
    const today = new Date().toISOString().slice(0, 10);
    const serviceCars = new Set(
      allAssignments
        .filter((a) => a.assigneeName && a.kind === 'permanent'
          && (!a.dateEnd || a.dateEnd >= today) && (!a.dateStart || a.dateStart <= today))
        .map((a) => a.vehicleCode),
    );

    // Vehicules en cours de reparation (OT curatif ouvert / en cours).
    const inRepair = new Set(
      allOts
        .filter((o) => REPAIR_OT_STATUSES.includes(o.status ?? '') && (o.type ?? '').toLowerCase().startsWith('curat'))
        .map((o) => o.vehicleCode),
    );

    // On ne propose JAMAIS un vehicule en panne / hors service / en reparation,
    // ni un chauffeur en recuperation / conge / indisponible.
    const vehicles = allVehicles.filter(
      (v) => !VEHICLE_BLOCKED.includes(v.status ?? '') && !inRepair.has(v.code) && !serviceCars.has(v.code),
    );
    const drivers = allDrivers.filter((d) => !DRIVER_UNAVAILABLE.includes(d.status ?? ''));

    const shortMission = (c.durationDays ?? 1) <= 1;
    const reqLic = c.vehicleType === 'LOURD' || c.vehicleType === 'ENGIN' ? ['C', 'C+E'] : ['B', 'C', 'C+E', 'D'];

    const driverScores = drivers
      .filter((d) => reqLic.includes(d.license ?? ''))
      .map((d) => {
        let sc = 100;
        const reasons: string[] = [];
        // fatigue
        if (w.fat) { sc -= (d.fatigue ?? 0) * (w.fat / totalW) * 100; }
        // heures travaillees + heures missions (equilibrage)
        const missionHours = missions
          .filter((m) => m.driverCode === d.code && ['EN_COURS', 'PLANIFIEE', 'TERMINEE'].includes(m.status ?? ''))
          .reduce((s, m) => {
            const h = m.dateStart && m.dateEnd
              ? Math.max(0, (new Date(`${m.dateEnd}T${m.timeEnd || '17:00'}`).getTime() - new Date(`${m.dateStart}T${m.timeStart || '07:00'}`).getTime()) / 3_600_000)
              : 8;
            return s + h;
          }, 0);
        const load = ((d.hoursWeek ?? 0) + missionHours) / (d.maxWeeklyHours ?? 48);
        if (w.hrs) sc -= Math.min(1, load) * (w.hrs / totalW) * 100;
        if ((d.hoursWeek ?? 0) >= (d.maxWeeklyHours ?? 48)) { sc -= 25; reasons.push('proche du plafond horaire'); }
        // qualifications
        if (c.requiredQual) {
          if ((d.quals ?? []).includes(c.requiredQual)) { sc += (w.qual / totalW) * 50; reasons.push(`qualifié ${c.requiredQual}`); }
          else { sc -= (w.qual / totalW) * 120; reasons.push(`NON qualifié ${c.requiredQual}`); }
        }
        // chauffeur dedie
        if (c.qualityCriteria && d.dedicatedTo) { sc += (w.dedicated / totalW) * 40; reasons.push(`dédié ${d.dedicatedTo}`); }
        // apte mission
        if (d.apteMission === false) {
          if (shortMission) { sc -= 40; reasons.push('non apte (mission courte tolérée en force majeure)'); }
          else { sc -= 200; reasons.push('non apte aux missions'); }
        }
        // permis expire
        if (w.doc && d.licenseExpiry && new Date(d.licenseExpiry) < new Date()) { sc -= (w.doc / totalW) * 100; reasons.push('permis expiré'); }
        return { code: d.code, name: d.name, license: d.license, fatigue: d.fatigue, hoursWeek: d.hoursWeek, missionHours: Math.round(missionHours), apte: d.apteMission !== false, score: Math.max(0, Math.min(100, Math.round(sc))), reasons };
      })
      .sort((a, b) => b.score - a.score);

    const vehicleScores = vehicles
      .filter((v) => !c.vehicleType || v.type === c.vehicleType)
      .filter((v) => v.status === 'DISPONIBLE')
      .map((v) => {
        let sc = 100;
        const reasons: string[] = [];
        if (w.km) sc -= ((v.km ?? 0) / 500_000) * (w.km / totalW) * 100;
        if (w.doc && (v.ctStatus === 'EXPIRE' || v.insStatus === 'EXPIRE')) { sc -= (w.doc / totalW) * 120; reasons.push('document expiré'); }
        if (v.ownership === 'PROPRE') sc += 3;
        return { code: v.code, label: `${v.brand ?? ''} ${v.model ?? ''}`.trim(), km: v.km, type: v.type, score: Math.max(0, Math.min(100, Math.round(sc))), reasons };
      })
      .sort((a, b) => b.score - a.score);

    return { drivers: driverScores, vehicles: vehicleScores };
  }
}
