import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { Place } from './place.entity';
import { dzGeo } from '../common/dz-geo';
import * as communesDz from './communes-dz.json';

const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

type CommuneRow = { name: string; lat: number; lon: number; wilaya: string | null };

@Injectable()
export class PlacesService implements OnModuleInit {
  private readonly logger = new Logger(PlacesService.name);
  constructor(@InjectRepository(Place) private readonly repo: Repository<Place>) {}

  /**
   * Synchronise le référentiel avec les 1500+ communes d'Algérie (`communes-dz.json`, source
   * ouverte kossa/algerian-cities) + les lieux du code (`dz-geo`). Insère les lieux manquants
   * sans toucher aux points ajoutés à la main (idempotent, à chaque démarrage) — retour DG :
   * « la partie GPS est pauvre en communes, on ne trouve pas Béni Ounif ».
   */
  async onModuleInit(): Promise<void> {
    try {
      const existing = new Set((await this.repo.find()).map((p) => p.name.toLowerCase()));
      const rows = (communesDz as unknown as { default?: CommuneRow[] }).default ?? (communesDz as unknown as CommuneRow[]);
      const toAdd: Place[] = [];
      const add = (name: string, lat: number, lon: number, wilaya: string | null) => {
        const k = name.toLowerCase();
        if (!name || existing.has(k) || !Number.isFinite(lat) || !Number.isFinite(lon)) return;
        existing.add(k);
        toAdd.push(this.repo.create({ name, lat, lon, wilaya, kind: 'commune', source: 'seed', usageCount: 0 }));
      };
      // `dzGeo` d'abord (référentiel curé : coords précises des grandes villes / chefs-lieux),
      // puis les communes du dataset ouvert pour combler les ~1400 lieux manquants.
      for (const [name, coord] of Object.entries(dzGeo)) add(name, coord.lat, coord.lon, null);
      for (const c of rows) add(c.name, c.lat, c.lon, c.wilaya ?? null);
      // insert par lots pour éviter une requête géante
      for (let i = 0; i < toAdd.length; i += 400) await this.repo.save(toAdd.slice(i, i + 400));
      if (toAdd.length) this.logger.log(`Référentiel lieux : +${toAdd.length} communes`);

      // Correction : les lieux 'seed' présents dans `dzGeo` (curé) reprennent ses coordonnées
      // précises (le dataset ouvert est parfois imprécis sur les lieux du Sud).
      let fixed = 0;
      for (const p of await this.repo.find({ where: { source: 'seed' } })) {
        const c = dzGeo[p.name] ?? dzGeo[Object.keys(dzGeo).find((k) => k.toLowerCase() === p.name.toLowerCase()) ?? ''];
        if (c && (Math.abs(c.lat - p.lat) > 0.02 || Math.abs(c.lon - p.lon) > 0.02)) {
          p.lat = c.lat; p.lon = c.lon;
          await this.repo.save(p);
          fixed++;
        }
      }
      if (fixed) this.logger.log(`Référentiel lieux : ${fixed} coordonnées corrigées`);
      this.cache = null;
    } catch (e) {
      this.logger.warn(`Sync lieux impossible : ${(e as Error).message}`);
    }
  }

  private cache: Place[] | null = null;
  private cacheAt = 0;
  private async allPlaces(): Promise<Place[]> {
    if (this.cache && Date.now() - this.cacheAt < 60_000) return this.cache;
    this.cache = await this.repo.find();
    this.cacheAt = Date.now();
    return this.cache;
  }

  /** Recherche pour l'autocomplete : préfixe d'abord, puis « contient », classé par usage. */
  async search(q: string, limit = 12): Promise<Place[]> {
    const s = (q ?? '').trim();
    if (!s) return [];
    const all = await this.allPlaces();
    const nq = norm(s);
    const rank = (p: Place) => (p.usageCount ?? 0) + (p.source === 'manual' ? 5 : 0);
    const starts = all.filter((p) => norm(p.name).startsWith(nq));
    const contains = all.filter((p) => !norm(p.name).startsWith(nq) && norm(p.name).includes(nq));
    return [
      ...starts.sort((a, b) => rank(b) - rank(a) || a.name.length - b.name.length),
      ...contains.sort((a, b) => rank(b) - rank(a) || a.name.length - b.name.length),
    ].slice(0, limit);
  }

  /** Meilleure correspondance locale d'un nom → coordonnées, ou null. */
  async resolve(q: string): Promise<Place | null> {
    const s = (q ?? '').trim();
    if (!s) return null;
    const exact = await this.repo.findOne({ where: { name: ILike(s) } });
    if (exact) return exact;
    const hits = await this.search(s, 1);
    return hits[0] ?? null;
  }

  async findAll(): Promise<Place[]> {
    return this.repo.find({ order: { usageCount: 'DESC', name: 'ASC' } });
  }

  /** Crée un lieu (point placé sur la carte, ou géocodage). Dé-doublonne par nom+proximité. */
  async create(data: { name: string; lat: number; lon: number; wilaya?: string | null; kind?: string; source?: string }): Promise<Place> {
    this.cache = null;
    const name = (data.name ?? '').trim() || `Point ${data.lat.toFixed(4)}, ${data.lon.toFixed(4)}`;
    const existing = await this.repo.findOne({ where: { name: ILike(name) } });
    if (existing) {
      // même nom : on rafraîchit les coords si un point précis est fourni.
      existing.lat = data.lat; existing.lon = data.lon;
      existing.usageCount = (existing.usageCount ?? 0) + 1;
      return this.repo.save(existing);
    }
    return this.repo.save(this.repo.create({
      name, lat: data.lat, lon: data.lon, wilaya: data.wilaya ?? null,
      kind: data.kind ?? 'pin', source: data.source ?? 'manual', usageCount: 1,
    }));
  }

  /** Incrémente le compteur d'usage d'un lieu (mis en avant dans l'autocomplete). */
  async bump(name: string): Promise<void> {
    const p = await this.repo.findOne({ where: { name: ILike((name ?? '').trim()) } });
    if (p) { p.usageCount = (p.usageCount ?? 0) + 1; await this.repo.save(p); }
  }
}
