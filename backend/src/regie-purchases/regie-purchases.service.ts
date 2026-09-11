import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { RegiePurchase } from './regie-purchase.entity';
import { FuelEntry } from '../fuel-entries/fuel-entries.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { AppConfigService } from '../app-config/app-config.service';
import { requireFields } from '../common/require-fields';

@Injectable()
export class RegiePurchasesService {
  constructor(
    @InjectRepository(RegiePurchase) private readonly repo: Repository<RegiePurchase>,
    @InjectRepository(FuelEntry) private readonly fuel: Repository<FuelEntry>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Contexte carburant d'un véhicule : type (jamais choisi à la main — vient de la fiche),
   * prix unitaire courant, et plafond physique = plein max (réservoir).
   */
  private async fuelContext(vehicleCode?: string | null, grade?: string | null): Promise<{ fuelType: string; grade: string | null; unitPrice: number | null; tankLiters: number | null; vehLabel: string }> {
    const v = vehicleCode ? await this.vehicles.findOne({ where: { code: vehicleCode } as never }) : null;
    const fuelType = (v?.fuel ?? 'GASOIL').toUpperCase();
    const prices = ((await this.config.get('FUEL_PRICES')) ?? {}) as Record<string, number>;
    // Le sous-type (SP / SUPER) n'a de sens que pour un véhicule essence.
    const g = fuelType === 'ESSENCE' && grade ? String(grade).toUpperCase() : null;
    const unitPrice = (g ? prices[g] : null) ?? prices[fuelType] ?? prices.GASOIL ?? null;
    return {
      fuelType, grade: g,
      unitPrice: unitPrice != null ? Number(unitPrice) : null,
      tankLiters: v?.tankLiters ?? null,
      vehLabel: v ? `${v.code} ${(v.brand ?? '').trim()} ${(v.model ?? '').trim()}`.trim() : (vehicleCode ?? ''),
    };
  }

  /** Complète le couple (litres, montant) : on saisit l'un, le système calcule l'autre via le prix. */
  private completePair(liters: number | null | undefined, amount: number | null | undefined, unitPrice: number | null): { liters: number | null; amount: number | null } {
    let L = liters != null && Number(liters) > 0 ? Number(liters) : null;
    let A = amount != null && Number(amount) > 0 ? Number(amount) : null;
    if (unitPrice && unitPrice > 0) {
      if (L != null && A == null) A = Math.round(L * unitPrice);
      else if (A != null && L == null) L = Math.round((A / unitPrice) * 10) / 10;
    }
    return { liters: L, amount: A };
  }

  findAll(): Promise<RegiePurchase[]> {
    return this.repo.find({ order: { date: 'DESC', createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<RegiePurchase> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Bon régie introuvable');
    return row;
  }

  async create(data: Partial<RegiePurchase>): Promise<RegiePurchase & { qr: string; verifyUrl: string }> {
    requireFields(data as Record<string, unknown>, [
      { key: 'vehicleCode', label: 'véhicule' },
      { key: 'reason', label: 'motif' },
    ]);
    const ctx = await this.fuelContext(data.vehicleCode, data.grade);
    // Type carburant : jamais saisi — il vient de la fiche du véhicule.
    // Plafonds : on saisit litres OU montant, le système calcule l'autre.
    const { liters: maxLiters, amount: maxAmount } = this.completePair(data.maxLiters, data.maxAmount, ctx.unitPrice);
    if (maxLiters == null && maxAmount == null) {
      throw new BadRequestException('Renseignez un plafond en litres ou en montant.');
    }
    // Le plein max (réservoir) est le seuil physique d'un bon régie.
    if (ctx.tankLiters != null && ctx.tankLiters > 0 && maxLiters != null && maxLiters > ctx.tankLiters + 0.5) {
      throw new BadRequestException(`Plafond ${maxLiters} L supérieur au plein max du véhicule ${ctx.vehLabel} (${ctx.tankLiters} L).`);
    }
    const year = new Date().getFullYear();
    const count = await this.repo.count();
    const ref = data.ref ?? `REG-${year}-${String(count + 1).padStart(4, '0')}`;
    const verifyToken = randomBytes(9).toString('hex');
    const row = await this.repo.save(this.repo.create({
      ...data, ref, verifyToken,
      fuelType: ctx.fuelType, grade: ctx.grade,
      maxLiters, maxAmount,
      date: data.date ?? new Date().toISOString().slice(0, 10),
      status: 'emis',
    }));
    return this.withQr(row);
  }

  private async withQr(row: RegiePurchase, publicBaseUrl?: string): Promise<RegiePurchase & { qr: string; verifyUrl: string }> {
    const base = publicBaseUrl || 'http://localhost:3000';
    const verifyUrl = `${base}/verify/regie/${row.verifyToken}`;
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 180 });
    return { ...row, qr, verifyUrl };
  }

  async qr(id: string, base?: string): Promise<{ ref: string | null; qr: string; verifyUrl: string; purchase: RegiePurchase }> {
    const row = await this.findOne(id);
    const { qr, verifyUrl } = await this.withQr(row, base);
    return { ref: row.ref, qr, verifyUrl, purchase: row };
  }

  /** Vérification publique du bon (QR scanné par la station / le chauffeur). */
  async verify(token: string): Promise<{ valid: boolean; purchase?: Partial<RegiePurchase> & { expired?: boolean } }> {
    const row = await this.repo.findOne({ where: { verifyToken: token as never } });
    if (!row) return { valid: false };
    const today = new Date().toISOString().slice(0, 10);
    const expired = !!row.validUntil && row.validUntil < today && row.status === 'emis';
    return {
      valid: true,
      purchase: {
        ref: row.ref, vehicleCode: row.vehicleCode, driverCode: row.driverCode, fuelType: row.fuelType, grade: row.grade,
        date: row.date, validUntil: row.validUntil, maxLiters: row.maxLiters, maxAmount: row.maxAmount,
        reason: row.reason, status: row.status, expired,
      },
    };
  }

  async update(id: string, data: Partial<RegiePurchase>): Promise<RegiePurchase> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  /** Enregistre l'achat réel → crée le plein `source = regie` rattaché au bon. */
  async consume(
    id: string,
    body: { actualLiters?: number; actualAmount?: number; actualDate?: string; station?: string },
  ): Promise<RegiePurchase> {
    const row = await this.findOne(id);
    if (row.status === 'consomme') throw new BadRequestException('Ce bon régie a déjà été consommé.');
    if (row.status === 'annule') throw new BadRequestException('Bon régie annulé.');
    const ctx = await this.fuelContext(row.vehicleCode, row.grade);
    // On saisit litres OU montant — le système calcule l'autre via le prix carburant.
    const pair = this.completePair(body.actualLiters, body.actualAmount, ctx.unitPrice);
    const liters = pair.liters ?? 0;
    const amount = pair.amount ?? 0;
    if (!liters || !amount) throw new BadRequestException('Renseignez les litres ou le montant réel.');
    if (row.maxLiters != null && liters > row.maxLiters + 0.5) throw new BadRequestException(`Litres (${liters}) au-delà du plafond autorisé (${row.maxLiters}).`);
    if (row.maxAmount != null && amount > row.maxAmount + 1) throw new BadRequestException(`Montant (${amount}) au-delà du plafond autorisé (${row.maxAmount}).`);
    if (ctx.tankLiters != null && ctx.tankLiters > 0 && liters > ctx.tankLiters + 0.5) {
      throw new BadRequestException(`Litres (${liters}) supérieurs au plein max du véhicule (${ctx.tankLiters} L).`);
    }

    const date = body.actualDate ?? new Date().toISOString().slice(0, 10);
    const fe = await this.fuel.save(this.fuel.create({
      date, vehicleCode: row.vehicleCode, driverCode: row.driverCode, fuelType: row.fuelType, grade: row.grade,
      qty: liters, amount, unitPrice: liters > 0 ? Math.round((amount / liters) * 100) / 100 : null,
      source: 'regie',
    } as Partial<FuelEntry> & { regieRef?: string }));
    (fe as unknown as { regieRef?: string }).regieRef = row.ref ?? undefined;
    await this.fuel.save(fe);

    row.status = 'consomme';
    row.actualLiters = liters;
    row.actualAmount = amount;
    row.actualDate = date;
    row.station = body.station ?? null;
    row.linkedFuelEntryId = fe.id;
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const row = await this.findOne(id);
    if (row.linkedFuelEntryId) await this.fuel.delete(row.linkedFuelEntryId).catch(() => undefined);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
