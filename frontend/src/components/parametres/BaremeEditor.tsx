'use client';

import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useConfig, useSaveConfig } from '@/lib/api/hooks';
import { fk } from '@/lib/fleet/format';
import type { BaremeMission, BaremeGrid } from '@/lib/fleet/bareme';

const GRID_FIELDS: { key: keyof BaremeGrid; label: string; step?: number; hint?: string }[] = [
  { key: 'repas', label: 'Repas (DA)' },
  { key: 'nuitee', label: 'Nuitée (DA)' },
  { key: 'petitDej', label: 'Petit-déjeuner (DA)' },
  { key: 'pauseCafe', label: 'Pause café (DA)' },
  { key: 'km', label: 'Indemnité km (DA/km)', step: 0.5 },
  { key: 'suppZone', label: 'Supplément zone (DA/jour)' },
  { key: 'plafondJour', label: 'Plafond journalier (DA)', hint: '0 = pas de plafond' },
];

/** Grille de barème frais de mission (NORD/SUD × LÉGER/LOURD). Réutilisée dans Paramètres. */
export default function BaremeEditor() {
  const cfg = useConfig<BaremeMission>('BAREME_MISSION');
  const save = useSaveConfig('BAREME_MISSION');
  const [data, setData] = useState<BaremeMission | null>(null);

  useEffect(() => { if (cfg.data) setData(structuredClone(cfg.data)); }, [cfg.data]);

  if (!data) return <div className="cc" style={{ padding: 24 }}>Chargement…</div>;

  const g = data.grille;
  const ind = data.indemnites;
  const setGrid = (cat: 'LEGER' | 'LOURD', zone: 'NORD' | 'SUD', key: keyof BaremeGrid, val: number) =>
    setData((d) => {
      const n = structuredClone(d!);
      n.grille[cat][zone][key] = val;
      return n;
    });
  const setInd = (key: keyof BaremeMission['indemnites'], val: number) =>
    setData((d) => ({ ...d!, indemnites: { ...d!.indemnites, [key]: val } }));

  const panel = (cat: 'LEGER' | 'LOURD', zone: 'NORD' | 'SUD') => {
    const d = g[cat][zone];
    const accent = zone === 'SUD' ? 'var(--a5)' : 'var(--b5)';
    const catLabel = cat === 'LOURD' ? 'LOURD (Poids Lourds, Engins, Remorques)' : 'LÉGER (Véhicules Légers)';
    const zoneLabel = zone === 'SUD' ? 'Zone SUD' : 'Zone NORD (Locale + Régionale + Nationale)';
    return (
      <div className="tc" style={{ borderTop: `3px solid ${accent}` }} key={`${cat}-${zone}`}>
        <div className="th"><h3 style={{ fontSize: '.82rem' }}>{cat} × {zone}</h3><div className="sub">{catLabel} — {zoneLabel}</div></div>
        <div style={{ padding: 14 }}>
          {[[0, 1], [2, 3], [4, 5], [6]].map((pair, i) => (
            <div className="form-r" key={i}>
              {pair.map((fi) => {
                const f = GRID_FIELDS[fi];
                return (
                  <div className="form-g" key={f.key}>
                    <label>{f.label}</label>
                    <input type="number" step={f.step} value={d[f.key]} onChange={(e) => setGrid(cat, zone, f.key, Number(e.target.value))} />
                    {f.hint && <div style={{ fontSize: '.62rem', color: 'var(--tm)' }}>{f.hint}</div>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const submit = async () => {
    try { await save.mutateAsync(data); toast.success('Barème frais de mission enregistré'); }
    catch { toast.error('Erreur enregistrement'); }
  };

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: '.78rem', color: 'var(--tm)' }}>
        Paramétrage de la grille tarifaire par catégorie de véhicule et zone géographique (montants en DA).
      </div>
      <SectionTitle color="var(--b5)">Catégorie LÉGER</SectionTitle>
      <div className="cr" style={{ marginBottom: 20 }}>{panel('LEGER', 'NORD')}{panel('LEGER', 'SUD')}</div>
      <SectionTitle color="var(--a5)">Catégorie LOURD</SectionTitle>
      <div className="cr" style={{ marginBottom: 20 }}>{panel('LOURD', 'NORD')}{panel('LOURD', 'SUD')}</div>

      <SectionTitle color="var(--g5)">Indemnités Complémentaires</SectionTitle>
      <div className="tc" style={{ marginBottom: 20 }}>
        <div className="th"><h3>Primes &amp; Suppléments</h3><div className="sub">Appliquées en sus du barème grille selon les conditions de la mission</div></div>
        <div style={{ padding: 14 }}>
          <div className="form-r">
            <IndField label="Prime couchage hors hôtel (DA/nuit)" hint="Camping, véhicule, etc." value={ind.couchage} onChange={(v) => setInd('couchage', v)} />
            <IndField label="Prime salissure (DA/jour)" hint="Catégorie LOURD uniquement" value={ind.salissure} onChange={(v) => setInd('salissure', v)} />
          </div>
          <div className="form-r">
            <IndField label="Prime de risque (DA/mission)" hint="ADR, matières dangereuses" value={ind.risque} onChange={(v) => setInd('risque', v)} />
            <IndField label="Supplément week-end / férié (DA/jour)" hint="Samedi et dimanche" value={ind.weekend} onChange={(v) => setInd('weekend', v)} />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-p" onClick={submit} disabled={save.isPending}>Enregistrer tout le barème</button>
        <button className="btn btn-o" onClick={() => cfg.data && setData(structuredClone(cfg.data))}>Réinitialiser</button>
      </div>

      <div className="tc" style={{ marginTop: 20 }}>
        <div className="th"><h3>Aperçu Grille Comparative</h3><div className="sub">Résumé des tarifs par catégorie et zone</div></div>
        <div style={{ padding: 14 }}>
          <div className="tw">
            <table>
              <thead><tr><th>Poste</th><th>LÉGER NORD</th><th>LÉGER SUD</th><th>LOURD NORD</th><th>LOURD SUD</th></tr></thead>
              <tbody>
                {([
                  ['Repas', 'repas', ' DA'], ['Nuitée', 'nuitee', ' DA'], ['Petit-déjeuner', 'petitDej', ' DA'],
                  ['Pause café', 'pauseCafe', ' DA'], ['Indemnité km', 'km', ' DA/km'],
                  ['Supplément zone', 'suppZone', ' DA/j'], ['Plafond/jour', 'plafondJour', ' DA'],
                ] as [string, keyof BaremeGrid, string][]).map(([label, key, unit]) => (
                  <tr key={key} style={key === 'plafondJour' ? { fontWeight: 600 } : undefined}>
                    <td>{label}</td>
                    <td>{fk(g.LEGER.NORD[key])}{unit}</td>
                    <td>{fk(g.LEGER.SUD[key])}{unit}</td>
                    <td>{fk(g.LOURD.NORD[key])}{unit}</td>
                    <td>{fk(g.LOURD.SUD[key])}{unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '.82rem', fontWeight: 700, color: 'var(--tp)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '.03em', display: 'flex', alignItems: 'center', gap: 8, borderLeft: `3px solid ${color}`, paddingLeft: 8 }}>
      {children}
    </div>
  );
}

function IndField({ label, hint, value, onChange }: { label: string; hint: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="form-g">
      <label>{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <div style={{ fontSize: '.62rem', color: 'var(--tm)' }}>{hint}</div>
    </div>
  );
}
