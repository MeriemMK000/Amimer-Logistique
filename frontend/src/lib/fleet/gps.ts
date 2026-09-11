// Portage de v8 : haversineKm, _normalizeCity, gpsCalc (calcul distance synchrone).
import { gpsMatrix as GPS, dzGeo as DZ_GEO } from '../reference/gps';

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeCity(s: string, keys: string[]): string | null {
  const sl = s.trim().toLowerCase();
  let best: string | null = null;
  let bestLen = 0;
  for (const k of keys) {
    const kl = k.toLowerCase();
    if (sl === kl) return k;
    if (sl.includes(kl) && kl.length > bestLen) { best = k; bestLen = kl.length; }
  }
  return best;
}

/** v8 gpsCalc — table GPS puis estimation Haversine. */
export function gpsCalc(from: string, to: string): { km: number; dur: number } | null {
  if (!from || !to) return null;
  const ft = from.trim();
  const tt = to.trim();
  if (!ft || !tt) return null;
  if (ft.toLowerCase() === tt.toLowerCase()) return { km: 10, dur: 15 };
  const a = normalizeCity(ft, Object.keys(GPS));
  const b = normalizeCity(tt, Object.keys(GPS));
  if (a && b && a === b) return { km: 10, dur: 15 };
  if (a && b) {
    if (GPS[a]?.[b]) return { km: GPS[a][b], dur: Math.round((GPS[a][b] / 80) * 60) };
    if (GPS[b]?.[a]) return { km: GPS[b][a], dur: Math.round((GPS[b][a] / 80) * 60) };
  }
  const geoKeys = Object.keys(DZ_GEO);
  const ga = normalizeCity(ft, geoKeys);
  const gb = normalizeCity(tt, geoKeys);
  if (ga && gb) {
    if (ga === gb) return { km: 10, dur: 15 };
    const ca = DZ_GEO[ga];
    const cb = DZ_GEO[gb];
    if (ca && cb) {
      const straight = haversineKm(ca.lat, ca.lon, cb.lat, cb.lon);
      const isSouth = ca.lat < 33 || cb.lat < 33;
      const km = Math.round(straight * (isSouth ? 1.5 : 1.3));
      return { km, dur: Math.round((km / 80) * 60) };
    }
  }
  return null;
}
