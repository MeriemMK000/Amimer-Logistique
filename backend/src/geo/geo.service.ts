import { Injectable, Logger } from '@nestjs/common';
import { PlacesService } from '../places/places.service';

export interface GeoPoint { name?: string; lat: number; lon: number }
export interface RouteResult { km: number; durationMin: number; source: 'osrm' | 'estimation' }
export interface Suggestion { name: string; label: string; lat: number; lon: number; source: 'local' | 'osm' | 'google'; id?: string }

// Boîte englobante de l'Algérie (minLon, minLat, maxLon, maxLat).
const DZ_BBOX = '-9,18,12,38';

/**
 * Distances routières précises (retour DG : « on doit être précis en km, à l'adresse »).
 * - `route()` : OSRM (déjà utilisé par la carte) sur les points EXACTS de l'itinéraire ;
 *   repli sur une estimation haversine × facteur de sinuosité selon la latitude
 *   (Nord dense 1,25 · Hauts-Plateaux 1,4 · Sud / Sahara 1,6).
 * - `geocode()` : référentiel `places` local d'abord, puis Nominatim si activé (GEOCODING_ENABLED).
 */
@Injectable()
export class GeoService {
  private readonly logger = new Logger(GeoService.name);
  private readonly cache = new Map<string, RouteResult>();
  private readonly osrmEnabled = process.env.OSRM_ENABLED !== 'false';
  // Géocodage d'adresses / rues / quartiers activé par défaut (retour DG : « je cherche
  // n'importe quoi, une rue, un emplacement… je dois le trouver »). Coupable via GEOCODING_ENABLED=false.
  private readonly geocodingEnabled = process.env.GEOCODING_ENABLED !== 'false';
  private readonly suggestCache = new Map<string, { at: number; hits: Suggestion[] }>();
  // Recherche d'adresse Google (retour DG : « exactement la recherche de Google Maps »).
  // Active dès que GOOGLE_MAPS_API_KEY est présent ; sinon repli automatique sur OSM (Photon/Nominatim).
  private readonly googleKey = (process.env.GOOGLE_MAPS_API_KEY ?? '').trim();
  private get googleEnabled(): boolean {
    return this.googleKey.length > 0 && this.googleKey !== 'your-google-maps-api-key';
  }

  constructor(private readonly places: PlacesService) {}

  /** Facteur de sinuosité route/vol d'oiseau selon la latitude (réseau plus lâche au Sud). */
  roadFactor(lat: number): number {
    if (lat >= 34.5) return 1.25;      // Nord (Tell)
    if (lat >= 32) return 1.4;          // Hauts-Plateaux
    return 1.6;                          // Sud / Sahara
  }

  haversineKm(a: GeoPoint, b: GeoPoint): number {
    const R = 6371;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLon = toRad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  private estimate(points: GeoPoint[]): RouteResult {
    let km = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1];
      km += this.haversineKm(a, b) * this.roadFactor(Math.min(a.lat, b.lat));
    }
    km = Math.round(km);
    return { km, durationMin: Math.round((km / 70) * 60), source: 'estimation' };
  }

  private async osrm(points: GeoPoint[]): Promise<RouteResult | null> {
    if (!this.osrmEnabled || points.length < 2) return null;
    const coordStr = points.map((p) => `${p.lon},${p.lat}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=false`;
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(url, { signal: ctrl.signal });
      clearTimeout(to);
      if (!res.ok) return null;
      const json = (await res.json()) as { routes?: Array<{ distance: number; duration: number }> };
      const r = json.routes?.[0];
      if (!r || typeof r.distance !== 'number') return null;
      return { km: Math.round(r.distance / 1000), durationMin: Math.round(r.duration / 60), source: 'osrm' };
    } catch {
      return null;
    }
  }

  /**
   * Distance d'un itinéraire dont les points peuvent être des coordonnées OU des libellés
   * (villes / adresses résolus via le référentiel `places`, puis géocodage si activé).
   */
  async routeNamed(points: Array<GeoPoint | string>): Promise<RouteResult> {
    const resolved: GeoPoint[] = [];
    for (const p of points) {
      if (p && typeof p === 'object' && Number.isFinite((p as GeoPoint).lat) && Number.isFinite((p as GeoPoint).lon)) {
        resolved.push(p as GeoPoint);
      } else if (typeof p === 'string' && p.trim()) {
        const g = await this.geocode(p);
        if (g) resolved.push({ name: g.name, lat: g.lat, lon: g.lon });
      }
    }
    return this.route(resolved);
  }

  /** Distance routière d'un itinéraire multipoint (OSRM sinon estimation). */
  async route(points: GeoPoint[]): Promise<RouteResult> {
    const pts = points.filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon));
    if (pts.length < 2) return { km: 0, durationMin: 0, source: 'estimation' };
    const key = pts.map((p) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)}`).join('|');
    const cached = this.cache.get(key);
    if (cached) return cached;
    const result = (await this.osrm(pts)) ?? this.estimate(pts);
    this.cache.set(key, result);
    return result;
  }

  /** Résout un libellé de lieu en coordonnées. Local d'abord, puis géocodeur (Google/Photon/Nominatim). */
  async geocode(q: string): Promise<GeoPoint & { source: string; wilaya?: string | null } | null> {
    const s = (q ?? '').trim();
    if (!s) return null;
    const local = await this.places.resolve(s);
    if (local) return { name: local.name, lat: local.lat, lon: local.lon, wilaya: local.wilaya, source: local.source ?? 'seed' };
    if (!this.geocodingEnabled) return null;
    // Géocodeur : 1re proposition (via `suggest` : Google puis OSM), persistée pour réutilisation.
    const hits = await this.suggest(s).catch(() => [] as Suggestion[]);
    const hit = hits.find((h) => h.source === 'google' || h.source === 'osm') ?? hits[0];
    if (!hit) return null;
    const created = await this.places.create({ name: hit.name, lat: hit.lat, lon: hit.lon, kind: 'address', source: hit.source }).catch(() => null);
    return { name: created?.name ?? hit.name, lat: hit.lat, lon: hit.lon, source: hit.source };
  }

  /**
   * Autocomplete de lieu « type carte » (retour DG) : référentiel local (communes + points
   * enregistrés) PUIS géocodeur OSM (Photon, optimisé autocomplete) pour trouver n'importe
   * quelle rue / quartier / zone / cité en Algérie. Résultats fusionnés + dédoublonnés + cache 5 min.
   */
  async suggest(q: string, bias?: { lat?: number; lon?: number }): Promise<Suggestion[]> {
    const s = (q ?? '').trim();
    if (s.length < 2) return [];
    const key = s.toLowerCase();
    const cached = this.suggestCache.get(key);
    if (cached && Date.now() - cached.at < 300_000) return cached.hits;

    const localRows = await this.places.search(s, 8);
    const local: Suggestion[] = localRows.map((p) => ({
      name: p.name, label: [p.name, p.wilaya].filter(Boolean).join(' — '),
      lat: p.lat, lon: p.lon, source: 'local', id: p.id,
    }));

    let external: Suggestion[] = [];
    // On interroge le géocodeur si le référentiel local ne suffit pas (peu de résultats, ou
    // requête qui ressemble à une adresse : plusieurs mots). Google en priorité si configuré,
    // repli Photon/Nominatim sinon (ou si Google ne renvoie rien).
    if (this.geocodingEnabled && (local.length < 6 || s.includes(' '))) {
      if (this.googleEnabled) {
        external = await this.googlePlaces(s, bias);
        if (!external.length) external = await this.photon(s, bias);
      } else {
        external = await this.photon(s, bias);
      }
    }

    // Fusion : local d'abord, puis géocodeur, dédoublonné par libellé ET par coordonnées (~1 km).
    const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
    const seen = new Set<string>();
    const merged: Suggestion[] = [];
    for (const h of [...local, ...external]) {
      const kLabel = norm(h.label || h.name);
      const kCoord = `${h.lat.toFixed(2)},${h.lon.toFixed(2)}`;
      if (seen.has(kLabel) || seen.has(kCoord)) continue;
      seen.add(kLabel); seen.add(kCoord);
      merged.push(h);
    }
    const out = merged.slice(0, 8);
    this.suggestCache.set(key, { at: Date.now(), hits: out });
    return out;
  }

  /**
   * Recherche d'adresse Google — Places API (New), Text Search : `POST places:searchText`.
   * C'est le moteur du champ de recherche de Google Maps (n'importe quelle adresse / lieu).
   * Biais Algérie (regionCode + locationBias autour du point de référence si fourni), sans
   * filtrage strict pour autoriser les missions transfrontalières.
   */
  private async googlePlaces(s: string, bias?: { lat?: number; lon?: number }): Promise<Suggestion[]> {
    if (!this.googleEnabled) return [];
    try {
      const body: Record<string, unknown> = {
        textQuery: s,
        languageCode: 'fr',
        regionCode: 'DZ',
        pageSize: 6,
      };
      if (Number.isFinite(bias?.lat) && Number.isFinite(bias?.lon)) {
        body.locationBias = { circle: { center: { latitude: bias!.lat, longitude: bias!.lon }, radius: 50000 } };
      }
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': this.googleKey,
          'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.shortFormattedAddress,places.location',
        },
        body: JSON.stringify(body),
      });
      clearTimeout(to);
      if (!res.ok) {
        this.logger.warn(`google places "${s}" — HTTP ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
        return [];
      }
      const json = (await res.json()) as {
        places?: Array<{
          displayName?: { text?: string };
          formattedAddress?: string;
          shortFormattedAddress?: string;
          location?: { latitude?: number; longitude?: number };
        }>;
      };
      const out: Suggestion[] = [];
      for (const p of json.places ?? []) {
        const lat = p.location?.latitude;
        const lon = p.location?.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const name = p.displayName?.text || (p.shortFormattedAddress ?? p.formattedAddress ?? '').split(',')[0] || '';
        if (!name) continue;
        const label = p.formattedAddress || p.shortFormattedAddress || name;
        out.push({ name, label, lat: lat as number, lon: lon as number, source: 'google' });
      }
      return out;
    } catch (e) {
      this.logger.warn(`google places "${s}" — ${String(e)}`);
      return [];
    }
  }

  /** Recherche Photon (komoot) — GeoJSON, filtrée Algérie, libellés lisibles. */
  private async photon(s: string, bias?: { lat?: number; lon?: number }): Promise<Suggestion[]> {
    try {
      const params = new URLSearchParams({ q: s, limit: '6', lang: 'fr', bbox: DZ_BBOX });
      if (Number.isFinite(bias?.lat) && Number.isFinite(bias?.lon)) {
        params.set('lat', String(bias!.lat));
        params.set('lon', String(bias!.lon));
      }
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`https://photon.komoot.io/api?${params.toString()}`, {
        signal: ctrl.signal, headers: { 'User-Agent': 'FleetPro/1.0 (Amimer Logistique)' },
      });
      clearTimeout(to);
      if (!res.ok) return [];
      const json = (await res.json()) as {
        features?: Array<{ geometry: { coordinates: [number, number] };
          properties: { name?: string; street?: string; district?: string; city?: string; county?: string; state?: string; countrycode?: string; osm_value?: string } }>;
      };
      const out: Suggestion[] = [];
      for (const f of json.features ?? []) {
        const p = f.properties ?? {};
        if (p.countrycode && p.countrycode !== 'DZ') continue;
        const [lon, lat] = f.geometry.coordinates;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const name = p.name || p.street || p.district || p.city || '';
        if (!name) continue;
        const ctx: string[] = [];
        for (const c of [p.district, p.city, p.county, p.state]) {
          if (c && c !== name && !ctx.includes(c) && !ctx.some((x) => x.includes(c) || c.includes(x))) ctx.push(c);
        }
        out.push({ name, label: [name, ...ctx.slice(0, 2)].join(' — '), lat, lon, source: 'osm' });
      }
      return out;
    } catch (e) {
      this.logger.warn(`photon "${s}" — ${String(e)}`);
      return this.nominatim(s);
    }
  }

  /** Repli : Nominatim (OSM) — 1 seule requête, filtrée Algérie. */
  private async nominatim(s: string): Promise<Suggestion[]> {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=4&countrycodes=dz&q=${encodeURIComponent(s)}`,
        { signal: ctrl.signal, headers: { 'User-Agent': 'FleetPro/1.0 (Amimer Logistique)' } },
      );
      clearTimeout(to);
      if (!res.ok) return [];
      const arr = (await res.json()) as Array<{ lat: string; lon: string; display_name: string; name?: string }>;
      return (arr ?? []).map((h) => ({
        name: h.name || h.display_name.split(',')[0],
        label: h.display_name.split(',').slice(0, 3).join(', '),
        lat: Number(h.lat), lon: Number(h.lon), source: 'osm' as const,
      })).filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lon));
    } catch {
      return [];
    }
  }
}
