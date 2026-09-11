import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { normalizeDate } from '../common/normalize-date';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { FuelEntry } from './fuel-entries.entity';
import { AppConfigService } from '../app-config/app-config.service';

@Injectable()
export class FuelEntryService {
  constructor(
    @InjectRepository(FuelEntry)
    private readonly repo: Repository<FuelEntry>,
    private readonly dependency: DependencyService,
    private readonly config: AppConfigService,
  ) {}

  findAll(): Promise<FuelEntry[]> {
    return this.repo.find();
  }

  async findOne(id: string): Promise<FuelEntry> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('FuelEntry ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<FuelEntry>): Promise<FuelEntry> {
    requireFields(data as Record<string, unknown>, [
      { key: 'date', label: 'date' },
      { key: 'vehicleCode', label: 'véhicule' },
      { key: 'qty', label: 'quantité (litres)', positive: true },
    ]);
    if (data.date != null) data.date = normalizeDate(data.date);
    return this.repo.save(this.repo.create(data));
  }

  async update(id: string, data: Partial<FuelEntry>): Promise<FuelEntry> {
    const row = await this.findOne(id);
    if (data.date != null) data.date = normalizeDate(data.date);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('fuel-entries', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<FuelEntry>[]): Promise<FuelEntry[]> {
    await this.repo.clear();
    return this.repo.save(rows.map((row) => this.repo.create(row)));
  }

  /**
   * Import d'un fichier de pleins (station / carte carburant).
   * Colonnes souples : date, vehicule, carte, chauffeur, montant, (litres, prix, type, km).
   * Si seul le montant est fourni, la quantite est estimee via le prix du carburant (config).
   */
  async importCsv(csv: string): Promise<{ imported: number }> {
    const records: any[] = parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    const prices = ((await this.config.get('FUEL_PRICES')) as Record<string, number>) ?? {};
    const num = (v: any) => (v === '' || v == null ? null : Number(String(v).replace(/[^\d.,-]/g, '').replace(',', '.')));

    const rows = records.map((r) => {
      const fuelType = (r.type ?? r.carburant ?? 'GASOIL').toString().toUpperCase();
      const amount = num(r.montant ?? r.amount ?? r.total);
      let qty = num(r.litres ?? r.quantite ?? r.qty);
      let unitPrice = num(r.prix ?? r.prixUnitaire ?? r.unitPrice) ?? prices[fuelType] ?? prices.GASOIL ?? null;
      if (!qty && amount && unitPrice) qty = Math.round((amount / unitPrice) * 100) / 100;
      if (!unitPrice && amount && qty) unitPrice = Math.round((amount / qty) * 100) / 100;
      return this.repo.create({
        date: r.date ?? r.dateOperation ?? r['date operation'] ?? null,
        vehicleCode: r.vehicule ?? r.vehicle ?? r.vehicleCode ?? null,
        cardNumber: r.carte ?? r.card ?? r.cardNumber ?? null,
        driverCode: r.chauffeur ?? r.driver ?? r.driverCode ?? null,
        fuelType,
        amount,
        qty: qty ?? null,
        unitPrice: unitPrice ?? null,
        kmEnd: num(r.km ?? r.kmEnd),
        source: 'import',
        closed: false,
      });
    });
    await this.repo.save(rows);
    return { imported: rows.length };
  }
}
