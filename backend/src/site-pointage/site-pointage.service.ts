import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { SitePointage } from './site-pointage.entity';
import { FuelEntry } from '../fuel-entries/fuel-entries.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { ExternalVehicle } from '../external-vehicles/external-vehicles.entity';
import { ExternalInvoice } from '../external-invoices/external-invoice.entity';
import { AppConfigService } from '../app-config/app-config.service';
import { canonFuel, fuelPrice, gradeOf } from '../common/fuel-types';

const HOURS_PER_DAY = 8;

/** Normalise fraction / immobilized (comme le pointage location). */
function norm(data: Partial<SitePointage>): Partial<SitePointage> {
  const immobilized = data.immobilized === true;
  if (data.fraction != null) {
    const f = immobilized ? 1 : Math.max(0, Math.min(1, Number(data.fraction) || 0));
    return { ...data, fraction: f, immobilized, quantity: f, unit: 'day' };
  }
  if (immobilized) return { ...data, fraction: 1, immobilized: true, quantity: 1, unit: 'day' };
  return data;
}

export interface BillingLine {
  targetType: string | null;
  targetCode: string | null;
  siteCode: string | null;
  businessUnit: string | null;
  ca: string | null;
  days: number;
  hours: number;
  immoDays: number;
  fuelLiters: number;
  kmRun: number;
  amount: number;
  entries: number;
}

@Injectable()
export class SitePointageService {
  private readonly logger = new Logger(SitePointageService.name);

  constructor(
    @InjectRepository(SitePointage)
    private readonly repo: Repository<SitePointage>,
    @InjectRepository(FuelEntry)
    private readonly fuelEntries: Repository<FuelEntry>,
    @InjectRepository(Vehicle)
    private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(ExternalVehicle)
    private readonly externals: Repository<ExternalVehicle>,
    @InjectRepository(ExternalInvoice)
    private readonly extInvoices: Repository<ExternalInvoice>,
    private readonly config: AppConfigService,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<SitePointage[]> {
    return this.repo.find({ order: { date: 'DESC' } });
  }

  async findOne(id: string): Promise<SitePointage> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('SitePointage ' + id + ' introuvable');
    return row;
  }

  /**
   * Dotation carburant journalière du site (retour DG « toute possibilité qui concerne
   * ce véhicule on doit la récupérer ») : quand une ligne de pointage porte `fuelLiters`,
   * on crée / met à jour un plein lié (source 'dotation_site') pour que ce carburant
   * entre dans le contrôle carburant et le bilan, au même titre que carte / régie / cuve.
   */
  private async syncLinkedFuelEntry(row: SitePointage): Promise<void> {
    const L = row.fuelLiters ?? 0;
    // Plus de carburant sur la ligne → on supprime le plein lié.
    if (!(L > 0) || !row.targetCode) {
      if (row.linkedFuelEntryId) {
        await this.fuelEntries.delete(row.linkedFuelEntryId).catch(() => undefined);
        row.linkedFuelEntryId = null;
        await this.repo.save(row);
      }
      return;
    }
    const v = row.targetCode ? await this.vehicles.findOne({ where: { code: row.targetCode } }) : null;
    const prices = ((await this.config.get('FUEL_PRICES')) ?? {}) as Record<string, number>;
    const ft = canonFuel(v?.fuel);
    const px = fuelPrice(prices, ft) ?? prices.GASOIL ?? 52.5;
    const patch: Partial<FuelEntry> & { siteCode?: string | null } = {
      date: row.date, vehicleCode: row.targetCode, fuelType: ft, grade: gradeOf(ft),
      qty: L, unitPrice: px, amount: Math.round(L * px),
      kmEnd: row.kmEnd ?? null, kmStart: row.kmStart ?? null,
      source: 'dotation_site', siteCode: row.siteCode ?? null,
    };
    if (row.linkedFuelEntryId) {
      const fe = await this.fuelEntries.findOne({ where: { id: row.linkedFuelEntryId } });
      if (fe) { Object.assign(fe, patch); await this.fuelEntries.save(fe); return; }
    }
    const fe = await this.fuelEntries.save(this.fuelEntries.create(patch as Partial<FuelEntry>));
    row.linkedFuelEntryId = fe.id;
    await this.repo.save(row);
  }

  async create(data: Partial<SitePointage>): Promise<SitePointage> {
    const row = await this.repo.save(this.repo.create({ source: 'manual', ...norm(data) }));
    await this.syncLinkedFuelEntry(row).catch((e) => this.logger.warn(String(e)));
    return row;
  }

  /**
   * Saisie rapide grille (identique au pointage location) : cree / met a jour / supprime
   * les pointages par (site + engin + date). fraction 0 et non immobilise -> supprime la ligne.
   */
  async upsertMany(
    rows: {
      siteCode: string; targetCode: string; date: string; fraction: number;
      immobilized?: boolean; targetType?: string; dayPrice?: number;
      businessUnit?: string; ca?: string; note?: string;
      // Détails du jour (retour DG) : dotation carburant + relevés compteur.
      fuelLiters?: number | null; kmStart?: number | null; kmEnd?: number | null;
      hoursStart?: number | null; hoursEnd?: number | null;
    }[],
  ): Promise<{ upserted: number; deleted: number }> {
    let upserted = 0;
    let deleted = 0;
    for (const r of rows) {
      const immo = r.immobilized === true;
      const f = immo ? 1 : Math.max(0, Math.min(1, Number(r.fraction) || 0));
      const hasDetails = r.fuelLiters != null || r.kmStart != null || r.kmEnd != null || r.hoursStart != null || r.hoursEnd != null;
      const existing = await this.repo.findOne({
        where: { siteCode: r.siteCode as never, targetCode: r.targetCode as never, date: r.date as never },
      });
      if (f === 0 && !immo && !hasDetails && !(existing?.fuelLiters ?? 0)) {
        if (existing) {
          if (existing.linkedFuelEntryId) await this.fuelEntries.delete(existing.linkedFuelEntryId).catch(() => undefined);
          await this.repo.delete(existing.id);
          deleted++;
        }
        continue;
      }
      const patch: Partial<SitePointage> = {
        siteCode: r.siteCode, targetCode: r.targetCode, date: r.date,
        targetType: r.targetType ?? existing?.targetType ?? 'engin',
        unit: 'day', quantity: f, fraction: f, immobilized: immo,
        source: 'grid',
      };
      if (r.dayPrice != null) patch.dayPrice = r.dayPrice;
      if (r.businessUnit != null) patch.businessUnit = r.businessUnit;
      if (r.ca != null) patch.ca = r.ca;
      if (r.note != null) patch.note = r.note;
      if (r.fuelLiters !== undefined) patch.fuelLiters = r.fuelLiters;
      if (r.kmStart !== undefined) patch.kmStart = r.kmStart;
      if (r.kmEnd !== undefined) patch.kmEnd = r.kmEnd;
      if (r.hoursStart !== undefined) patch.hoursStart = r.hoursStart;
      if (r.hoursEnd !== undefined) patch.hoursEnd = r.hoursEnd;
      const saved = existing
        ? await this.repo.save(Object.assign(existing, patch))
        : await this.repo.save(this.repo.create(patch));
      await this.syncLinkedFuelEntry(saved).catch((e) => this.logger.warn(String(e)));
      upserted++;
    }
    return { upserted, deleted };
  }

  async update(id: string, data: Partial<SitePointage>): Promise<SitePointage> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    const saved = await this.repo.save(row);
    await this.syncLinkedFuelEntry(saved).catch((e) => this.logger.warn(String(e)));
    return saved;
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const row = await this.findOne(id);
    await this.dependency.assertRemovable('site-pointage', id);
    if (row.linkedFuelEntryId) await this.fuelEntries.delete(row.linkedFuelEntryId).catch(() => undefined);
    await this.repo.delete(id);
    return { deleted: true };
  }

  /** Prix d'immobilisation (par defaut ~50 % du prix jour). */
  private immoAmount(p: SitePointage): number {
    return Math.round((p.dayPrice ?? 0) * 0.5);
  }

  /** Fraction de journee effective d'une ligne (grille de pointage OU ancien modele unit/quantity). */
  private lineFraction(p: SitePointage): number {
    if (p.immobilized) return 1;
    if (p.fraction != null) return Math.max(0, Math.min(1, p.fraction));
    const q = p.quantity ?? 0;
    return p.unit === 'hour' ? q / HOURS_PER_DAY : q;
  }

  /** Montant d'une ligne : immobilise -> prix immo ; sinon prix jour * fraction. */
  private lineAmount(p: SitePointage): number {
    if (p.immobilized) return this.immoAmount(p);
    return this.lineFraction(p) * (p.dayPrice ?? 0);
  }

  /** Facturation agregee par engin/vehicule pour un site + mois (YYYY-MM). */
  async billing(site?: string, month?: string): Promise<BillingLine[]> {
    const all = await this.repo.find();
    const rows = all.filter(
      (p) =>
        (!site || p.siteCode === site) &&
        (!month || (p.date ?? '').slice(0, 7) === month),
    );
    const map = new Map<string, BillingLine>();
    for (const p of rows) {
      const key = `${p.siteCode}|${p.targetType}|${p.targetCode}`;
      const l =
        map.get(key) ??
        {
          targetType: p.targetType, targetCode: p.targetCode, siteCode: p.siteCode,
          businessUnit: p.businessUnit ?? null, ca: p.ca ?? null,
          days: 0, hours: 0, immoDays: 0, fuelLiters: 0, kmRun: 0, amount: 0, entries: 0,
        };
      if (p.immobilized) {
        l.immoDays += 1;
      } else {
        const fr = this.lineFraction(p);
        l.days += fr;
        l.hours += fr * HOURS_PER_DAY;
      }
      if (p.businessUnit && !l.businessUnit) l.businessUnit = p.businessUnit;
      if (p.ca && !l.ca) l.ca = p.ca;
      l.fuelLiters += p.fuelLiters ?? 0;
      if (p.kmStart != null && p.kmEnd != null) l.kmRun += Math.max(0, p.kmEnd - p.kmStart);
      l.amount += this.lineAmount(p);
      l.entries += 1;
      map.set(key, l);
    }
    return [...map.values()].map((l) => ({
      ...l,
      days: Math.round(l.days * 1000) / 1000,
      hours: Math.round(l.hours * 100) / 100,
      amount: Math.round(l.amount),
    }));
  }

  /**
   * Contrôle des factures fournisseurs (retour DG) : pour chaque véhicule / engin EXTERNE
   * pointé sur un site + mois → jours & heures pointés, montant attendu (pointé × tarif
   * convenu), montant réellement facturé (saisi), écart.
   */
  async externalControl(site?: string, month?: string): Promise<Array<{
    externalCode: string; label: string; siteCode: string | null; supplier: string | null;
    rateUnit: string; unitRate: number | null;
    pointedDays: number; pointedHours: number; pointedFuelLiters: number;
    expected: number | null;
    invoicedQty: number | null; invoicedUnit: string | null; invoicedAmount: number | null;
    invoiceRef: string | null; invoiceId: string | null;
    ecart: number | null;
  }>> {
    const [pointages, externals, invoices] = await Promise.all([
      this.repo.find(),
      this.externals.find(),
      this.extInvoices.find(),
    ]);
    const rows = pointages.filter((p) =>
      p.targetType === 'external'
      && (!site || p.siteCode === site)
      && (!month || (p.date ?? '').slice(0, 7) === month));

    // Groupé par (externe + site).
    const byKey = new Map<string, { code: string; siteCode: string | null; days: number; hours: number; fuel: number }>();
    for (const p of rows) {
      const key = `${p.targetCode}|${p.siteCode}`;
      const e = byKey.get(key) ?? { code: p.targetCode ?? '', siteCode: p.siteCode ?? null, days: 0, hours: 0, fuel: 0 };
      const fr = this.lineFraction(p);
      e.days += fr;
      e.hours += fr * HOURS_PER_DAY;
      e.fuel += p.fuelLiters ?? 0;
      byKey.set(key, e);
    }

    // On inclut aussi les externes déclarés sur le site même sans pointage (facture seule possible).
    for (const ev of externals) {
      if (site && ev.siteCode !== site) continue;
      const key = `${ev.id}|${ev.siteCode}`;
      if (!byKey.has(key)) byKey.set(key, { code: ev.id, siteCode: ev.siteCode ?? null, days: 0, hours: 0, fuel: 0 });
    }

    return [...byKey.values()].map((e) => {
      const ev = externals.find((x) => x.id === e.code);
      const rateUnit = ev?.rateUnit ?? 'day';
      const unitRate = ev?.unitRate ?? null;
      const expected = unitRate != null
        ? Math.round(unitRate * (rateUnit === 'hour' ? e.hours : e.days))
        : null;
      const inv = invoices.find((i) => i.externalCode === e.code
        && (!month || i.month === month) && (!site || i.siteCode === e.siteCode));
      const invoicedAmount = inv?.invoicedAmount ?? null;
      return {
        externalCode: e.code,
        label: ev?.label ?? e.code,
        siteCode: e.siteCode,
        supplier: ev?.supplier ?? ev?.owner ?? null,
        rateUnit, unitRate,
        pointedDays: Math.round(e.days * 100) / 100,
        pointedHours: Math.round(e.hours * 100) / 100,
        pointedFuelLiters: Math.round(e.fuel * 100) / 100,
        expected,
        invoicedQty: inv?.invoicedQty ?? null,
        invoicedUnit: inv?.invoicedUnit ?? null,
        invoicedAmount,
        invoiceRef: inv?.invoiceRef ?? null,
        invoiceId: inv?.id ?? null,
        ecart: expected != null && invoicedAmount != null ? Math.round(invoicedAmount - expected) : null,
      };
    }).sort((a, b) => (b.invoicedAmount ?? b.expected ?? 0) - (a.invoicedAmount ?? a.expected ?? 0));
  }

  /**
   * Import CSV. Colonnes attendues (souples) :
   * siteCode,date,targetType,targetCode,unit,quantity,fuelLiters,kmStart,kmEnd,dayPrice
   */
  async importCsv(csv: string): Promise<{ imported: number }> {
    const records: any[] = parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    const num = (v: any) => (v === '' || v == null ? null : Number(v));
    const rows = records.map((r) => {
      const unit = r.unit ?? 'day';
      const rawQty = num(r.quantity ?? r.qte ?? r.jours ?? r.heures);
      const immobilized = /^(1|true|oui|i)$/i.test(String(r.immobilized ?? r.immo ?? '').trim());
      const fracCol = num(r.fraction);
      const fraction = immobilized ? 1
        : fracCol != null ? Math.max(0, Math.min(1, fracCol))
          : rawQty != null ? Math.max(0, Math.min(1, unit === 'hour' ? rawQty / HOURS_PER_DAY : rawQty))
            : null;
      return this.repo.create({
        siteCode: r.siteCode ?? r.site ?? null,
        date: r.date ?? null,
        targetType: r.targetType ?? r.type ?? 'engin',
        targetCode: r.targetCode ?? r.code ?? r.engin ?? null,
        unit: 'day',
        quantity: fraction, fraction, immobilized,
        businessUnit: r.businessUnit ?? r.bu ?? null,
        ca: r.ca ?? r.centre ?? null,
        fuelLiters: num(r.fuelLiters ?? r.carburant ?? r.litres),
        kmStart: num(r.kmStart), kmEnd: num(r.kmEnd),
        hoursStart: num(r.hoursStart), hoursEnd: num(r.hoursEnd),
        dayPrice: num(r.dayPrice ?? r.prixJour),
        source: 'import',
      });
    });
    const saved = await this.repo.save(rows);
    for (const row of saved) await this.syncLinkedFuelEntry(row).catch((e) => this.logger.warn(String(e)));
    return { imported: saved.length };
  }
}
