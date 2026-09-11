import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { parse } from 'csv-parse/sync';
import { PecRequest } from './pec-requests.entity';
import { Mission } from '../missions/missions.entity';
import { MissionService } from '../missions/missions.service';
import { AppConfigService } from '../app-config/app-config.service';
import { MailService } from '../mail/mail.service';
import { gpsMatrix, dzGeo } from '../common/dz-geo';

function normCity(name: string, keys: string[]): string | null {
  const sl = (name || '').trim().toLowerCase();
  let best: string | null = null;
  let bestLen = 0;
  for (const k of keys) {
    const kl = k.toLowerCase();
    if (sl === kl) return k;
    if (sl.includes(kl) && kl.length > bestLen) { best = k; bestLen = kl.length; }
  }
  return best;
}
function distanceKm(a: string, b: string): number | null {
  if (!a || !b) return null;
  const ka = normCity(a, Object.keys(gpsMatrix));
  const kb = normCity(b, Object.keys(gpsMatrix));
  if (ka && kb && gpsMatrix[ka]?.[kb] != null) return gpsMatrix[ka][kb];
  if (ka && kb && gpsMatrix[kb]?.[ka] != null) return gpsMatrix[kb][ka];
  const ga = normCity(a, Object.keys(dzGeo));
  const gb = normCity(b, Object.keys(dzGeo));
  if (ga && gb) {
    const ca = dzGeo[ga]; const cb = dzGeo[gb];
    const R = 6371; const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(cb.lat - ca.lat); const dLon = toRad(cb.lon - ca.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(ca.lat)) * Math.cos(toRad(cb.lat)) * Math.sin(dLon / 2) ** 2;
    return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)) * 1.3);
  }
  return null;
}

@Injectable()
export class PecRequestService {
  constructor(
    @InjectRepository(PecRequest) private readonly repo: Repository<PecRequest>,
    @InjectRepository(Mission) private readonly missions: Repository<Mission>,
    private readonly missionService: MissionService,
    private readonly config: AppConfigService,
    private readonly mail: MailService,
  ) {}

  findAll(): Promise<PecRequest[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string): Promise<PecRequest> {
    const row = await this.repo.findOne({ where: { id: id as never } });
    if (!row) throw new NotFoundException('PecRequest ' + id + ' introuvable');
    return row;
  }

  private async nextRef(): Promise<string> {
    const y = new Date().getFullYear();
    const n = (await this.repo.count()) + 1;
    return `PEC-${y}-${String(n).padStart(4, '0')}`;
  }

  /** Soumission publique (aucun compte). */
  async submit(data: Partial<PecRequest>, source = 'public'): Promise<PecRequest> {
    if (!data.requesterName || !data.fromLoc || !data.toLoc) {
      throw new BadRequestException('Nom, lieu de départ et destination sont obligatoires');
    }
    const row = this.repo.create({
      ...data,
      ref: await this.nextRef(),
      source,
      status: 'nouvelle',
      distanceKm: distanceKm(data.fromLoc ?? '', data.toLoc ?? ''),
    });
    const saved = await this.repo.save(row);
    if (saved.email) {
      await this.mail.send({
        to: saved.email,
        subject: `Demande de prise en charge ${saved.ref} enregistrée`,
        text: `Bonjour ${saved.requesterName},\n\nVotre demande (${saved.fromLoc} → ${saved.toLoc}) a bien été reçue sous la référence ${saved.ref}. La logistique Amimer Logistique reviendra vers vous.`,
      });
    }
    return saved;
  }

  /**
   * Import récurrent depuis Amimer Énergie (CSV ou tableau JSON).
   * Colonnes CSV souples : requesterName,phone,email,organisation,structure,fromLoc,toLoc,dateAller,dateRetour,pax
   */
  async import(body: { csv?: string; rows?: any[] }): Promise<{ imported: number }> {
    let records: any[] = [];
    if (body.csv) records = parse(body.csv, { columns: true, skip_empty_lines: true, trim: true, bom: true });
    else if (Array.isArray(body.rows)) records = body.rows;
    let imported = 0;
    for (const r of records) {
      await this.submit({
        requesterName: r.requesterName ?? r.nom ?? r.name,
        phone: r.phone ?? r.tel ?? null,
        email: r.email ?? null,
        organisation: r.organisation ?? r.org ?? 'Amimer Énergie',
        structure: r.structure ?? null,
        fromLoc: r.fromLoc ?? r.depart ?? r.from,
        toLoc: r.toLoc ?? r.destination ?? r.to,
        dateAller: r.dateAller ?? r.date ?? null,
        dateRetour: r.dateRetour ?? null,
        pax: r.pax ? Number(r.pax) : null,
      }, 'amimer_energie').then(() => { imported += 1; }).catch(() => {});
    }
    return { imported };
  }

  async update(id: string, data: Partial<PecRequest>): Promise<PecRequest> {
    const row = await this.findOne(id);
    Object.assign(row, data);
    return this.repo.save(row);
  }

  /** Validation logistique : calcule le frais applicable selon le lieu de travail + rayon. */
  async validate(id: string, workLocation?: string): Promise<PecRequest> {
    const row = await this.findOne(id);
    const rules = ((await this.config.get('FRAIS_RULES')) as { defaultRadiusKm: number; byLocation?: Record<string, number> }) ?? { defaultRadiusKm: 50 };
    const base = workLocation ?? row.workLocation ?? 'Alger';
    const radius = rules.byLocation?.[base] ?? rules.defaultRadiusKm ?? 50;
    const d = distanceKm(base, row.toLoc ?? '') ?? row.distanceKm ?? 0;
    row.workLocation = base;
    row.distanceKm = d;
    row.fraisApplicable = d > radius;
    row.status = 'validee';
    return this.repo.save(row);
  }

  /** Transformation en mission (file logistique unique). */
  async toMission(id: string, extra: Partial<Mission> = {}): Promise<{ request: PecRequest; mission: Mission }> {
    const row = await this.findOne(id);
    const y = new Date().getFullYear();
    const num = `M-${y}-${String((await this.missions.count()) + 1).padStart(4, '0')}`;
    const mission = await this.missionService.create({
      num,
      fromLoc: row.fromLoc,
      toLoc: row.toLoc,
      dateStart: row.dateAller ?? new Date().toISOString().slice(0, 10),
      dateEnd: row.dateRetour ?? row.dateAller ?? null,
      status: 'PLANIFIEE',
      type: 'PEC',
      requiredQual: 'Transport Personnes',
      qualityCriteria: 'produits sensibles',
      fraisApplicable: row.fraisApplicable ?? null,
      fraisConfirmed: false,
      officeValidated: false,     // mission planifiee A VALIDER par la logistique
      driverAccepted: false,
      pecRef: row.ref,
      note: `PEC ${row.ref} — ${row.organisation ?? ''} / ${row.requesterName ?? ''} (${row.pax ?? '?'} pax)`,
      ...extra,
    } as Partial<Mission>);
    row.status = 'en_mission';
    row.missionRef = num;
    await this.repo.save(row);
    return { request: row, mission };
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
