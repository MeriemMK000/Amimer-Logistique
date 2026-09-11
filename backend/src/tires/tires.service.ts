import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tire } from './tire.entity';
import { TireMovement } from './tire-movement.entity';
import { requireFields } from '../common/require-fields';

@Injectable()
export class TiresService {
  constructor(
    @InjectRepository(Tire) private readonly tires: Repository<Tire>,
    @InjectRepository(TireMovement) private readonly moves: Repository<TireMovement>,
  ) {}

  findAll() {
    return this.tires.find({ order: { createdAt: 'DESC' } });
  }
  findOne(id: string) {
    return this.tires.findOne({ where: { id } });
  }
  movements(tireId?: string) {
    return this.moves.find({ where: tireId ? { tireId } : {}, order: { date: 'DESC', createdAt: 'DESC' } });
  }

  /** Entree en stock a l'achat. */
  async create(data: Partial<Tire>): Promise<Tire> {
    requireFields(data as Record<string, unknown>, [
      { key: 'reference', label: 'référence' },
      { key: 'dimensions', label: 'dimensions' },
    ]);
    const t = await this.tires.save(this.tires.create({ status: 'stock', ...data }));
    await this.moves.save(
      this.moves.create({
        tireId: t.id, type: 'achat', date: t.purchaseDate ?? new Date().toISOString().slice(0, 10),
        note: 'Entree en stock',
      }),
    );
    return t;
  }

  async update(id: string, data: Partial<Tire>): Promise<Tire> {
    const t = await this.findOne(id);
    if (!t) throw new NotFoundException('Pneu introuvable');
    Object.assign(t, data);
    return this.tires.save(t);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    const t = await this.findOne(id);
    if (!t) throw new NotFoundException('Pneu introuvable');
    const nb = await this.moves.count({ where: { tireId: id } });
    if (nb > 1) throw new BadRequestException('Ce pneu a un historique de mouvements et ne peut pas etre supprime.');
    await this.moves.delete({ tireId: id });
    await this.tires.delete(id);
    return { deleted: true };
  }

  /**
   * Enregistre un mouvement et met a jour l'etat du pneu.
   *  - montage  : stock -> monte (toVehicle, position, mountKm)
   *  - depose   : monte -> depose (fromVehicle libere)
   *  - transfert: monte -> monte (fromVehicle -> toVehicle)
   *  - rebut    : -> rebut
   */
  async move(
    tireId: string,
    m: { type: string; toVehicle?: string; fromVehicle?: string; position?: string; km?: number; date?: string; signedBy?: string; attachmentId?: string; note?: string; replacedTireId?: string },
  ): Promise<TireMovement> {
    const t = await this.findOne(tireId);
    if (!t) throw new NotFoundException('Pneu introuvable');
    if (!m.type) throw new BadRequestException('Type de mouvement obligatoire.');
    if ((m.type === 'montage' || m.type === 'transfert') && (!m.toVehicle || !m.position)) {
      throw new BadRequestException('Montage / transfert : véhicule de destination et position obligatoires.');
    }
    const date = m.date ?? new Date().toISOString().slice(0, 10);
    const from = m.fromVehicle ?? t.currentVehicle ?? null;

    // Montage / transfert avec pneu remplacé : on dépose l'ancien pneu.
    let replacedRef: string | null = null;
    if ((m.type === 'montage' || m.type === 'transfert') && m.replacedTireId) {
      const old = await this.findOne(m.replacedTireId);
      if (old) {
        replacedRef = old.reference ?? old.id;
        old.status = 'depose';
        old.currentVehicle = null;
        old.position = null;
        await this.tires.save(old);
        await this.moves.save(this.moves.create({
          tireId: old.id, type: 'depose', fromVehicle: m.toVehicle ?? null, position: m.position ?? null,
          km: m.km ?? null, date, note: `Déposé — remplacé par ${t.reference ?? t.id}`,
        }));
      }
    }

    if (m.type === 'montage') {
      if (!m.toVehicle) throw new BadRequestException('Vehicule de destination requis');
      t.status = 'monte';
      t.currentVehicle = m.toVehicle;
      t.position = m.position ?? null;
      t.mountKm = m.km ?? null;
      t.mountDate = date;
    } else if (m.type === 'depose') {
      t.status = 'depose';
      t.currentVehicle = null;
      t.position = null;
    } else if (m.type === 'transfert') {
      if (!m.toVehicle) throw new BadRequestException('Vehicule de destination requis');
      t.status = 'monte';
      t.currentVehicle = m.toVehicle;
      t.position = m.position ?? t.position;
      t.mountKm = m.km ?? t.mountKm;
      t.mountDate = date;
    } else if (m.type === 'rebut') {
      t.status = 'rebut';
      t.currentVehicle = null;
      t.position = null;
    }
    await this.tires.save(t);

    // montage / transfert : le detenteur du vehicule concerne doit valider.
    const needsHolder = m.type === 'montage' || m.type === 'transfert';
    return this.moves.save(
      this.moves.create({
        tireId, type: m.type, fromVehicle: from, toVehicle: m.toVehicle ?? null,
        position: m.position ?? null, km: m.km ?? null, date,
        signedBy: m.signedBy ?? null, attachmentId: m.attachmentId ?? null,
        note: replacedRef ? `${m.note ? m.note + ' · ' : ''}Remplace ${replacedRef}` : (m.note ?? null),
        replacedTireId: m.replacedTireId ?? null,
        holderValidated: needsHolder ? false : null,
      }),
    );
  }

  /** Montage groupé des pneus à la mise en service d'un véhicule (retour DG). */
  async mountSet(
    vehicleCode: string,
    tires: { position: string; reference: string; serialNumber?: string; brand?: string; dimensions?: string; km?: number }[],
  ): Promise<{ mounted: number }> {
    let mounted = 0;
    for (const spec of tires) {
      if (!spec.reference?.trim()) continue;
      const t = await this.tires.save(this.tires.create({
        status: 'stock', reference: spec.reference.trim(),
        serialNumber: spec.serialNumber?.trim() || null,
        brand: spec.brand?.trim() || null, dimensions: spec.dimensions?.trim() || null,
        purchaseDate: new Date().toISOString().slice(0, 10),
      }));
      await this.moves.save(this.moves.create({ tireId: t.id, type: 'achat', date: t.purchaseDate ?? undefined, note: 'Entrée en stock (mise en service véhicule)' }));
      await this.move(t.id, { type: 'montage', toVehicle: vehicleCode, position: spec.position, km: spec.km, note: 'Montage initial — mise en service' });
      mounted++;
    }
    return { mounted };
  }

  /** Validation d'un mouvement de pneu (montage / transfert) par le detenteur du vehicule. */
  async holderValidateMovement(id: string, by?: string): Promise<TireMovement> {
    const mv = await this.moves.findOne({ where: { id } });
    if (!mv) throw new NotFoundException('Mouvement introuvable');
    mv.holderValidated = true;
    mv.holderValidatedAt = new Date().toISOString();
    mv.holderValidatedBy = by ?? null;
    return this.moves.save(mv);
  }

  /** Vue inventaire : stock, montes par vehicule. */
  async inventory() {
    const all = await this.tires.find();
    const byVehicle: Record<string, Tire[]> = {};
    const stock: Tire[] = [];
    for (const t of all) {
      if (t.status === 'monte' && t.currentVehicle) (byVehicle[t.currentVehicle] ??= []).push(t);
      else if (t.status === 'stock') stock.push(t);
    }
    return {
      stockCount: stock.length,
      stock,
      byVehicle,
      deposeCount: all.filter((t) => t.status === 'depose').length,
      rebutCount: all.filter((t) => t.status === 'rebut').length,
    };
  }
}
