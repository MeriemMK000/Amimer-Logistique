import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { FuelCard } from './fuel-cards.entity';
import { FuelCardMovement } from '../fuel-card-movements/fuel-card-movements.entity';
import { FuelCardMovementService } from '../fuel-card-movements/fuel-card-movements.service';

export interface CardSummary {
  cardId: string;
  cardNumber: string | null;
  vehicleCode: string | null;
  manager: string | null;
  monthlyCap: number | null;
  liters: number;
  amount: number;
  movements: number;
  overCap: boolean;
}

@Injectable()
export class FuelCardService {
  constructor(
    @InjectRepository(FuelCard)
    private readonly repo: Repository<FuelCard>,
    @InjectRepository(FuelCardMovement)
    private readonly moves: Repository<FuelCardMovement>,
    private readonly movementService: FuelCardMovementService,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<FuelCard[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<FuelCard> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('FuelCard ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<FuelCard>): Promise<FuelCard> {
    requireFields(data as Record<string, unknown>, [{ key: 'cardNumber', label: 'n° de carte' }]);
    return this.repo.save(this.repo.create({ active: true, ...data }));
  }

  async update(id: string, data: Partial<FuelCard>): Promise<FuelCard> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('fuel-cards', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  /** Ajout d'un mouvement (chargement mensuel ou plein) — crée aussi le plein lié. */
  async addMovement(id: string, body: Partial<FuelCardMovement>): Promise<FuelCardMovement> {
    const card = await this.findOne(id);
    return this.movementService.create({
      cardId: card.id,
      cardNumber: card.cardNumber,
      vehicleCode: body.vehicleCode ?? card.vehicleCode ?? null,
      date: body.date ?? new Date().toISOString().slice(0, 10),
      liters: body.liters ?? null,
      amount: body.amount ?? null,
      station: body.station ?? null,
      km: body.km ?? null,
      fuelType: body.fuelType ?? null,
      grade: body.grade ?? null,
      source: body.source ?? 'manuel',
    });
  }

  /** Consommation par carte / vehicule sur un mois (YYYY-MM). */
  async summary(month?: string): Promise<CardSummary[]> {
    const cards = await this.repo.find();
    const all = await this.moves.find();
    return cards.map((c) => {
      const mv = all.filter(
        (m) => m.cardId === c.id && (!month || (m.date ?? '').slice(0, 7) === month),
      );
      const liters = mv.reduce((s, m) => s + (m.liters ?? 0), 0);
      const amount = mv.reduce((s, m) => s + (m.amount ?? 0), 0);
      return {
        cardId: c.id, cardNumber: c.cardNumber, vehicleCode: c.vehicleCode, manager: c.manager,
        monthlyCap: c.monthlyCap,
        liters: Math.round(liters), amount: Math.round(amount), movements: mv.length,
        overCap: c.monthlyCap != null && amount > c.monthlyCap,
      };
    });
  }

  /**
   * Import fichier mouvements CSV. Colonnes souples :
   * cardNumber,date,vehicleCode,liters,amount,station,km
   */
  async importCsv(csv: string): Promise<{ imported: number; unmatched: string[] }> {
    const records: any[] = parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    const cards = await this.repo.find();
    const byNum = new Map(cards.map((c) => [String(c.cardNumber ?? '').trim(), c]));
    const num = (v: any) => (v === '' || v == null ? null : Number(v));
    const unmatched = new Set<string>();
    let imported = 0;
    for (const r of records) {
      const cn = String(r.cardNumber ?? r.carte ?? r.card ?? '').trim();
      const card = byNum.get(cn);
      if (!card && cn) unmatched.add(cn);
      await this.movementService.create({
        cardId: card?.id ?? null,
        cardNumber: cn || null,
        date: r.date ?? null,
        vehicleCode: r.vehicleCode ?? r.vehicule ?? card?.vehicleCode ?? null,
        liters: num(r.liters ?? r.litres ?? r.quantite),
        amount: num(r.amount ?? r.montant),
        station: r.station ?? null,
        km: num(r.km),
        fuelType: r.type ?? r.carburant ?? null,
        source: 'import',
      });
      imported++;
    }
    return { imported, unmatched: [...unmatched] };
  }
}
