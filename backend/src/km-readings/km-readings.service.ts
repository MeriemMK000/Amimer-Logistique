import { Injectable, NotFoundException } from '@nestjs/common';
import { requireFields } from '../common/require-fields';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KmReading } from './km-readings.entity';
import { Mission } from '../missions/missions.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { Driver } from '../drivers/drivers.entity';
import { AppConfigService } from '../app-config/app-config.service';

export interface KmBreakdown {
  base: number;
  baseDate: string;
  baseSource: string;
  realizedMissions: number;
  realizedHome: number;
  /** Détail trajet domicile : km/jour non productif retenu + jours ouvrés. */
  homePerDay: number;
  homeWorkingDays: number;
  total: number;
  readings: KmReading[];
}

@Injectable()
export class KmReadingService {
  constructor(
    @InjectRepository(KmReading) private readonly repo: Repository<KmReading>,
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    private readonly config: AppConfigService,
  ) {}

  findAll(vehicleCode?: string): Promise<KmReading[]> {
    return this.repo.find({
      where: vehicleCode ? { vehicleCode } : {},
      order: { date: 'DESC', createdAt: 'DESC' },
    });
  }

  create(data: Partial<KmReading>): Promise<KmReading> {
    requireFields(data as Record<string, unknown>, [
      { key: 'vehicleCode', label: 'véhicule' },
      { key: 'date', label: 'date' },
      { key: 'km', label: 'kilométrage', positive: true },
    ]);
    return this.repo.save(this.repo.create({ source: 'manual', ...data }));
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Releve introuvable');
    await this.repo.delete(id);
    return { deleted: true };
  }

  /** Nombre de jours ouvres (lun-ven) entre deux dates ISO incluses. */
  private workingDays(fromIso: string, toIso: string): number {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return 0;
    let n = 0;
    const d = new Date(from);
    while (d <= to) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) n++;
      d.setDate(d.getDate() + 1);
    }
    return Math.min(n, 400); // garde-fou
  }

  /**
   * Km cumule realise = dernier prelevement compteur + Sigma des km depuis :
   *  - missions terminees/cloturees (aller + retour) apres la date du prelevement
   *  - trajets domicile (vehicle.dailyHomeKm x jours ouvres)
   */
  async compute(vehicleCode: string): Promise<KmBreakdown> {
    const v = await this.vehicles.findOne({ where: { code: vehicleCode as never } });
    const readings = await this.repo.find({
      where: { vehicleCode },
      order: { date: 'DESC', createdAt: 'DESC' },
    });
    const last = readings[0];
    const base = last ? last.km : (v?.kmBase ?? v?.km ?? 0);
    const baseDate = last ? last.date : (v?.kmBaseDate ?? '2000-01-01');
    const baseSource = last ? last.source : 'initial';

    const mis = await this.missions.find({ where: { vehicleCode } });
    const realizedMissions = mis
      .filter((m) => ['TERMINEE', 'CLOTUREE'].includes(m.status ?? '') && (m.dateEnd ?? '') > baseDate)
      .reduce((s, m) => s + (m.distance ?? (m.dAller ?? 0) + (m.dRetour ?? 0)), 0);

    // Trajet domicile (km non productif / jour) :
    //  - override explicite sur le véhicule (`dailyHomeKm`), sinon
    //  - distance domicile↔travail du chauffeur affecté × 2 − km quotidien autorisé (paramètre).
    const params = ((await this.config.get('PARAMS')) as { dailyAllowedKm?: number }) ?? {};
    const allowed = params.dailyAllowedKm ?? 3;
    let homePerDay = v?.dailyHomeKm ?? 0;
    if (!homePerDay && v?.driverCode) {
      const dr = await this.drivers.findOne({ where: { code: v.driverCode as never } });
      const wd = dr?.workDistanceKm ?? 0;
      if (wd > 0) homePerDay = Math.max(0, Math.round(wd * 2 - allowed));
    }
    const today = new Date().toISOString().slice(0, 10);
    const homeWorkingDays = homePerDay > 0 ? this.workingDays(baseDate, today) : 0;
    const realizedHome = homePerDay * homeWorkingDays;

    return {
      base,
      baseDate,
      baseSource,
      realizedMissions,
      realizedHome,
      homePerDay,
      homeWorkingDays,
      total: base + realizedMissions + realizedHome,
      readings,
    };
  }
}
