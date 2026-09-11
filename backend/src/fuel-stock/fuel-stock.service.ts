import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FuelStockOp } from './fuel-stock.entity';
import { FuelEntry } from '../fuel-entries/fuel-entries.entity';
import { requireFields } from '../common/require-fields';
import { AppConfigService } from '../app-config/app-config.service';

export interface SiteStockBalance {
  siteCode: string;
  fuelType: string;
  stockLiters: number;      // cumul appros − cumul sorties (tout l'historique)
  stockValue: number;       // valeur du stock au PMP
  avgUnitPrice: number;     // prix moyen pondéré courant
  stockDebutLiters: number; // stock au 1er jour du mois demandé
  stockDebutValue: number;
  periodApproLiters: number;
  periodApproValue: number;
  periodSortieLiters: number;
  periodSortieValue: number;
  /** où part le carburant sur la période : par bénéficiaire */
  whereItGoes: { targetCode: string; targetKind: string; targetLabel: string | null; businessUnit: string | null; costCenter: string | null; liters: number; value: number }[];
}

@Injectable()
export class FuelStockService {
  constructor(
    @InjectRepository(FuelStockOp) private readonly repo: Repository<FuelStockOp>,
    @InjectRepository(FuelEntry) private readonly fuelEntries: Repository<FuelEntry>,
    private readonly config: AppConfigService,
  ) {}

  /** Prix courant d'un carburant (config FUEL_PRICES) — utilisé pour une sortie hors cuve. */
  private async fuelPrice(fuelType: string): Promise<number> {
    const prices = ((await this.config.get('FUEL_PRICES')) ?? {}) as Record<string, number>;
    const key = /GASOIL|DIESEL/i.test(fuelType) ? 'GASOIL' : /SUPER/i.test(fuelType) ? 'SUPER' : /GPL/i.test(fuelType) ? 'GPL' : 'SP';
    return prices[key] ?? prices.GASOIL ?? 45;
  }

  findAll(siteCode?: string): Promise<FuelStockOp[]> {
    return this.repo.find({ where: siteCode ? { siteCode } : {}, order: { date: 'DESC', createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<FuelStockOp> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Mouvement stock introuvable');
    return row;
  }

  /**
   * Instantané du stock (litres + valeur + PMP) d'un site/carburant à une date.
   *  - `until` (défaut : tout l'historique) ; `exclusive` : strictement avant `until` (stock début de période).
   *  - `opType='initial'` = saisie manuelle du stock de départ (retour DG Q3) : réinitialise le cumul.
   */
  private async snapshot(
    siteCode: string, fuelType: string, opts?: { until?: string; exclusive?: boolean },
  ): Promise<{ price: number; liters: number; value: number }> {
    const ops = await this.repo.find({ where: { siteCode, fuelType } });
    let liters = 0;
    let value = 0;
    const sorted = ops.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
    for (const o of sorted) {
      const d = o.date ?? '';
      if (opts?.until && (opts.exclusive ? d >= opts.until : d > opts.until)) continue;
      const L = o.liters ?? 0;
      // Sortie hors cuve (cas extrême) : tracée mais ne touche pas le stock du site.
      if (o.opType === 'sortie' && o.offStock) continue;
      if (o.opType === 'initial') {
        const up = o.unitPrice ?? (o.amount != null && L > 0 ? o.amount / L : (liters > 0 ? value / liters : 0));
        liters = L;
        value = L * up;
      } else if (o.opType === 'appro') {
        liters += L;
        value += o.amount ?? L * (o.unitPrice ?? 0);
      } else {
        const p = liters > 0 ? value / liters : (o.unitPrice ?? 0);
        liters -= L;
        value -= L * p;
      }
    }
    const price = liters > 0 ? Math.round((value / liters) * 100) / 100 : 0;
    return { price, liters: Math.round(liters * 100) / 100, value: Math.round(value) };
  }

  /** Prix moyen pondéré courant du stock d'un site/carburant (au plus tard à `beforeDate`). */
  private avgPrice(siteCode: string, fuelType: string, beforeDate?: string) {
    return this.snapshot(siteCode, fuelType, { until: beforeDate });
  }

  async create(data: Partial<FuelStockOp>): Promise<FuelStockOp> {
    const offStock = data.offStock === true || !data.siteCode;
    requireFields(data as Record<string, unknown>, [
      // « site / cuve » n'est plus obligatoire pour une sortie hors cuve (cas extrême — retour DG).
      ...(offStock && data.opType === 'sortie' ? [] : [{ key: 'siteCode', label: 'site / cuve' }]),
      { key: 'opType', label: 'type d’opération' },
      { key: 'liters', label: 'litres', positive: true },
    ]);
    if (data.opType === 'appro' && data.amount == null && data.unitPrice == null) {
      throw new BadRequestException('Approvisionnement : montant ou prix unitaire obligatoire.');
    }
    if (data.opType === 'sortie' && !data.targetCode && !data.targetLabel) {
      throw new BadRequestException('Sortie : bénéficiaire (véhicule ou désignation) obligatoire.');
    }
    // Retour DG : une sortie vers un véhicule externe doit être rattachée analytiquement.
    if (data.opType === 'sortie' && data.targetKind === 'external' && (!data.businessUnit || !data.costCenter)) {
      throw new BadRequestException('Carburant véhicule externe : Business Unit + centre de coût obligatoires (reporting).');
    }
    const fuelType = data.fuelType ?? 'GASOIL';
    const site = data.siteCode ?? '';
    let unitPrice = data.unitPrice ?? null;

    if (data.opType === 'appro' || data.opType === 'initial') {
      if (unitPrice == null && data.amount != null && data.liters) unitPrice = Math.round((data.amount / data.liters) * 100) / 100;
    } else if (offStock) {
      // sortie hors cuve : valorisée au prix carburant courant (config), pas de PMP de stock.
      unitPrice = unitPrice ?? await this.fuelPrice(fuelType);
    } else {
      // sortie : prix = PMP courant du stock
      const { price } = await this.avgPrice(site, fuelType, data.date ?? undefined);
      unitPrice = price || await this.fuelPrice(fuelType);
    }

    const op = await this.repo.save(this.repo.create({ ...data, fuelType, unitPrice, offStock }));

    // Sortie vers un véhicule interne → plein correspondant pour le contrôle conso.
    if (op.opType === 'sortie' && op.targetKind === 'vehicle' && op.targetCode) {
      const fe = await this.fuelEntries.save(this.fuelEntries.create({
        date: op.date, vehicleCode: op.targetCode, fuelType,
        qty: op.liters, unitPrice: op.unitPrice ?? null,
        amount: op.liters != null && op.unitPrice != null ? Math.round(op.liters * op.unitPrice) : null,
        source: 'stock_site',
      } as Partial<FuelEntry> & { siteCode?: string }));
      (fe as unknown as { siteCode?: string }).siteCode = op.siteCode ?? undefined;
      await this.fuelEntries.save(fe);
      op.linkedFuelEntryId = fe.id;
      await this.repo.save(op);
    }
    return op;
  }

  async update(id: string, data: Partial<FuelStockOp>): Promise<FuelStockOp> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const row = await this.findOne(id);
    if (row.linkedFuelEntryId) await this.fuelEntries.delete(row.linkedFuelEntryId).catch(() => undefined);
    await this.repo.delete(id);
    return { deleted: true };
  }

  /** État du stock par site (+ flux et « où part le carburant » sur la période / mois). */
  async balance(siteCode?: string, month?: string): Promise<SiteStockBalance[]> {
    const all = await this.repo.find();
    const sites = [...new Set(all.map((o) => o.siteCode).filter(Boolean))] as string[];
    const out: SiteStockBalance[] = [];
    for (const s of sites) {
      if (siteCode && s !== siteCode) continue;
      const fuelTypes = [...new Set(all.filter((o) => o.siteCode === s).map((o) => o.fuelType ?? 'GASOIL'))];
      for (const ft of fuelTypes) {
        const ops = all.filter((o) => o.siteCode === s && (o.fuelType ?? 'GASOIL') === ft);
        const inMonth = (o: FuelStockOp) => !month || (o.date ?? '').slice(0, 7) === month;
        const { price, liters, value } = await this.snapshot(s, ft);
        const debut = month ? await this.snapshot(s, ft, { until: `${month}-01`, exclusive: true }) : { liters: 0, value: 0 };
        const appros = ops.filter((o) => o.opType === 'appro' && inMonth(o));
        const sorties = ops.filter((o) => o.opType === 'sortie' && inMonth(o));
        const wig = new Map<string, { targetCode: string; targetKind: string; targetLabel: string | null; businessUnit: string | null; costCenter: string | null; liters: number; value: number }>();
        for (const o of sorties) {
          const key = [o.targetCode ?? o.targetLabel ?? '—', o.businessUnit ?? '', o.costCenter ?? ''].join('|');
          const e = wig.get(key) ?? { targetCode: o.targetCode ?? (o.targetLabel ?? key), targetKind: o.targetKind ?? 'vehicle', targetLabel: o.targetLabel ?? null, businessUnit: o.businessUnit ?? null, costCenter: o.costCenter ?? null, liters: 0, value: 0 };
          e.liters += o.liters ?? 0;
          e.value += (o.liters ?? 0) * (o.unitPrice ?? price);
          wig.set(key, e);
        }
        out.push({
          siteCode: s, fuelType: ft,
          stockLiters: liters, stockValue: value, avgUnitPrice: price,
          stockDebutLiters: debut.liters, stockDebutValue: debut.value,
          periodApproLiters: Math.round(appros.reduce((a, o) => a + (o.liters ?? 0), 0) * 100) / 100,
          periodApproValue: Math.round(appros.reduce((a, o) => a + (o.amount ?? 0), 0)),
          periodSortieLiters: Math.round(sorties.reduce((a, o) => a + (o.liters ?? 0), 0) * 100) / 100,
          periodSortieValue: Math.round(sorties.reduce((a, o) => a + (o.liters ?? 0) * (o.unitPrice ?? price), 0)),
          whereItGoes: [...wig.values()].map((e) => ({ ...e, liters: Math.round(e.liters * 100) / 100, value: Math.round(e.value) })).sort((a, b) => b.liters - a.liters),
        });
      }
    }
    return out;
  }
}
