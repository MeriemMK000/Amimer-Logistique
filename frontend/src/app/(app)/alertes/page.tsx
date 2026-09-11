'use client';

import { useState } from 'react';
import { fd } from '@/lib/fleet/format';
import { useAlerts, useFleetBalance } from '@/lib/api/hooks';
import StatusBadge from '@/components/ui/StatusBadge';
import Tabs from '@/components/ui/Tabs';
import SearchBox from '@/components/ui/SearchBox';
import { useSearch } from '@/lib/useSearch';

const CATS: { key: string; label: string }[] = [
  { key: 'all', label: 'Toutes' },
  { key: 'doc', label: 'Documents' },
  { key: 'ass', label: 'Assurances' },
  { key: 'loc', label: 'Location' },
  { key: 'mnt', label: 'Maintenance' },
  { key: 'carb', label: 'Carburant' },
  { key: 'chauf', label: 'Chauffeurs' },
  { key: 'flotte', label: 'Flotte' },
];

const dgPath = <><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>;
const wrPath = <><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></>;
const inPath = <><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></>;

export default function AlertesPage() {
  const [tab, setTab] = useState(0);
  const [cat, setCat] = useState('all');
  const alerts = useAlerts();
  const AL = alerts.data ?? [];
  const catList = cat === 'all' ? AL : AL.filter((a) => a.category === cat);
  const search = useSearch(catList, (a) => [a.title, a.description, a.category, a.priority, a.type].join(' '));

  return (
    <div className="page active">
      <Tabs tabs={['Liste des alertes', 'Équilibre flotte (14 j)']} active={tab} onChange={setTab} />

      {tab === 0 && (
        <div className="tpane act">
          <div className="fb" style={{ marginBottom: 8 }}>
            {CATS.map((c) => (
              <button key={c.key} className={`fc${cat === c.key ? ' act' : ''}`} onClick={() => setCat(c.key)}>
                {c.label}{c.key === 'all' ? ` (${AL.length})` : ''}
              </button>
            ))}
            <div style={{ flex: 1 }} />
            <SearchBox value={search.q} onChange={search.setQ} placeholder="Titre, description…" count={search.count} total={catList.length} />
          </div>
          <div className="al">
            {search.filtered.map((a) => (
              <div className="ai" key={a.id}>
                <div className={`ak ${a.type ?? 'in'}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    {a.type === 'dg' ? dgPath : a.type === 'wr' ? wrPath : inPath}
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="at">{a.title}</div>
                  <div className="ad">{a.description}</div>
                </div>
                <span className="atm">{a.timeLabel}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0, alignItems: 'flex-end' }}>
                  <span className="bg bg-t" style={{ fontSize: '.6rem' }}>{a.category?.toUpperCase()}</span>
                  <StatusBadge status={a.priority} />
                </div>
              </div>
            ))}
            {!search.filtered.length && <div style={{ textAlign: 'center', padding: 40, color: 'var(--tm)' }}>Aucune alerte</div>}
          </div>
        </div>
      )}

      {tab === 1 && <FleetBalanceTab />}
    </div>
  );
}

/** Sur-effectif / sous-effectif chauffeurs par type de véhicule, simulé sur 14 jours. */
function FleetBalanceTab() {
  const bal = useFleetBalance(14);
  const d = bal.data;

  if (bal.isLoading) return <div className="tpane act"><div style={{ padding: 30, color: 'var(--tm)' }}>Calcul de la simulation…</div></div>;
  if (!d) return <div className="tpane act"><div style={{ padding: 30, color: 'var(--tm)' }}>Indisponible</div></div>;

  const s = d.summary;
  return (
    <div className="tpane act">
      <div className="sg" style={{ marginBottom: 12 }}>
        <div className="sc"><div><div className="sv">{d.driversAvailable}</div><div className="sl">Chauffeurs disponibles</div></div></div>
        <div className="sc"><div><div className="sv" style={{ color: s.maxSurplus ? 'var(--r6)' : 'var(--g6)' }}>{s.maxSurplus}</div><div className="sl">Sur-effectif max (14 j)</div><div className="st dn">{s.firstSureffectifDay ? `dès le ${s.firstSureffectifDay}` : 'aucun'}</div></div></div>
        <div className="sc"><div><div className="sv" style={{ color: s.maxDeficit ? 'var(--a6)' : 'var(--g6)' }}>{s.maxDeficit}</div><div className="sl">Sous-effectif max (14 j)</div><div className="st dn">{s.firstSouseffectifDay ? `dès le ${s.firstSouseffectifDay}` : 'aucun'}</div></div></div>
        <div className="sc"><div><div className="sv">{d.outages.length}</div><div className="sl">Immobilisations simulées</div><div className="st dn">pannes + entretien préventif</div></div></div>
      </div>

      <div className="tc" style={{ marginBottom: 12 }}>
        <div className="th"><h3>Projection jour par jour ({d.horizonDays} jours)</h3>
          <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>Suivant plan de maintenance, pannes actuelles et délai prévisionnel de remise en marche.</div>
        </div>
        <div className="tw" style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Date</th><th>Chauffeurs dispo.</th><th>Véh. légers</th><th>Véh. lourds</th><th>Véh. conduisibles</th><th>Écart</th><th>État</th></tr></thead>
            <tbody>
              {d.timeline.map((t) => (
                <tr key={t.date} style={{ background: t.surplusDrivers > 0 ? 'var(--r1)' : t.surplusDrivers < 0 ? 'var(--a1)' : undefined }}>
                  <td>{fd(t.date)}</td>
                  <td>{t.driversAvailable}</td>
                  <td>{t.byType.LEGER ?? 0}</td>
                  <td>{t.byType.LOURD ?? 0}</td>
                  <td style={{ fontWeight: 600 }}>{t.vehiclesAvailable}</td>
                  <td style={{ fontWeight: 700, color: t.surplusDrivers > 0 ? 'var(--r6)' : t.surplusDrivers < 0 ? 'var(--a6)' : 'var(--g6)' }}>
                    {t.surplusDrivers > 0 ? `+${t.surplusDrivers} chauffeur(s)` : t.surplusDrivers < 0 ? `${t.surplusDrivers} (véh. à l'arrêt)` : '0'}
                  </td>
                  <td>
                    {t.state === 'SUREFFECTIF' ? <span className="bg bg-r">Sur-effectif</span>
                      : t.state === 'SOUSEFFECTIF' ? <span className="bg bg-a">Sous-effectif</span>
                        : <span className="bg bg-g">Équilibré</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tc">
        <div className="th"><h3>Immobilisations prises en compte</h3></div>
        <div className="tw">
          <table>
            <thead><tr><th>Véhicule</th><th>Type</th><th>Du</th><th>Au</th><th>Motif</th></tr></thead>
            <tbody>
              {d.outages.map((o, i) => (
                <tr key={i}><td style={{ fontWeight: 600 }}>{o.vehicleCode}</td><td>{o.type ?? '—'}</td><td>{o.from}</td><td>{o.to}</td><td style={{ fontSize: '.72rem' }}>{o.reason}</td></tr>
              ))}
              {!d.outages.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--tm)', padding: 14 }}>Aucune immobilisation sur l&apos;horizon</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
