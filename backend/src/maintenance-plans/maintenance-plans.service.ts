import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MaintenancePlan } from './maintenance-plan.entity';
import { VehicleMaintenancePlan } from './vehicle-maintenance-plan.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { MaintenanceOrder } from '../maintenance-orders/maintenance-orders.entity';
import { KmReadingService } from '../km-readings/km-readings.service';

/** Un OT est « en cours » tant qu'il n'est ni terminé ni annulé (échéance déjà prise en charge). */
const CLOSED_OT_STATUS = new Set(['termine', 'terminee', 'annule', 'annulee', 'cloture', 'cloturee']);

export interface DueItem {
  vehicleCode: string;
  vehicleLabel: string;
  planId: string;
  planName: string;
  trigger: string;
  current: number;
  nextDue: number;
  remaining: number;
  overdue: boolean;
  alert: boolean;
  operations: { label: string; coutEstime: number }[];
  estimatedCost: number;
  hasOpenOt: boolean;      // un ordre de travail est déjà ouvert pour ce véhicule + ce modèle
  openOtNum: string | null;
}

@Injectable()
export class MaintenancePlansService {
  constructor(
    @InjectRepository(MaintenancePlan) private readonly plans: Repository<MaintenancePlan>,
    @InjectRepository(VehicleMaintenancePlan) private readonly links: Repository<VehicleMaintenancePlan>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(MaintenanceOrder) private readonly orders: Repository<MaintenanceOrder>,
    private readonly km: KmReadingService,
  ) {}

  // ---- Plans ----
  findAllPlans() {
    return this.plans.find();
  }
  createPlan(data: Partial<MaintenancePlan>) {
    return this.plans.save(this.plans.create(data));
  }
  async updatePlan(id: string, data: Partial<MaintenancePlan>) {
    const p = await this.plans.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Modele introuvable');
    Object.assign(p, data);
    return this.plans.save(p);
  }
  async removePlan(id: string) {
    await this.links.delete({ planId: id });
    await this.plans.delete(id);
    return { deleted: true };
  }

  // ---- Rattachements ----
  findAllLinks() {
    return this.links.find();
  }
  createLink(data: Partial<VehicleMaintenancePlan>) {
    return this.links.save(this.links.create(data));
  }
  async updateLink(id: string, data: Partial<VehicleMaintenancePlan>) {
    const l = await this.links.findOne({ where: { id } });
    if (!l) throw new NotFoundException('Rattachement introuvable');
    Object.assign(l, data);
    return this.links.save(l);
  }
  async removeLink(id: string) {
    await this.links.delete(id);
    return { deleted: true };
  }

  /** Vehicules concernes par un plan (via targetKind ou liste explicite de rattachements). */
  private async vehiclesForPlan(plan: MaintenancePlan): Promise<Vehicle[]> {
    const all = await this.vehicles.find();
    const explicitLinks = await this.links.find({ where: { planId: plan.id, active: true } });
    const explicitCodes = new Set(explicitLinks.map((l) => l.vehicleCode));
    return all.filter((v) => {
      if (explicitCodes.has(v.code)) return true;
      if (plan.targetKind === 'type') return v.type === plan.targetValue;
      if (plan.targetKind === 'marque') return v.brand === plan.targetValue;
      if (plan.targetKind === 'modele') return v.model === plan.targetValue;
      if (plan.targetKind === 'vehicles') return (plan.targetVehicles ?? []).includes(v.code);
      return false;
    });
  }

  /** Calcule toutes les echeances : a venir, proches (alert), en retard. */
  async computeDue(): Promise<DueItem[]> {
    const plans = (await this.plans.find()).filter((p) => p.active);
    const links = await this.links.find();
    // OT encore en cours (échéance déjà prise en charge) — clé véhicule + modèle (planId, ou titre en repli).
    const openOrders = (await this.orders.find()).filter(
      (o) => !CLOSED_OT_STATUS.has((o.status ?? '').trim().toLowerCase()),
    );
    const out: DueItem[] = [];
    for (const plan of plans) {
      const vs = await this.vehiclesForPlan(plan);
      for (const v of vs) {
        const link = links.find((l) => l.planId === plan.id && l.vehicleCode === v.code);
        const ot = openOrders.find(
          (o) => o.vehicleCode === v.code && (o.planId === plan.id || (o.title ?? '') === plan.name),
        );
        const current =
          plan.trigger === 'HOURS'
            ? v.hourMeter ?? 0
            : (await this.km.compute(v.code)).total;
        const lastDone = link?.lastDoneValue ?? 0;
        const base = lastDone > 0 ? lastDone : current - (current % plan.intervalValue || 0);
        const nextDue = base + plan.intervalValue;
        const remaining = nextDue - current;
        const alertAt = plan.intervalValue * (1 - plan.alertThresholdPct / 100);
        const ops = plan.operations ?? [];
        out.push({
          vehicleCode: v.code,
          vehicleLabel: `${v.code} — ${v.brand ?? ''} ${v.model ?? ''}`.trim(),
          planId: plan.id,
          planName: plan.name,
          trigger: plan.trigger,
          current: Math.round(current),
          nextDue: Math.round(nextDue),
          remaining: Math.round(remaining),
          overdue: remaining < 0,
          alert: remaining <= alertAt,
          operations: ops,
          estimatedCost: ops.reduce((s, o) => s + (o.coutEstime ?? 0), 0),
          hasOpenOt: !!ot,
          openOtNum: ot?.num ?? null,
        });
      }
    }
    return out.sort((a, b) => a.remaining - b.remaining);
  }
}
