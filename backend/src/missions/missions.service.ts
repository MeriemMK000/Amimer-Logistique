import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DependencyService } from '../common/dependency.service';
import { legSum, roadDistance } from '../common/dz-geo';
import { requireFields } from '../common/require-fields';
import { DpcRequest } from '../dpc-requests/dpc-requests.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { Mission } from './missions.entity';
import { Driver } from '../drivers/drivers.entity';
import { Vehicle } from '../vehicles/vehicles.entity';
import { Alert } from '../alerts/alerts.entity';
import { PecRequest } from '../pec-requests/pec-requests.entity';
import { AppConfigService } from '../app-config/app-config.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GeoService } from '../geo/geo.service';

// Distance haversine simple (km) — utilisee pour la regle frais (rayon lieu de travail).
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

interface FraisRules {
  defaultRadiusKm: number;
  byLocation?: Record<string, number>;
}

@Injectable()
export class MissionService implements OnModuleInit {
  private readonly logger = new Logger(MissionService.name);

  async onModuleInit(): Promise<void> {
    try { await this.refreshClotureSuggestions(); } catch { /* base pas encore prête */ }
  }
  constructor(
    @InjectRepository(Mission) private readonly repo: Repository<Mission>,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Vehicle) private readonly vehicles: Repository<Vehicle>,
    @InjectRepository(Alert) private readonly alerts: Repository<Alert>,
    @InjectRepository(DpcRequest) private readonly dpc: Repository<DpcRequest>,
    @InjectRepository(PecRequest) private readonly pec: Repository<PecRequest>,
    private readonly dependency: DependencyService,
    private readonly config: AppConfigService,
    private readonly notifications: NotificationsService,
    private readonly geo: GeoService,
  ) {}

  private fmtDate(d: string | null, t: string | null): string {
    if (!d) return '—';
    return t ? `${d} à ${t}` : d;
  }

  /**
   * Distances calculées sur les points EXACTS de l'itinéraire (retour DG : précision adresse).
   * `routeGeo.from` / `.to` = points précis ; les étapes (noms) sont géocodées via le référentiel.
   */
  private async applyGeoDistances(m: Partial<Mission>): Promise<void> {
    const g = m.routeGeo;
    const ok = (p?: { lat: number; lon: number } | null) => !!p && Number.isFinite(p.lat) && Number.isFinite(p.lon);
    if (!g || (!ok(g.from) && !ok(g.to))) return;
    const wp = (m.waypoints as string[]) ?? [];
    const wpRet = (m.waypointsRet as string[]) ?? [];
    const aller = await this.geo.routeNamed([ok(g.from) ? g.from! : (m.fromLoc ?? ''), ...wp, ok(g.to) ? g.to! : (m.toLoc ?? '')]);
    if (aller.km <= 0) return;
    const ret = m.retType ?? 'symetrique';
    let dRetour = aller.km;
    if (ret === 'aucun') dRetour = 0;
    else if (ret === 'different') {
      const r = await this.geo.routeNamed([ok(g.to) ? g.to! : (m.toLoc ?? ''), ...wpRet, ok(g.from) ? g.from! : (m.fromLoc ?? '')]);
      dRetour = r.km || aller.km;
    }
    m.dAller = aller.km;
    m.dRetour = dRetour;
    m.distance = aller.km + dRetour;
    m.routeGeo = { ...g, source: aller.source };
  }

  /**
   * Distance depuis les LIBELLÉS de lieux, résolus via le référentiel `places` (1500+ communes,
   * retour DG). Utilisée quand le client n'a pas fourni de km explicite ni de points géolocalisés.
   */
  private async applyNamedGeoDistances(m: Partial<Mission>): Promise<void> {
    if (!m.fromLoc || !m.toLoc) return;
    const wp = (m.waypoints as string[]) ?? [];
    const wpRet = (m.waypointsRet as string[]) ?? [];
    const aller = await this.geo.routeNamed([m.fromLoc, ...wp, m.toLoc]);
    if (aller.km <= 0) return;
    const ret = m.retType ?? 'symetrique';
    let dRetour = aller.km;
    if (ret === 'aucun') dRetour = 0;
    else if (ret === 'different') {
      const r = await this.geo.routeNamed([m.toLoc, ...wpRet, m.fromLoc]);
      dRetour = r.km || aller.km;
    }
    m.dAller = aller.km;
    m.dRetour = dRetour;
    m.distance = aller.km + dRetour;
    // Renseigne les coordonnées résolues → la carte de la mission peut tracer l'itinéraire.
    const [gFrom, gTo] = await Promise.all([this.geo.geocode(m.fromLoc), this.geo.geocode(m.toLoc)]);
    if (gFrom && gTo) {
      const wpGeo = (await Promise.all(wp.map((w) => this.geo.geocode(w))))
        .filter((g): g is NonNullable<typeof g> => !!g)
        .map((g) => ({ name: g.name, lat: g.lat, lon: g.lon }));
      m.routeGeo = {
        from: { name: gFrom.name, lat: gFrom.lat, lon: gFrom.lon },
        to: { name: gTo.name, lat: gTo.lat, lon: gTo.lon },
        waypoints: wpGeo,
        source: aller.source,
      };
    }
  }

  /** Notifie le(s) demandeur(s) d'une mission (via ses DPC / sa PEC). */
  private async notifyRequesters(m: Mission, kind: string, subject: string, body: string): Promise<void> {
    const codes = [...new Set([...(m.dpcRefs ?? []), m.dpcRef].filter(Boolean) as string[])];
    const targets: { name: string | null; email: string | null; phone: string | null }[] = [];
    for (const code of codes) {
      const d = await this.dpc.findOne({ where: { code: code as never } });
      if (d && (d.demandeur || d.demandeurEmail)) targets.push({ name: d.demandeur, email: d.demandeurEmail, phone: d.demandeurTel });
    }
    if (m.pecRef) {
      const p = await this.pec.findOne({ where: { ref: m.pecRef as never } });
      if (p && (p.requesterName || p.email)) targets.push({ name: p.requesterName, email: p.email, phone: p.phone });
    }
    // Dé-doublonnage par email/nom.
    const seen = new Set<string>();
    for (const t of targets) {
      const key = (t.email ?? t.name ?? '').toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      await this.notifications.notify({
        audience: 'requester', recipientName: t.name, recipientEmail: t.email, recipientPhone: t.phone,
        kind, subject, body, missionRef: m.num,
      });
    }
    // Toujours une trace côté logistique.
    await this.notifications.notify({ audience: 'office', kind, subject: `[${m.num}] ${subject}`, body, missionRef: m.num });
  }

  private missionSummary(m: Mission, dr: Driver | null, vh: Vehicle | null): string {
    const route = [m.fromLoc, ...((m.waypoints as string[]) ?? []), m.toLoc].filter(Boolean).join(' → ');
    return [
      `Mission ${m.num}`,
      `Itinéraire : ${route}`,
      `Départ : ${this.fmtDate(m.dateStart, m.timeStart)}`,
      `Retour prévu : ${this.fmtDate(m.dateEnd, m.timeEnd)}`,
      `Chauffeur : ${dr?.name ?? m.driverCode ?? '—'}${dr?.phone ? ` (${dr.phone})` : ''}`,
      `Véhicule : ${vh ? `${vh.code} ${vh.brand ?? ''} ${vh.model ?? ''}`.trim() : (m.vehicleCode ?? '—')}`,
      `Distance : ${m.distance ?? '—'} km`,
    ].join('\n');
  }

  /** Ordre de mission : donnees completes + QR code d'authenticite (data URL). */
  async ordreDeMission(id: string, publicBaseUrl?: string): Promise<Record<string, unknown>> {
    const m = await this.findOne(id);
    if (!m.verifyToken) {
      m.verifyToken = randomBytes(9).toString('hex');
      await this.repo.save(m);
    }
    const dr = m.driverCode ? await this.drivers.findOne({ where: { code: m.driverCode as never } }) : null;
    const vh = m.vehicleCode ? await this.vehicles.findOne({ where: { code: m.vehicleCode as never } }) : null;
    const base = publicBaseUrl || 'http://localhost:3000';
    const verifyUrl = `${base}/verify/mission/${m.verifyToken}`;
    const qr = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 160 });
    const d1 = m.dateStart ? new Date(`${m.dateStart}T${m.timeStart || '07:00'}`) : null;
    const d2 = m.dateEnd ? new Date(`${m.dateEnd}T${m.timeEnd || '17:00'}`) : null;
    const dureeH = d1 && d2 ? Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 3_600_000)) : null;
    return {
      num: m.num,
      driver: dr ? { code: dr.code, name: dr.name, phone: dr.phone, license: dr.license } : { code: m.driverCode },
      vehicle: vh ? { code: vh.code, brand: vh.brand, model: vh.model, plate: vh.plate } : { code: m.vehicleCode },
      fromLoc: m.fromLoc, toLoc: m.toLoc,
      waypoints: m.waypoints ?? [],
      dateStart: m.dateStart, timeStart: m.timeStart, dateEnd: m.dateEnd, timeEnd: m.timeEnd,
      dureeH, distance: m.distance, dAller: m.dAller, dRetour: m.dRetour,
      zone: m.zone, bu: m.bu, ca: m.ca, site: m.site,
      requiredQual: m.requiredQual, qualityCriteria: m.qualityCriteria,
      fraisApplicable: m.fraisApplicable,
      status: m.status, ordreEmisAt: m.ordreEmisAt, routeGeo: m.routeGeo ?? null,
      qr, verifyUrl,
    };
  }

  /** Tri : non demarrees (PLANIFIEE) d'abord, puis en cours, puis terminees/cloturees. */
  private orderKey(s: string | null): number {
    return { PLANIFIEE: 0, EN_COURS: 1, MODIFIEE: 1, TERMINEE: 2, CLOTUREE: 3, ANNULEE: 4 }[s ?? 'PLANIFIEE'] ?? 5;
  }

  async findAll(): Promise<Mission[]> {
    const all = await this.repo.find();
    return all.sort((a, b) => this.orderKey(a.status) - this.orderKey(b.status) || (b.dateStart ?? '').localeCompare(a.dateStart ?? ''));
  }

  async findOne(id: string): Promise<Mission> {
    const row = await this.repo.findOne({ where: { num: id as never } });
    if (!row) throw new NotFoundException('Mission ' + id + ' introuvable');
    return row;
  }

  /** Determine si la mission est concernee par des frais (distance depuis lieu de travail du chauffeur). */
  private async computeFraisApplicable(m: Partial<Mission>): Promise<boolean | null> {
    if (typeof m.fraisApplicable === 'boolean') return m.fraisApplicable; // override manuel respecte
    const dr = m.driverCode ? await this.drivers.findOne({ where: { code: m.driverCode as never } }) : null;
    const base = dr?.workLocation;
    if (!base || !m.toLoc) return null;
    const rules = ((await this.config.get('FRAIS_RULES')) as FraisRules) ?? { defaultRadiusKm: 50 };
    const radius = rules.byLocation?.[base] ?? rules.defaultRadiusKm ?? 50;
    const d = distanceKm(base, m.toLoc) ?? m.distance ?? 0;
    return d > radius;
  }

  /** Distances cohérentes : dAller + dRetour selon retType, distance = somme. */
  private normalizeDistances(m: Partial<Mission>): void {
    const ret = m.retType ?? 'symetrique';
    const wp = (m.waypoints as string[]) ?? [];
    // dAller : valeur envoyée par le formulaire (gpsCalc côté client) sinon somme des tronçons.
    const autoAller = legSum([m.fromLoc, ...wp, m.toLoc]);
    const dAller = Math.round(Number(m.dAller ?? m.distance ?? 0)) || autoAller;
    let dRetour: number;
    if (ret === 'aucun') { dRetour = 0; m.waypointsRet = []; }
    else if (ret === 'symetrique') { dRetour = dAller; m.waypointsRet = [...wp].reverse(); }
    else {
      const wpRet = (m.waypointsRet as string[]) ?? [];
      const autoRetour = legSum([m.toLoc, ...wpRet, m.fromLoc]);
      dRetour = Math.round(Number(m.dRetour ?? 0)) || autoRetour || dAller;
    }
    m.dAller = dAller;
    m.dRetour = dRetour;
    m.distance = dAller + dRetour;
  }

  /**
   * Regroupement de plusieurs demandes de prise en charge dans une même mission (retour DG).
   * Les points de dépose/reprise deviennent des étapes (aller + retour), ordonnés le long de l'axe ;
   * les coûts se répartissent par pax × km parcouru entre les BU/structures des demandes.
   */
  buildGrouping(dpcRows: DpcRequest[], base?: { fromLoc?: string | null; toLoc?: string | null }): {
    fromLoc: string; toLoc: string; waypoints: string[]; waypointsRet: string[]; retType: string;
    costSplit: Mission['costSplit']; bu: string | null; pax: number; tonnage: number;
  } | null {
    const norm = (s?: string | null) => (s ?? '').trim();
    const locs = new Set<string>();
    for (const d of dpcRows) { if (norm(d.depAller)) locs.add(norm(d.depAller)); if (norm(d.destAller)) locs.add(norm(d.destAller)); }
    if (base?.fromLoc && norm(base.fromLoc)) locs.add(norm(base.fromLoc));
    if (base?.toLoc && norm(base.toLoc)) locs.add(norm(base.toLoc));
    const list = [...locs];
    if (list.length < 2) return null;

    // Extrêmes = paire la plus éloignée.
    let from = list[0], to = list[1], maxD = -1;
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const dd = roadDistance(list[i], list[j]) ?? 0;
      if (dd > maxD) { maxD = dd; from = list[i]; to = list[j]; }
    }
    // Orienter : `from` = celui qui est un lieu de DÉPART pour le plus de demandes.
    const startCount = (loc: string) => dpcRows.filter((d) => norm(d.depAller) === loc).length;
    if (startCount(to) > startCount(from)) { const t = from; from = to; to = t; }

    const ordered = [...list].sort((a, b) => (roadDistance(from, a) ?? 0) - (roadDistance(from, b) ?? 0));
    const middle = ordered.filter((p) => p !== from && p !== to);
    const route = [from, ...middle, to];

    const anyReturn = dpcRows.some((d) => norm(d.dateRetour));
    const returnMiddle = middle.filter((p) => dpcRows.some((d) => norm(d.dateRetour) && (norm(d.depAller) === p || norm(d.destAller) === p)));
    const retType = anyReturn ? 'different' : 'aucun';
    const waypointsRet = anyReturn ? [...returnMiddle].reverse() : [];

    // Répartition des coûts : pax × km parcourus (×2 si aller-retour).
    const idx = (loc: string) => route.indexOf(loc);
    const rows = dpcRows.map((d) => {
      const i0 = idx(norm(d.depAller)), i1 = idx(norm(d.destAller));
      const seg = i0 >= 0 && i1 >= 0 ? legSum(route.slice(Math.min(i0, i1), Math.max(i0, i1) + 1)) : (roadDistance(norm(d.depAller), norm(d.destAller)) ?? 0);
      const roundTrip = !!norm(d.dateRetour);
      const pax = Math.max(1, d.pax ?? 1);
      const effKm = seg * (roundTrip ? 2 : 1);
      return { dpcCode: d.code, bu: d.bu ?? null, structure: d.structure ?? null, pax, segmentKm: seg, roundTrip, weight: pax * effKm };
    });
    const totW = rows.reduce((s, r) => s + r.weight, 0) || 1;
    const costSplit = rows.map((r) => ({
      dpcCode: r.dpcCode, bu: r.bu, structure: r.structure, pax: r.pax, segmentKm: r.segmentKm,
      roundTrip: r.roundTrip, sharePct: Math.round((r.weight / totW) * 1000) / 10,
    }));
    const dominant = [...costSplit].sort((a, b) => b.sharePct - a.sharePct)[0];

    // Pic de personnes à bord : sur chaque tronçon de l'itinéraire, somme des pax des demandes
    // qui l'occupent. On dimensionne le véhicule sur le tronçon le plus chargé.
    let peakPax = 0;
    let peakTon = 0;
    for (let L = 0; L < route.length - 1; L++) {
      let onBoardPax = 0;
      let onBoardTon = 0;
      for (const d of dpcRows) {
        const a = idx(norm(d.depAller)), b = idx(norm(d.destAller));
        if (a < 0 || b < 0) continue;
        if (L >= Math.min(a, b) && L < Math.max(a, b)) {
          // Pic de capacité : on compte les personnes réellement déclarées (0 = fret seul).
          onBoardPax += Number(d.pax) > 0 ? Number(d.pax) : 0;
          onBoardTon += Number(d.tonnage) > 0 ? Number(d.tonnage) : 0;
        }
      }
      if (onBoardPax > peakPax) peakPax = onBoardPax;
      if (onBoardTon > peakTon) peakTon = onBoardTon;
    }

    return { fromLoc: from, toLoc: to, waypoints: middle, waypointsRet, retType, costSplit, bu: dominant?.bu ?? null, pax: peakPax, tonnage: Math.round(peakTon * 100) / 100 };
  }

  /** Aperçu du regroupement (pour le formulaire mission) sans rien enregistrer. */
  async groupPreview(dpcCodes: string[], base?: { fromLoc?: string | null; toLoc?: string | null }): Promise<Record<string, unknown>> {
    const rows = await this.dpc.find({ where: dpcCodes.map((code) => ({ code })) as never });
    const g = this.buildGrouping(rows, base);
    if (!g) return { ok: false, message: 'Pas assez de lieux pour construire un trajet.' };
    const dAller = legSum([g.fromLoc, ...g.waypoints, g.toLoc]);
    const dRetour = g.retType === 'aucun' ? 0 : legSum([g.toLoc, ...g.waypointsRet, g.fromLoc]);
    // Véhicules du parc assez grands : assez de places ET assez de charge utile.
    const vehs = await this.vehicles.find();
    const fitVehicles = vehs
      .filter((v) => (v.seats == null || v.seats >= g.pax) && (v.maxTonnage == null || g.tonnage <= 0 || v.maxTonnage >= g.tonnage))
      .map((v) => v.code);
    return { ok: true, ...g, dAller, dRetour, distance: dAller + dRetour, dpc: rows, fitVehicles };
  }

  /** Applique le regroupement à une mission + passe les demandes en TRANSFORMEE. */
  private async applyGroupingToPayload(payload: Partial<Mission>, num: string): Promise<void> {
    const codes = (payload.dpcRefs ?? []).filter(Boolean);
    if (!codes.length) return;
    const rows = await this.dpc.find({ where: codes.map((code) => ({ code })) as never });
    if (!rows.length) return;
    const g = this.buildGrouping(rows, { fromLoc: payload.fromLoc, toLoc: payload.toLoc });
    if (g) {
      payload.fromLoc = g.fromLoc;
      payload.toLoc = g.toLoc;
      payload.waypoints = g.waypoints;
      payload.waypointsRet = g.waypointsRet;
      payload.retType = g.retType;
      // Répartition affichée seulement à partir de 2 demandes ; 1 demande = 100 % → pas de tableau.
      payload.costSplit = (g.costSplit?.length ?? 0) >= 2 ? g.costSplit : null;
      payload.bu = payload.bu ?? g.bu;
      if (g.pax > 0) payload.pax = g.pax;
      if (g.tonnage > 0) payload.tonnage = g.tonnage;
      payload.dAller = undefined as never;
      payload.dRetour = undefined as never;
      payload.distance = undefined as never;
    }
    payload.dpcRef = codes[0];
    for (const d of rows) {
      d.statut = 'TRANSFORMEE';
      d.missionRef = num;
      await this.dpc.save(d);
    }
  }

  /**
   * Contrôle de capacité du véhicule affecté : assez de places pour les personnes
   * ET assez de charge utile pour le tonnage requis (retour DG « nombre personne / tonnage »).
   */
  private async assertVehicleCapacity(vehicleCode?: string | null, pax?: number | null, tonnage?: number | null): Promise<void> {
    if (!vehicleCode) return;
    const need = Number(pax) || 0;
    const ton = Number(tonnage) || 0;
    if (need <= 0 && ton <= 0) return;
    const v = await this.vehicles.findOne({ where: { code: vehicleCode } as never });
    if (!v) return;
    const label = `${v.code} ${(v.brand ?? '').trim()} ${(v.model ?? '').trim()}`.trim();
    if (need > 0 && v.seats != null && need > v.seats) {
      throw new BadRequestException(`Capacité insuffisante : ${label} a ${v.seats} place(s), or la mission transporte ${need} personne(s) (tronçon le plus chargé). Choisir un véhicule plus grand.`);
    }
    if (ton > 0 && v.maxTonnage != null && ton > v.maxTonnage + 0.001) {
      throw new BadRequestException(`Tonnage insuffisant : ${label} a une charge utile de ${v.maxTonnage} t, or la mission nécessite ${ton} t. Choisir un véhicule plus lourd.`);
    }
  }

  /** N° de mission suivant : M-<année>-<compteur> (le client peut aussi l'imposer). */
  private async nextNum(): Promise<string> {
    const y = new Date().getFullYear();
    const all = await this.repo.find();
    const maxN = all.reduce((mx, m) => {
      const g = /(\d+)\s*$/.exec(m.num ?? '');
      return g ? Math.max(mx, parseInt(g[1], 10)) : mx;
    }, 0);
    return `M-${y}-${String(maxN + 1).padStart(4, '0')}`;
  }

  async create(data: Partial<Mission>): Promise<Mission> {
    const payload: Partial<Mission> = {
      ...data,
      num: data.num || (await this.nextNum()),
      retType: data.retType ?? 'symetrique',
      verifyToken: data.verifyToken ?? randomBytes(9).toString('hex'),
    };
    // Regroupement de demandes de prise en charge → recalcule trajet + répartition des coûts.
    if ((payload.dpcRefs ?? []).length) await this.applyGroupingToPayload(payload, payload.num ?? '');
    await this.assertVehicleCapacity(payload.vehicleCode, payload.pax, payload.tonnage);
    requireFields(payload as Record<string, unknown>, [
      { key: 'fromLoc', label: 'lieu de départ' },
      { key: 'toLoc', label: 'lieu d’arrivée' },
      { key: 'dateStart', label: 'date de départ' },
      { key: 'vehicleCode', label: 'véhicule' },
      { key: 'driverCode', label: 'chauffeur' },
    ]);
    this.normalizeDistances(payload);
    // Distance : points géolocalisés (OSRM) sinon libellés résolus via le référentiel `places`
    // (1500+ communes) — uniquement si le client n'a pas fourni de km explicite.
    if (data.dAller == null) {
      if (payload.routeGeo) await this.applyGeoDistances(payload);
      else await this.applyNamedGeoDistances(payload);
    }
    payload.fraisApplicable = await this.computeFraisApplicable(payload);
    return this.repo.save(this.repo.create(payload));
  }

  async update(id: string, data: Partial<Mission>): Promise<Mission> {
    const row = await this.findOne(id);
    // Mission clôturée = figée (retour DG). On tolère seulement l'annulation explicite d'une clôture.
    if (row.status === 'CLOTUREE' && data.status !== 'ANNULEE') {
      throw new ConflictException('Mission clôturée — modification impossible.');
    }
    Object.assign(row, data);
    // Regroupement de demandes modifié → recalcule trajet + répartition.
    if (data.dpcRefs !== undefined) await this.applyGroupingToPayload(row, row.num);
    if (data.vehicleCode !== undefined || data.pax !== undefined || data.tonnage !== undefined || data.dpcRefs !== undefined) {
      await this.assertVehicleCapacity(row.vehicleCode, row.pax, row.tonnage);
    }
    // Une mission active ne peut pas rester sans véhicule / chauffeur (retour DG).
    if (row.status !== 'ANNULEE' && (!row.vehicleCode || !row.driverCode || !row.fromLoc || !row.toLoc)) {
      const miss = [!row.fromLoc && 'lieu de départ', !row.toLoc && 'lieu d’arrivée', !row.vehicleCode && 'véhicule', !row.driverCode && 'chauffeur'].filter(Boolean);
      throw new BadRequestException(`Mission incomplète — champs obligatoires : ${miss.join(', ')}.`);
    }
    if (data.dAller != null || data.dRetour != null || data.retType != null || data.waypoints != null
        || data.waypointsRet != null || data.distance != null || data.fromLoc != null || data.toLoc != null
        || data.dpcRefs !== undefined) {
      // Si les lieux/étapes changent sans dAller explicite → recalcul depuis l'itinéraire.
      if (data.dAller == null && (data.fromLoc != null || data.toLoc != null || data.waypoints != null || data.waypointsRet != null)) {
        row.dAller = undefined as never;
        row.dRetour = undefined as never;
        row.distance = undefined as never;
      }
      this.normalizeDistances(row);
    }
    if ((data.routeGeo !== undefined || data.fromLoc != null || data.toLoc != null || data.waypoints != null || data.waypointsRet != null || data.retType != null)
        && data.dAller == null) {
      if (row.routeGeo) await this.applyGeoDistances(row);
      else await this.applyNamedGeoDistances(row);
    }
    if (data.driverCode !== undefined || data.toLoc !== undefined || data.fraisApplicable !== undefined) {
      row.fraisApplicable = await this.computeFraisApplicable(row);
    }
    const saved = await this.repo.save(row);
    // Changement majeur sur une mission déjà validée → on ré-informe le demandeur (retour DG).
    const majorChange = ['driverCode', 'vehicleCode', 'dateStart', 'timeStart', 'fromLoc', 'toLoc'].some((k) => k in data);
    if (saved.officeValidated && saved.status !== 'CLOTUREE' && majorChange) {
      const dr = saved.driverCode ? await this.drivers.findOne({ where: { code: saved.driverCode as never } }) : null;
      const vh = saved.vehicleCode ? await this.vehicles.findOne({ where: { code: saved.vehicleCode as never } }) : null;
      await this.notifyRequesters(saved, 'mission_modifiee',
        `Mission ${saved.num} — mise à jour`,
        `Votre mission a été modifiée.\n\n${this.missionSummary(saved, dr, vh)}`);
    }
    return saved;
  }

  /**
   * Clôture d'une mission (retour DG) : passe en CLOTUREE, fige les frais (confirmés à la
   * clôture uniquement), retire la suggestion de clôture. `frais` = payload calculé côté front.
   */
  async cloturer(
    id: string,
    frais?: { frais?: number; fraisDetail?: unknown; fraisCat?: string; fraisZone?: string },
  ): Promise<Mission> {
    const row = await this.findOne(id);
    if (row.status === 'CLOTUREE') return row;
    if (row.status === 'PLANIFIEE') {
      throw new ConflictException('Une mission planifiée ne peut pas être clôturée (démarrer / terminer d\'abord).');
    }
    row.status = 'CLOTUREE';
    row.closed = true;
    row.clotureSuggested = false;
    row.fraisConfirmed = true;
    row.fraisDateConfirm = new Date().toISOString().slice(0, 10);
    if (frais) {
      if (frais.frais != null) row.frais = Math.round(frais.frais);
      if (frais.fraisDetail != null) row.fraisDetail = frais.fraisDetail;
      if (frais.fraisCat != null) row.fraisCat = frais.fraisCat;
      if (frais.fraisZone != null) row.fraisZone = frais.fraisZone;
    }
    return this.repo.save(row);
  }

  /** Clôture en masse : toutes les missions réellement terminées (retour DG — bouton onglet Frais). */
  async cloturerTerminees(
    fraisByNum?: Record<string, { frais?: number; fraisDetail?: unknown; fraisCat?: string; fraisZone?: string }>,
  ): Promise<{ closed: number; nums: string[] }> {
    const list = await this.repo.find();
    const toClose = list.filter((m) => m.status === 'TERMINEE');
    for (const m of toClose) await this.cloturer(m.num, fraisByNum?.[m.num]);
    return { closed: toClose.length, nums: toClose.map((m) => m.num) };
  }

  /**
   * Cron quotidien : à J+1 de la date de fin théorique, propose la clôture des missions
   * non clôturées (EN_COURS ou TERMINEE) + lève une alerte.
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshClotureSuggestions(): Promise<{ suggested: number }> {
    const list = await this.repo.find();
    const cutoff = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10); // hier
    let suggested = 0;
    for (const m of list) {
      const overdue =
        ['EN_COURS', 'TERMINEE'].includes(m.status ?? '') &&
        !!m.dateEnd && m.dateEnd < cutoff;
      if (overdue && !m.clotureSuggested) {
        m.clotureSuggested = true;
        await this.repo.save(m);
        suggested++;
      } else if (!overdue && m.clotureSuggested) {
        m.clotureSuggested = false;
        await this.repo.save(m);
      }
    }
    const overdueNums = list
      .filter((m) => ['EN_COURS', 'TERMINEE'].includes(m.status ?? '') && !!m.dateEnd && m.dateEnd < cutoff)
      .map((m) => m.num);
    const title = 'Missions à clôturer — fin théorique dépassée';
    const existing = await this.alerts.findOne({ where: { title, category: 'mission' } });
    if (overdueNums.length) {
      const desc = `${overdueNums.length} mission(s) au-delà de leur date de fin théorique (J+1) : ${overdueNums.join(', ')}. Proposer la clôture.`;
      if (existing) { existing.description = desc; existing.priority = 'HAUTE'; await this.alerts.save(existing); }
      else await this.alerts.save(this.alerts.create({ type: 'wr', title, description: desc, timeLabel: 'auto', category: 'mission', priority: 'HAUTE' }));
    } else if (existing) {
      await this.alerts.delete(existing.id);
    }
    if (suggested) this.logger.log(`${suggested} mission(s) proposée(s) à la clôture (J+1).`);
    return { suggested };
  }

  /** Demarrer / terminer via l'app chauffeur ou le back-office. */
  async setPhase(id: string, phase: 'start' | 'finish'): Promise<Mission> {
    const row = await this.findOne(id);
    if (row.status === 'CLOTUREE') throw new ConflictException('Mission clôturée — action impossible.');
    const now = new Date().toISOString();
    if (phase === 'start') {
      this.assertAnalytique(row, 'démarrer');
      row.status = 'EN_COURS';
      if (!row.startedAt) row.startedAt = now;
      // Ordre de mission émis au démarrage (retour DG) → transmis au chauffeur sur son app.
      if (!row.ordreEmisAt) {
        row.ordreEmisAt = now;
        if (!row.verifyToken) row.verifyToken = randomBytes(9).toString('hex');
        const saved = await this.repo.save(row);
        const dr = saved.driverCode ? await this.drivers.findOne({ where: { code: saved.driverCode as never } }) : null;
        const vh = saved.vehicleCode ? await this.vehicles.findOne({ where: { code: saved.vehicleCode as never } }) : null;
        await this.notifications.notify({
          audience: 'driver', recipientName: dr?.name ?? saved.driverCode, recipientPhone: dr?.phone,
          kind: 'ordre_emis', missionRef: saved.num,
          subject: `Ordre de mission ${saved.num} émis`,
          body: `L'ordre de mission est disponible sur votre application.\n\n${this.missionSummary(saved, dr, vh)}`,
        });
        return saved;
      }
    } else {
      row.status = 'TERMINEE';
      if (!row.finishedAt) row.finishedAt = now;
    }
    return this.repo.save(row);
  }

  /**
   * Rattachement analytique obligatoire (retour DG : « j'ai pu valider une mission sans centre
   * de coût ni BU »). Sans BU + centre de coût, aucun calcul de refacturation n'est possible.
   */
  private assertAnalytique(row: Mission, action: string): void {
    const miss = [!row.bu && 'Business Unit', !row.ca && 'centre de coût'].filter(Boolean);
    if (miss.length) {
      throw new BadRequestException(
        `Impossible de ${action} la mission ${row.num} : ${miss.join(' et ')} manquant(s). ` +
        'Le rattachement analytique (BU + centre de coût) est obligatoire pour la refacturation.',
      );
    }
  }

  /** Validation logistique d'une mission planifiee (obligatoire pour les missions issues d'une PEC). */
  async validateMission(id: string): Promise<Mission> {
    const row = await this.findOne(id);
    this.assertAnalytique(row, 'valider');
    const first = row.officeValidated !== true;
    row.officeValidated = true;
    row.officeValidatedAt = new Date().toISOString();
    const saved = await this.repo.save(row);
    // Retour DG : informer le demandeur dès que chauffeur + itinéraire sont confirmés.
    if (first) {
      const dr = saved.driverCode ? await this.drivers.findOne({ where: { code: saved.driverCode as never } }) : null;
      const vh = saved.vehicleCode ? await this.vehicles.findOne({ where: { code: saved.vehicleCode as never } }) : null;
      await this.notifyRequesters(saved, 'mission_validee',
        `Mission ${saved.num} confirmée`,
        `Votre demande de transport a été validée et planifiée.\n\n${this.missionSummary(saved, dr, vh)}\n\nVous serez prévenu en cas de changement.`);
    }
    return saved;
  }

  async remove(id: string): Promise<{ deleted: true }> {
    await this.findOne(id);
    await this.dependency.assertRemovable('missions', id);
    await this.repo.delete(id);
    return { deleted: true };
  }

  async replaceAll(rows: Partial<Mission>[]): Promise<Mission[]> {
    await this.repo.clear();
    return this.repo.save(
      rows.map((row) => this.repo.create({ ...row, verifyToken: row.verifyToken ?? randomBytes(9).toString('hex') })),
    );
  }

  /** Verification d'authenticite d'un ordre de mission (QR code). */
  async verify(token: string): Promise<{ valid: boolean; mission?: Partial<Mission> }> {
    const m = await this.repo.findOne({ where: { verifyToken: token as never } });
    if (!m) return { valid: false };
    return {
      valid: true,
      mission: {
        num: m.num, fromLoc: m.fromLoc, toLoc: m.toLoc, dateStart: m.dateStart, dateEnd: m.dateEnd,
        driverCode: m.driverCode, vehicleCode: m.vehicleCode, distance: m.distance, status: m.status,
      },
    };
  }
}
