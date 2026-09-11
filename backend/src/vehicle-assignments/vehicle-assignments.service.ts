import { Injectable, NotFoundException } from '@nestjs/common';
import { DependencyService } from '../common/dependency.service';
import { requireFields } from '../common/require-fields';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { VehicleAssignment } from './vehicle-assignments.entity';
import { Driver } from '../drivers/drivers.entity';
import { Vehicle } from '../vehicles/vehicles.entity';

/** Nature du centre analytique déduite des champs de destination de l'affectation. */
function deriveCostCenterKind(a: Partial<VehicleAssignment>): 'site' | 'person' | 'bu' {
  if (a.siteCode) return 'site';
  if (a.assigneeName) return 'person';
  return 'bu';
}

@Injectable()
export class VehicleAssignmentService {
  constructor(
    @InjectRepository(VehicleAssignment)
    private readonly repo: Repository<VehicleAssignment>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    private readonly dependency: DependencyService,
  ) {}

  findAll(): Promise<VehicleAssignment[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<VehicleAssignment> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('VehicleAssignment ' + id + ' introuvable');
    return row;
  }

  create(data: Partial<VehicleAssignment>): Promise<VehicleAssignment> {
    requireFields(data as Record<string, unknown>, [
      { key: 'vehicleCode', label: 'véhicule' },
      { key: '_dest', label: 'responsable ou site/chantier', oneOf: ['assigneeName', 'siteCode', 'businessUnit'] },
      // Retour DG : le rattachement analytique est obligatoire (calcul de refacturation).
      { key: 'businessUnit', label: 'Business Unit' },
      { key: 'costCenter', label: 'centre de coût' },
    ]);
    const payload: Partial<VehicleAssignment> = {
      ...data,
      // Retour DG : on marque explicitement que le centre analytique EST le site.
      costCenterKind: data.costCenterKind ?? deriveCostCenterKind(data),
      // « Affectation site = ordre de mission comme les autres » → jeton de vérif dès la création.
      verifyToken: data.verifyToken ?? randomBytes(9).toString('hex'),
    };
    return this.repo.save(this.repo.create(payload));
  }

  async update(id: string, data: Partial<VehicleAssignment>): Promise<VehicleAssignment> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    // Si la destination change et que la nature n'est pas forcée à la main → on la redéduit.
    if (('siteCode' in data || 'assigneeName' in data || 'businessUnit' in data) && !('costCenterKind' in data)) {
      row.costCenterKind = deriveCostCenterKind(row);
    }
    if (!row.verifyToken) row.verifyToken = randomBytes(9).toString('hex');
    return this.repo.save(row);
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('vehicle-assignments', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  /**
   * Ordre de mission de l'affectation (retour DG : « affectation site c un ordre mission comme
   * lui comme les autres »). Document imprimable + QR → page publique /verify/affectation/<token>.
   * Ne crée PAS de mission séparée : l'affectation EST l'ordre.
   */
  async ordreDeMission(id: string, publicBaseUrl?: string): Promise<Record<string, unknown>> {
    const a = await this.findOne(id);
    if (!a.verifyToken) {
      a.verifyToken = randomBytes(9).toString('hex');
      await this.repo.save(a);
    }
    if (!a.ordreEmisAt) {
      a.ordreEmisAt = new Date().toISOString().slice(0, 10);
      await this.repo.save(a);
    }
    const dr = a.driverCode ? await this.drivers.findOne({ where: { code: a.driverCode as never } }) : null;
    const vh = a.vehicleCode ? await this.vehicles.findOne({ where: { code: a.vehicleCode as never } }) : null;
    const base = publicBaseUrl || 'http://localhost:3000';
    const verifyUrl = `${base}/verify/affectation/${a.verifyToken}`;
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160 });
    const kind = a.costCenterKind ?? deriveCostCenterKind(a);
    return {
      num: `AFF-${a.id.slice(0, 8).toUpperCase()}`,
      type: 'affectation',
      purpose: a.purpose || (kind === 'site' ? 'Mise à disposition chantier' : 'Affectation véhicule'),
      driver: dr ? { code: dr.code, name: dr.name, phone: dr.phone, license: dr.license } : (a.driverCode ? { code: a.driverCode } : null),
      vehicle: vh ? { code: vh.code, brand: vh.brand, model: vh.model, plate: vh.plate, type: vh.type } : { code: a.vehicleCode },
      withDriver: !!a.withDriver,
      site: a.siteCode,
      assigneeName: a.assigneeName,
      structure: a.structure,
      dateStart: a.dateStart,
      dateEnd: a.dateEnd,
      kindLabel: a.kind === 'permanent' ? 'Permanente' : 'Période / chantier',
      costCenterKind: kind,
      costCenterKindLabel: kind === 'site' ? 'Site / Chantier' : kind === 'person' ? 'Personne / Structure' : 'Business Unit',
      costCenterLabel: kind === 'site' ? (a.siteCode ?? '—')
        : kind === 'person' ? [a.assigneeName, a.structure].filter(Boolean).join(' — ')
          : [a.businessUnit, a.costCenter].filter(Boolean).join(' / ') || '—',
      businessUnit: a.businessUnit,
      costCenter: a.costCenter,
      controlType: a.controlType,
      vehicleMonthlyCost: a.vehicleMonthlyCost,
      fuelCardNumber: a.fuelCardNumber,
      monthlyFuelCap: a.monthlyFuelCap,
      note: a.note,
      ordreEmisAt: a.ordreEmisAt,
      qr, verifyUrl,
    };
  }

  /** Vérification publique du QR de l'ordre de mission d'affectation. */
  async verify(token: string): Promise<{ valid: boolean; affectation?: Record<string, unknown> }> {
    const a = await this.repo.findOne({ where: { verifyToken: token as never } });
    if (!a) return { valid: false };
    const dr = a.driverCode ? await this.drivers.findOne({ where: { code: a.driverCode as never } }) : null;
    const vh = a.vehicleCode ? await this.vehicles.findOne({ where: { code: a.vehicleCode as never } }) : null;
    const kind = a.costCenterKind ?? deriveCostCenterKind(a);
    return {
      valid: true,
      affectation: {
        num: `AFF-${a.id.slice(0, 8).toUpperCase()}`,
        vehicleCode: vh ? `${vh.code} — ${vh.brand ?? ''} ${vh.model ?? ''}`.trim() : a.vehicleCode,
        driverCode: dr ? `${dr.code} — ${dr.name}` : (a.withDriver ? (a.driverCode ?? 'avec chauffeur') : 'sans chauffeur'),
        site: a.siteCode ?? '—',
        centreAnalytique: kind === 'site' ? `Site — ${a.siteCode ?? '—'}`
          : kind === 'person' ? [a.assigneeName, a.structure].filter(Boolean).join(' — ')
            : [a.businessUnit, a.costCenter].filter(Boolean).join(' / ') || '—',
        periode: `${a.dateStart ?? '—'} → ${a.dateEnd ?? '…'}`,
        ordreEmisAt: a.ordreEmisAt ?? '—',
      },
    };
  }
}
