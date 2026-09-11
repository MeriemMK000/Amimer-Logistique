import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FuelCardMovement } from './fuel-card-movements.entity';
import { FuelEntry } from '../fuel-entries/fuel-entries.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { AppConfigService } from '../app-config/app-config.service';
import { canonFuel, fuelPrice, gradeOf } from '../common/fuel-types';

/**
 * Passages de carte carburant. Retour DG : « on réunit tous les achats faits, c'est
 * normalement des consommations » → chaque passage crée un PLEIN dans le registre unique
 * (fuel_entries, source = 'carte'). Le registre des pleins devient la seule source de vérité
 * de la consommation d'un véhicule.
 */
@Injectable()
export class FuelCardMovementService {
  constructor(
    @InjectRepository(FuelCardMovement) private readonly repo: Repository<FuelCardMovement>,
    @InjectRepository(FuelEntry) private readonly fuel: Repository<FuelEntry>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly config: AppConfigService,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<FuelCardMovement[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<FuelCardMovement> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('FuelCardMovement ' + id + ' introuvable');
    return row;
  }

  /** Crée le passage + le plein correspondant (registre unique). */
  async create(data: Partial<FuelCardMovement>): Promise<FuelCardMovement> {
    const v = data.vehicleCode ? await this.vehicles.findOne({ where: { code: data.vehicleCode } as never }) : null;
    const ft = canonFuel(data.fuelType ?? v?.fuel, data.grade);
    const prices = ((await this.config.get('FUEL_PRICES')) ?? {}) as Record<string, number>;
    // Un « chargement » = crédit chargé sur la carte, PAS une consommation → on ne dérive
    // pas de litres et on ne crée pas de plein.
    const isChargement = (data.source ?? '') === 'chargement';
    let liters = isChargement ? null : (data.liters ?? null);
    let amount = data.amount ?? null;
    const unit = fuelPrice(prices, ft);
    if (!isChargement) {
      if (liters == null && amount != null && unit) liters = Math.round((amount / unit) * 10) / 10;
      if (amount == null && liters != null && unit) amount = Math.round(liters * unit);
    }

    const mv = await this.repo.save(this.repo.create({
      ...data, fuelType: ft, grade: gradeOf(ft), liters, amount,
      date: data.date ?? new Date().toISOString().slice(0, 10),
      source: data.source ?? 'manuel',
    }));

    if (mv.vehicleCode && (liters ?? 0) > 0) {
      const fe = await this.fuel.save(this.fuel.create({
        date: mv.date, vehicleCode: mv.vehicleCode, fuelType: ft, grade: gradeOf(ft),
        qty: liters ?? 0, amount: amount ?? null,
        unitPrice: liters && amount ? Math.round((amount / liters) * 100) / 100 : (unit ?? null),
        kmEnd: mv.km ?? null, cardNumber: mv.cardNumber ?? null, source: 'carte',
      } as Partial<FuelEntry>));
      mv.linkedFuelEntryId = fe.id;
      await this.repo.save(mv);
    }
    return mv;
  }

  async update(id: string, data: Partial<FuelCardMovement>): Promise<FuelCardMovement> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    const saved = await this.repo.save(row);
    // Répercute sur le plein lié (litres / montant / date / km).
    if (saved.linkedFuelEntryId) {
      const fe = await this.fuel.findOne({ where: { id: saved.linkedFuelEntryId as never } });
      if (fe) {
        fe.qty = saved.liters ?? fe.qty;
        fe.amount = saved.amount ?? fe.amount;
        fe.date = saved.date ?? fe.date;
        fe.kmEnd = saved.km ?? fe.kmEnd;
        await this.fuel.save(fe);
      }
    }
    return saved;
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const row = await this.findOne(id);
    await this.dependency.assertRemovable('fuel-card-movements', id);
    if (row.linkedFuelEntryId) await this.fuel.delete(row.linkedFuelEntryId).catch(() => undefined);
    await this.repo.delete(id);
    return { deleted: true };
  }

  /**
   * Rattrapage : pour les passages historiques sans plein lié, crée le plein manquant.
   * Idempotent (appelé au démarrage).
   */
  async syncLinkedFuelEntries(): Promise<{ created: number }> {
    const orphans = await this.repo.find({ where: { linkedFuelEntryId: null as never } });
    let created = 0;
    for (const mv of orphans) {
      if (!mv.vehicleCode || !(mv.liters ?? 0)) continue;
      const v = await this.vehicles.findOne({ where: { code: mv.vehicleCode } as never });
      const ft = canonFuel(mv.fuelType ?? v?.fuel, mv.grade);
      const fe = await this.fuel.save(this.fuel.create({
        date: mv.date, vehicleCode: mv.vehicleCode, fuelType: ft, grade: gradeOf(ft),
        qty: mv.liters ?? 0, amount: mv.amount ?? null,
        unitPrice: mv.liters && mv.amount ? Math.round((mv.amount / mv.liters) * 100) / 100 : null,
        kmEnd: mv.km ?? null, cardNumber: mv.cardNumber ?? null, source: 'carte',
      } as Partial<FuelEntry>));
      mv.linkedFuelEntryId = fe.id;
      if (!mv.fuelType) mv.fuelType = ft;
      await this.repo.save(mv);
      created++;
    }
    return { created };
  }
}
