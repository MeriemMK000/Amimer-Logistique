'use client';

import { icons } from '@/components/ui/icons';
import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  useCollection, useConfig, useConsumeRegiePurchase, useCreate, useCreateFuelStockOp, useCreateRegiePurchase, useDrivers,
  useEngineFuelEntries, useFuelBilan, useFuelCards, useFuelControlMonth, useFuelEntries, useFuelStockBalance, useFuelStockOps,
  useImportFuelEntries, useMissions, useRegiePurchases, useRegieQr, useReleveSuivi, useRemoveFuelStockOp,
  useRemoveRegiePurchase, useSuppliers, useUpdate, useUpsertMonthlyKm, useVehicleAssignments, useVehicles,
} from '@/lib/api/hooks';
import { useSiteNames, withCurrentSite } from '@/lib/reference/sites';
import CartesCarburantPanel from '@/components/carburant/CartesCarburantPanel';
import BuCcSelect from '@/components/ui/BuCcSelect';
import Modal from '@/components/ui/Modal';
import PlaceInput from '@/components/ui/PlaceInput';
import SearchBox from '@/components/ui/SearchBox';
import DateInput from '@/components/ui/DateInput';
import { useSearch } from '@/lib/useSearch';
import { monthOptions } from '@/lib/period';
import { fd, fk } from '@/lib/fleet/format';
import { downloadCSV, printHTML, printReport } from '@/lib/export';
import type { EngineFuelEntry, FuelEntry, FuelPrices, Vehicle } from '@/lib/types';

/* ───────────────────────── constantes partagées ───────────────────────── */

const FT = ['GASOIL', 'SP', 'SUPER', 'GPL'] as const;
type Ft = (typeof FT)[number];
const FT_LABEL: Record<string, string> = { GASOIL: 'Gasoil', SP: 'Essence sans plomb', SUPER: 'Essence super', GPL: 'GPL' };
const FT_COLOR: Record<string, string> = { GASOIL: '#2563eb', SP: '#d97706', SUPER: '#b45309', GPL: '#0d9488' };

const SRC_LABEL: Record<string, string> = {
  carte: 'Carte NAFTAL', stock_site: 'Stock site', pompe_externe: 'Pompe externe', regie: 'Régie',
  manuel: 'Manuel', import: 'Import', engin_dedie: 'Plein engin (saisie dédiée)',
  dotation_site: 'Dotation site (pointage)',
};
const CAT_LABEL: Record<string, string> = {
  mission: 'Missions (système)', permanent: 'Affectations permanentes', engin_site: 'Engins & équipements site',
  vl_site: 'Véhicules légers site', externe: 'Véhicules externes',
};
const CAT_ORDER = ['mission', 'permanent', 'vl_site', 'engin_site'] as const;
const CTRL_METHOD_LABEL: Record<string, string> = {
  mission: 'par km réels des missions', km_difference: 'par différence de km (relevé début → fin)', hours: 'par heures de fonctionnement',
};
const BILAN_CAT: Record<string, { label: string; color: string }> = {
  missions: { label: 'Missions', color: '#2563eb' },
  permanents: { label: 'Affectations permanentes', color: '#7c3aed' },
  vlSite: { label: 'Véhicules légers site', color: '#0ea5e9' },
  engins: { label: 'Engins de chantier', color: '#d97706' },
  externes: { label: 'Véhicules externes', color: '#64748b' },
};
const BILAN_CAT_KEYS = ['missions', 'permanents', 'vlSite', 'engins', 'externes'] as const;

const vColor = (v: string | null) => (v === 'anomalie' ? 'var(--r6)' : v === 'surveiller' ? 'var(--a6)' : v === 'incomplet' ? 'var(--tm)' : 'var(--g6)');
const V_LABEL: Record<string, string> = { anomalie: 'Anomalie', surveiller: 'À surveiller', incomplet: 'Incomplet', conforme: 'Conforme' };
const FLAG_LABEL: Record<string, string> = {
  reservoir_non_declare: 'Réservoir non déclaré',
  releve_ouverture_manquant: 'Relevé d\'ouverture (début de mois) manquant',
  releve_cloture_manquant: 'Relevé de clôture (fin de mois) manquant',
  surconsommation: 'Sur-consommation carburant',
  km_carburant_incoherent: 'Km ↔ carburant incohérents',
  activite_non_justifiee: 'Activité roulée non justifiée',
  km_non_justifie_missions: 'Km non justifiés par des missions',
  km_manquant: 'Relevé km manquant',
  heures_manquantes: 'Relevé heures manquant',
  carburant_double_source: 'Carburant saisi 2× (dotation site + cuve/plein engin)',
};

/** Phrase d'explication du verdict — dit en clair pourquoi c'est rouge. */
function verdictReason(r: any): string | null {
  const isEngin = r.category === 'engin_site';
  if (r.verdict === 'incomplet') {
    const miss = [
      !r.openingDone && 'le relevé d\'ouverture (début de mois)',
      !r.closingDone && 'le relevé de clôture (fin de mois)',
      r.openingDone && r.closingDone && (isEngin ? r.hoursFait == null : r.kmFait == null) && `le relevé ${isEngin ? 'heures' : 'km'}`,
      r.openingDone && r.closingDone && !r.tankDeclared && 'le niveau de réservoir',
    ].filter(Boolean);
    return `Contrôle impossible : ${miss.join(' et ')} manque${miss.length > 1 ? 'nt' : ''}.`;
  }
  if ((r.flags ?? []).includes('km_carburant_incoherent')) {
    const kmPaid = r.kmTheorique != null ? Math.round(r.kmTheorique) : null;
    return `Compteur ${fk(r.kmFait)} km, mais le carburant n'en « paie » que ${kmPaid != null ? fk(kmPaid) : '?'} km`
      + ` → ~${fk(Math.abs(Math.round(r.ecartLitres ?? 0)))} L / ${kmPaid != null ? fk(Math.max(0, r.kmFait - kmPaid)) : '?'} km inexpliqués (compteur gonflé ou pleins non déclarés).`;
  }
  if ((r.flags ?? []).includes('activite_non_justifiee')) {
    return `${fk(r.kmFait)} km roulés pour seulement ${fk(r.kmMissions)} km de missions → ${fk(r.kmNonJustifie)} km d'usage non justifié (le carburant colle aux km : trajets réels non déclarés).`;
  }
  if (r.ecartPct != null && r.ecartPct > 15) {
    return `Consomme ${r.consoReelle}${isEngin ? ' L/h' : ' L/100'} contre ${r.norme} en norme → +${r.ecartPct}% (${r.ecartLitres > 0 ? '+' : ''}${fk(Math.round(r.ecartLitres))} L de trop).`;
  }
  if (r.ecartPct != null && r.ecartPct < -15) {
    return `Consomme ${Math.abs(r.ecartPct)}% de MOINS que la norme → carburant probablement sous-déclaré (pleins manquants).`;
  }
  if (r.verdict === 'surveiller' && (r.flags ?? []).includes('activite_non_justifiee')) {
    return `${fk(r.kmNonJustifie)} km hors mission — à surveiller.`;
  }
  return null;
}
const ecCls = (ec: number) => (ec > 15 ? { color: 'var(--r6)', fontWeight: 600 } : ec > 5 ? { color: 'var(--a6)' } : ec < -15 ? { color: 'var(--a6)' } : { color: 'var(--g6)' });

/** Barre d'onglets carburant — colorée + espacée (retour DG : « on se perd dans les menus »). */
const FUEL_TABS = [
  { label: 'Mouvements carburant', hint: 'pleins, cuves (appro), régie — la saisie', color: '#0d9488' },
  { label: 'Conso site', hint: 'où part le carburant · sorties de cuve', color: '#2563eb' },
  { label: 'Contrôle', hint: 'km/heures vs norme', color: '#7c3aed' },
  { label: 'Bilan par carburant', hint: 'réserve + entrées − sorties', color: '#0891b2' },
  { label: 'Anomalies', hint: 'dérives détectées', color: '#dc2626' },
  { label: 'Gestion des cartes', hint: 'cartes NAFTAL — création & suivi', color: '#475569' },
];
function FuelTabs({ active, onChange }: { active: number; onChange: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '4px 0 16px' }}>
      {FUEL_TABS.map((t, i) => {
        const on = i === active;
        return (
          <button key={t.label} onClick={() => onChange(i)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 1,
              padding: '8px 14px', borderRadius: 10, cursor: 'pointer', textAlign: 'left',
              border: `1.5px solid ${on ? t.color : 'var(--bd)'}`,
              background: on ? t.color : 'var(--s1)', color: on ? '#fff' : 'var(--tp)',
              boxShadow: on ? `0 2px 8px ${t.color}44` : 'none', transition: 'all .15s',
            }}>
            <span style={{ fontSize: '.82rem', fontWeight: 700 }}>{t.label}</span>
            <span style={{ fontSize: '.62rem', opacity: on ? 0.9 : 0.6 }}>{t.hint}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Un plein peut être daté YYYY-MM-DD, DD/MM ou DD/MM/YYYY. */
function inMonth(d: string | null | undefined, month: string): boolean {
  if (!d) return false;
  const s = String(d).trim();
  // YYYY-MM-DD ou YYYY/MM/DD (mois sur 1 ou 2 chiffres)
  let m = s.match(/^(\d{4})[-/](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}` === month;
  // DD/MM/YYYY · DD-MM-YYYY · DD/MM · DD-MM
  m = s.match(/^(\d{1,2})[-/](\d{1,2})(?:[-/](\d{2,4}))?$/);
  if (m) {
    const mo = m[2].padStart(2, '0');
    const yr = m[3] ? (m[3].length === 2 ? `20${m[3]}` : m[3]) : month.slice(0, 4);
    return `${yr}-${mo}` === month;
  }
  return false;
}
const canon = (t?: string | null, g?: string | null): Ft => {
  const u = (t ?? '').trim().toUpperCase();
  const gg = (g ?? '').trim().toUpperCase();
  if (u === 'GPL') return 'GPL';
  if (u === 'SUPER') return 'SUPER';
  if (u === 'SP' || u === 'SANS PLOMB') return 'SP';
  if (u === 'ESSENCE' || u === 'ESS') return gg === 'SUPER' ? 'SUPER' : 'SP';
  return 'GASOIL';
};

/* ═══════════════════════════════ PAGE ═══════════════════════════════ */

export default function CarburantPage() {
  const months = monthOptions();
  const [month, setMonth] = useState(months[0].value);
  const [tab, setTab] = useState(0);
  const [sub0, setSub0] = useState(0);
  const [sub1, setSub1] = useState(0);

  // Redirections depuis l'ancien menu / anciennes URLs.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t === 'cartes') setTab(5);
    else if (t === 'controle') setTab(2);
    else if (t === 'bilan') setTab(3);
    else if (t === 'anomalies') setTab(4);
  }, []);

  const bilan = useFuelBilan(month);
  const control = useFuelControlMonth(month);
  const b = bilan.data as any;
  const rows = (control.data ?? []) as any[];

  const g = b?.global;
  const achats = g ? g.entrees.total - g.entrees.stockDebutCuves : 0;
  const nbAno = rows.filter((r) => r.verdict === 'anomalie').length + (b ? FT.reduce((s, ft) => s + (Math.abs(b.parType[ft]?.cuveEcart ?? 0) > 50 ? 1 : 0), 0) : 0);
  const nbSurv = rows.filter((r) => r.verdict === 'surveiller').length;
  const nbIncomplet = rows.filter((r) => r.verdict === 'incomplet').length;

  return (
    <div className="page active">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Carburant — période de contrôle</h2>
        <select value={month} onChange={(e) => setMonth(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', background: 'var(--s1)', color: 'var(--tp)', fontSize: '.8rem' }}>
          {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>

      <div className="sg">
        <div className="sc"><div><div className="sv">{fk(Math.round(achats))} L</div><div className="sl">Entrées de la période</div><div className="st">{fk(Math.round(g?.entrees.totalValue ?? 0))} DA · achats + appros</div></div><div className="si bl">{icons.truck}</div></div>
        <div className="sc"><div><div className="sv">{fk(Math.round(g?.sorties.total ?? 0))} L</div><div className="sl">Consommé (véhicules + engins)</div><div className="st">{fk(Math.round(g?.sorties.totalValue ?? 0))} DA</div></div><div className="si tl">{icons.activity}</div></div>
        <div className="sc"><div><div className="sv">{fk(Math.round(g?.sorties.stockFinCuves ?? 0))} L</div><div className="sl">Reste en cuve (fin de mois)</div><div className="st">{(b?.cuves ?? []).length} cuve(s) suivie(s)</div></div><div className="si am">{icons.clock}</div></div>
        <div className="sc"><div><div className="sv" style={nbAno ? { color: 'var(--r6)' } : undefined}>{nbAno}</div><div className="sl">Anomalies de consommation</div><div className="st dn">{nbSurv} à surveiller · {nbIncomplet} incomplet</div></div><div className={`si ${nbAno ? 'rd' : 'gn'}`}>{icons.alert}</div></div>
      </div>

      <FuelTabs active={tab} onChange={setTab} />

      {tab === 0 && <MouvementsTab month={month} b={b} loading={bilan.isLoading} sub={sub0} setSub={setSub0} />}
      {tab === 1 && <ConsoSiteTab month={month} b={b} loading={bilan.isLoading} sub={sub1} setSub={setSub1} />}
      {tab === 2 && <ControleTab month={month} rows={rows} loading={control.isLoading} />}
      {tab === 3 && <BilanTab month={month} b={b} loading={bilan.isLoading} />}
      {tab === 4 && <AnomaliesTab b={b} rows={rows} />}
      {tab === 5 && <div className="tpane act"><CartesCarburantPanel /></div>}
    </div>
  );
}

/* ═══════════════════════════ ONGLET ENTRÉES ═══════════════════════════ */

function SubTabs({ tabs, active, onChange }: { tabs: string[]; active: number; onChange: (i: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '2px 0 14px', padding: 4, background: 'var(--s0)', borderRadius: 8, border: '1px solid var(--bd)', width: 'fit-content', maxWidth: '100%' }}>
      {tabs.map((t, i) => (
        <button key={t} onClick={() => onChange(i)} style={{
          padding: '5px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: '.74rem', fontWeight: i === active ? 600 : 400,
          background: i === active ? 'var(--s1)' : 'transparent', color: i === active ? 'var(--tp)' : 'var(--tm)',
          boxShadow: i === active ? '0 1px 3px rgba(0,0,0,.12)' : 'none',
        }}>{t}</button>
      ))}
    </div>
  );
}

/**
 * « Mouvements carburant » (retour DG) : un seul onglet pour TOUT ce qui bouge —
 * les pleins véhicules / engins ET les entrées (cartes, régie, cuves). Un plein est
 * à la fois un achat et une consommation ; les séparer en 2 menus n'avait pas de sens.
 * Les calculs (contrôle, bilan) ne sont PAS impactés : ils partent des données brutes,
 * pas de ces vues.
 */
function MouvementsTab({ month, b, loading, sub, setSub }: { month: string; b: any; loading: boolean; sub: number; setSub: (i: number) => void }) {
  return (
    <div className="tpane act">
      <SubTabs tabs={['Vue d\'ensemble', 'Pleins véhicules', 'Pleins engins', 'Cuve chantier (appro)', 'Bons régie', 'Registre détaillé']} active={sub} onChange={setSub} />
      {sub === 0 && <EntreesVue month={month} b={b} loading={loading} />}
      {sub === 1 && <PleinsVehiculesPanel month={month} />}
      {sub === 2 && <PleinsEnginsPanel month={month} />}
      {sub === 3 && <FuelStockTab focus="appro" />}
      {sub === 4 && <RegieTabWrap />}
      {sub === 5 && <RegistreDetaille month={month} />}
    </div>
  );
}

/**
 * « Conso site » (retour DG) : où part le carburant — la consommation ventilée par
 * catégorie + les sorties des cuves de chantier. (L'ex-onglet « Consommations » renommé.)
 */
function ConsoSiteTab({ month, b, loading, sub, setSub }: { month: string; b: any; loading: boolean; sub: number; setSub: (i: number) => void }) {
  return (
    <div className="tpane act">
      <SubTabs tabs={['Où part le carburant', 'Sorties de cuve site']} active={sub} onChange={setSub} />
      {sub === 0 && <ConsommationsVue month={month} b={b} loading={loading} />}
      {sub === 1 && <FuelStockTab focus="sortie" />}
    </div>
  );
}

function EntreesVue({ month, b, loading }: { month: string; b: any; loading: boolean }) {
  if (loading || !b) return <Loading />;
  const CANALS: { key: string; lKey: string; vKey: string; label: string }[] = [
    { key: 'appro', lKey: 'approsCuves', vKey: 'approsValue', label: 'Approvisionnement cuves' },
    { key: 'carte', lKey: 'achatsCartes', vKey: 'achatsCartesValue', label: 'Cartes NAFTAL' },
    { key: 'regie', lKey: 'achatsRegie', vKey: 'achatsRegieValue', label: 'Bons régie' },
    { key: 'pompe', lKey: 'achatsPompe', vKey: 'achatsPompeValue', label: 'Pompe externe' },
    { key: 'dotation', lKey: 'achatsDotationSite', vKey: 'achatsDotationSiteValue', label: 'Dotation site (pointage journalier)' },
    { key: 'manuel', lKey: 'achatsManuel', vKey: 'achatsManuelValue', label: 'Saisie manuelle' },
    { key: 'enginD', lKey: 'achatsEnginsDedies', vKey: 'achatsEnginsDediesValue', label: 'Pleins engins (saisie dédiée)' },
  ];
  const T = (ft: string) => b.parType[ft].entrees;
  const printIt = () => printReport('Entrées carburant', `Mois ${month}`, FT.filter((ft) => T(ft).total > 0).map((ft) => ({
    heading: FT_LABEL[ft],
    columns: ['Canal', 'Litres', 'Valeur (DA)'],
    rows: [
      ['Réserve début (cuves)', fk(T(ft).stockDebutCuves), ''],
      ...CANALS.map((c) => [c.label, fk(T(ft)[c.lKey]), fk(T(ft)[c.vKey])]),
      ['= Total disponible', fk(T(ft).total), fk(T(ft).totalValue)],
    ],
  })));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0 8px' }}>
        <button className="btn btn-o btn-sm" onClick={printIt}>Imprimer l&apos;état des entrées</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 12 }}>
        {FT.map((ft) => {
          const e = T(ft);
          const achats = e.total - e.stockDebutCuves;
          return (
            <div className="tc" key={ft} style={{ borderTop: `3px solid ${FT_COLOR[ft]}`, opacity: e.total ? 1 : 0.55 }}>
              <div className="th"><h3 style={{ fontSize: '.85rem' }}>{FT_LABEL[ft]}</h3></div>
              <div style={{ padding: '8px 12px 12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.74rem', color: 'var(--tm)' }}><span>Réserve début (cuves)</span><b style={{ color: 'var(--tp)' }}>{fk(e.stockDebutCuves)} L</b></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.74rem', color: 'var(--tm)', marginTop: 3 }}><span>+ Achats / appros période</span><b style={{ color: 'var(--tp)' }}>{fk(achats)} L</b></div>
                <div style={{ borderTop: '1px solid var(--bd)', margin: '6px 0', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: '.8rem' }}><b>Total disponible</b><b>{fk(e.total)} L</b></div>
                <div style={{ fontSize: '.72rem', color: 'var(--tm)' }}>{fk(e.totalValue)} DA d&apos;achats valorisés</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="tc">
        <div className="th"><h3>D&apos;où vient le carburant — par canal et par type ({month})</h3></div>
        <div className="tw">
          <table>
            <thead><tr><th>Canal d&apos;entrée</th>{FT.map((ft) => <th key={ft} style={{ textAlign: 'right' }}>{FT_LABEL[ft]}</th>)}<th style={{ textAlign: 'right' }}>Total</th></tr></thead>
            <tbody>
              <tr>
                <td style={{ color: 'var(--tm)' }}>Réserve début (cuves)</td>
                {FT.map((ft) => <td key={ft} style={{ textAlign: 'right' }}>{T(ft).stockDebutCuves ? `${fk(T(ft).stockDebutCuves)} L` : '—'}</td>)}
                <td style={{ textAlign: 'right', fontWeight: 600 }}>{fk(FT.reduce((s, ft) => s + T(ft).stockDebutCuves, 0))} L</td>
              </tr>
              {CANALS.map((c) => {
                const tot = FT.reduce((s, ft) => s + T(ft)[c.lKey], 0);
                const totV = FT.reduce((s, ft) => s + T(ft)[c.vKey], 0);
                return (
                  <tr key={c.key}>
                    <td>{c.label}</td>
                    {FT.map((ft) => (
                      <td key={ft} style={{ textAlign: 'right' }}>
                        {T(ft)[c.lKey] ? <>{fk(T(ft)[c.lKey])} L<div style={{ fontSize: '.62rem', color: 'var(--tm)' }}>{fk(T(ft)[c.vKey])} DA</div></> : '—'}
                      </td>
                    ))}
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{tot ? <>{fk(tot)} L<div style={{ fontSize: '.62rem', color: 'var(--tm)' }}>{fk(totV)} DA</div></> : '—'}</td>
                  </tr>
                );
              })}
              <tr style={{ fontWeight: 700, background: 'var(--s2)' }}>
                <td>TOTAL DISPONIBLE</td>
                {FT.map((ft) => <td key={ft} style={{ textAlign: 'right' }}>{fk(T(ft).total)} L</td>)}
                <td style={{ textAlign: 'right' }}>{fk(FT.reduce((s, ft) => s + T(ft).total, 0))} L</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: '.72rem', color: 'var(--tm)', padding: '8px 12px' }}>
          Chaque plein carte / régie / pompe / manuel est à la fois une <b>entrée</b> (achat) et une <b>consommation</b> attribuée au véhicule.
          Les onglets « Pleins véhicules / engins », « Cuves » et « Bons régie » servent à saisir ces entrées.
        </div>
      </div>
    </>
  );
}

/* ═══════════════ CONSOMMATION VENTILÉE (sous « Mouvements → Vue d'ensemble ») ═══════════════ */

function ConsommationsVue({ month, b, loading }: { month: string; b: any; loading: boolean }) {
  const [open, setOpen] = useState<string | null>(null);
  if (loading || !b) return <Loading />;
  const cats = BILAN_CAT_KEYS;
  const T = (ft: string) => b.parType[ft].sorties;

  const printIt = () => printReport('Consommations carburant', `Mois ${month}`, FT.filter((ft) => T(ft).total > 0).map((ft) => ({
    heading: FT_LABEL[ft],
    columns: ['Catégorie', 'Litres', 'Km / Heures', 'Conso', 'Valeur (DA)'],
    rows: [
      ...cats.map((k) => {
        const s = T(ft)[k];
        return [BILAN_CAT[k].label, fk(s.liters),
          [s.km ? `${fk(s.km)} km` : null, s.hours ? `${fk(s.hours)} h` : null].filter(Boolean).join(' + ') || '—',
          [s.consoKm != null ? `${s.consoKm} L/100` : null, s.consoH != null ? `${s.consoH} L/h` : null].filter(Boolean).join(' · ') || '—',
          fk(s.value)];
      }),
      ['= TOTAL CONSOMMÉ', fk(T(ft).total), '', '', fk(T(ft).totalValue)],
    ],
  })));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0 8px' }}>
        <button className="btn btn-o btn-sm" onClick={printIt}>Imprimer l&apos;état des consommations</button>
      </div>
      {FT.filter((ft) => T(ft).total > 0).map((ft) => (
        <div className="tc" key={ft} style={{ marginBottom: 12, borderTop: `3px solid ${FT_COLOR[ft]}` }}>
          <div className="th"><h3>{FT_LABEL[ft]} — où part le carburant ({month})</h3>
            <span style={{ fontSize: '.78rem', color: 'var(--tm)' }}>{fk(T(ft).total)} L · {fk(T(ft).totalValue)} DA</span>
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>Catégorie de consommation</th><th>Litres</th><th>Km / Heures faits</th><th>Conso moyenne</th><th>Valeur (DA)</th><th>Part</th><th /></tr></thead>
              <tbody>
                {cats.map((k) => {
                  const s = T(ft)[k];
                  if (!s.liters && !s.items.length) return null;
                  const pct = T(ft).total > 0 ? Math.round((s.liters / T(ft).total) * 100) : 0;
                  const kmH = [s.km ? `${fk(s.km)} km` : null, s.hours ? `${fk(s.hours)} h` : null].filter(Boolean).join(' + ') || '—';
                  const conso = [s.consoKm != null ? `${s.consoKm} L/100` : null, s.consoH != null ? `${s.consoH} L/h` : null].filter(Boolean).join(' · ') || '—';
                  const key = `${ft}-${k}`;
                  return (
                    <FragmentRow key={key}
                      row={
                        <tr className={s.items.length ? 'clickable' : ''} onClick={() => s.items.length && setOpen(open === key ? null : key)}>
                          <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 10, height: 10, borderRadius: 2, background: BILAN_CAT[k].color }} />{BILAN_CAT[k].label}</span></td>
                          <td style={{ fontWeight: 600 }}>{fk(s.liters)} L</td>
                          <td>{kmH}</td>
                          <td>{conso}</td>
                          <td>{fk(s.value)} DA</td>
                          <td>{pct}%</td>
                          <td style={{ color: 'var(--tm)', fontSize: '.7rem' }}>{s.items.length ? (open === key ? '▾' : `▸ ${s.items.length}`) : '—'}</td>
                        </tr>
                      }
                      detail={open === key && s.items.length ? (
                        <tr><td colSpan={7} style={{ padding: 0, background: 'var(--s0)' }}>
                          <table style={{ width: '100%', fontSize: '.72rem' }}>
                            <thead><tr><th>Véhicule</th><th>Usage</th><th>Km / H</th><th>Litres</th><th>Valeur</th><th>Écart / norme</th><th>Verdict</th></tr></thead>
                            <tbody>
                              {s.items.map((it: any, i: number) => (
                                <tr key={i}>
                                  <td style={{ fontWeight: 600 }}>{it.code} <span style={{ color: 'var(--tm)', fontWeight: 400 }}>{it.label}</span></td>
                                  <td>{it.usage}</td>
                                  <td>{it.hours != null ? `${fk(it.hours)} h` : it.km != null ? `${fk(it.km)} km` : '—'}</td>
                                  <td style={{ fontWeight: 600 }}>{fk(it.liters)} L</td>
                                  <td>{fk(it.value)} DA</td>
                                  <td style={it.ecartPct != null ? ecCls(it.ecartPct) : undefined}>{it.ecartPct != null ? `${it.ecartPct > 0 ? '+' : ''}${it.ecartPct}%` : '—'}</td>
                                  <td>{it.verdict ? <span style={{ color: vColor(it.verdict), fontWeight: 600 }}>{V_LABEL[it.verdict]}</span> : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td></tr>
                      ) : null}
                    />
                  );
                })}
                <tr style={{ fontWeight: 700, background: 'var(--s2)' }}>
                  <td>TOTAL CONSOMMÉ</td><td>{fk(T(ft).total)} L</td><td /><td /><td>{fk(T(ft).totalValue)} DA</td><td>100%</td><td />
                </tr>
                {T(ft).stockFinCuves > 0 && (
                  <tr style={{ color: 'var(--tm)' }}><td>Reste en cuve (non consommé)</td><td>{fk(T(ft).stockFinCuves)} L</td><td colSpan={5} /></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {!FT.some((ft) => T(ft).total > 0) && <div className="tc"><div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)' }}>Aucune consommation enregistrée ce mois.</div></div>}
    </>
  );
}

function FragmentRow({ row, detail }: { row: React.ReactNode; detail: React.ReactNode }) {
  return <>{row}{detail}</>;
}

function RegistreDetaille({ month }: { month: string }) {
  const fuel = useFuelEntries();
  const eng = useEngineFuelEntries();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const D = drivers.data ?? [];
  const drName = (c: string | null) => D.find((d) => d.code === c)?.name ?? c ?? '—';
  const FU = (fuel.data ?? []).filter((f) => inMonth(f.date, month));
  const FUE = (eng.data ?? []).filter((f) => inMonth(f.date, month));
  const vLabel = (c: string) => { const v = vehicles.data?.find((x) => x.code === c); return v ? `${v.brand ?? ''} ${v.model ?? ''}`.trim() : ''; };

  const list = useMemo(() => [
    ...FU.map((f) => ({
      id: f.id, date: f.date, code: f.vehicleCode, label: vLabel(f.vehicleCode), driver: drName(f.driverCode),
      ft: canon(f.fuelType, f.grade), qty: f.qty, amount: f.amount ?? Math.round((f.qty ?? 0) * (f.unitPrice ?? 0)),
      src: f.source ?? 'manuel', ref: f.cardNumber ?? (f as { siteCode?: string }).siteCode ?? '', kind: 'V',
    })),
    ...FUE.map((f) => ({
      id: f.id, date: f.date, code: f.vehicleCode, label: vLabel(f.vehicleCode), driver: f.operator ?? '—',
      ft: canon(f.fuelType), qty: f.qty, amount: Math.round((f.qty ?? 0) * (f.unitPrice ?? 0)),
      src: 'engin_dedie', ref: '', kind: 'E',
    })),
  ].sort((a, b) => String(b.date).localeCompare(String(a.date))), [fuel.data, eng.data, vehicles.data, drivers.data, month]);

  const search = useSearch(list, (r) => [r.date, r.code, r.label, r.driver, r.ft, SRC_LABEL[r.src]].join(' '));
  const tot = search.filtered.reduce((s, r) => s + (r.qty ?? 0), 0);
  const totA = search.filtered.reduce((s, r) => s + (r.amount ?? 0), 0);

  return (
    <div className="tc">
      <div className="th"><h3>Registre détaillé — tous les pleins ({month})</h3>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <SearchBox value={search.q} onChange={search.setQ} placeholder="Véhicule, chauffeur, canal…" count={search.count} total={list.length} />
          <button className="btn btn-o btn-sm" onClick={() => downloadCSV(`pleins-${month}`, ['Date', 'Véhicule', 'Désignation', 'Chauffeur/Opérateur', 'Carburant', 'Litres', 'Montant DA', 'Canal', 'Réf.'],
            search.filtered.map((r) => [r.date, r.code, r.label, r.driver, FT_LABEL[r.ft], r.qty, r.amount, SRC_LABEL[r.src], r.ref]))}>Export</button>
        </div>
      </div>
      <div className="tw">
        <table>
          <thead><tr><th>Date</th><th>Véhicule / Engin</th><th>Chauffeur / Opérateur</th><th>Carburant</th><th>Litres</th><th>Montant</th><th>Canal</th><th>Réf.</th></tr></thead>
          <tbody>
            {search.filtered.map((r) => (
              <tr key={`${r.kind}-${r.id}`}>
                <td>{fd(r.date)}</td>
                <td style={{ fontWeight: 600 }}>{r.code} <span style={{ fontWeight: 400, color: 'var(--tm)' }}>{r.label}</span></td>
                <td>{r.driver}</td>
                <td><span className="bg" style={{ background: `${FT_COLOR[r.ft]}22`, color: FT_COLOR[r.ft] }}>{FT_LABEL[r.ft]}</span></td>
                <td style={{ fontWeight: 600 }}>{fk(r.qty)} L</td>
                <td>{fk(r.amount)} DA</td>
                <td><span className="bg bg-t">{SRC_LABEL[r.src] ?? r.src}</span></td>
                <td style={{ fontSize: '.7rem', color: 'var(--tm)' }}>{r.ref || '—'}</td>
              </tr>
            ))}
            {!search.filtered.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun plein ce mois</td></tr>}
            {!!search.filtered.length && <tr style={{ fontWeight: 700, background: 'var(--s2)' }}><td colSpan={4}>TOTAL</td><td>{fk(Math.round(tot))} L</td><td>{fk(Math.round(totA))} DA</td><td colSpan={2} /></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ═══════════════════════════ ONGLET CONTRÔLE ═══════════════════════════ */

function ControleTab({ month, rows, loading }: { month: string; rows: any[]; loading: boolean }) {
  const upsert = useUpsertMonthlyKm();
  const suivi = useReleveSuivi(month);
  const [sub, setSub] = useState(0);
  const [edit, setEdit] = useState<any>(null);
  const [E, setE] = useState<any>({});
  const [q, setQ] = useState('');

  // Ouvre la saisie — accepte une ligne du contrôle (r.reading) OU une ligne du suivi (r.debut/r.fin).
  const openEdit = (r: any) => {
    const rd = r.reading ?? null;
    const dbt = r.debut ?? null; const fin = r.fin ?? null;
    const isEngin = !!r.isEngin || r.method === 'heures_engin' || r.type === 'ENGIN';
    const val = (a: any, b: any) => { const v = a ?? b; return v == null ? '' : v; };
    setEdit({ vehicleCode: r.vehicleCode, label: r.label, isEngin,
      openingDone: rd ? r.openingDone : dbt?.fait, closingDone: rd ? r.closingDone : fin?.fait });
    setE({
      kmStart: val(rd?.kmStart, isEngin ? null : dbt?.valeur), kmEnd: val(rd?.kmEnd, isEngin ? null : fin?.valeur),
      hoursStart: val(rd?.hoursStart, isEngin ? dbt?.valeur : null), hoursEnd: val(rd?.hoursEnd, isEngin ? fin?.valeur : null),
      tankStart: val(rd?.tankStart, r.tankStart ?? dbt?.reservoir), tankEnd: val(rd?.tankEnd, fin?.reservoir),
    });
  };
  const saveEdit = async () => {
    const num = (v: any) => (v === '' || v == null ? null : Number(v));
    await upsert.mutateAsync({
      vehicleCode: edit.vehicleCode, month,
      kmStart: num(E.kmStart), kmEnd: num(E.kmEnd), hoursStart: num(E.hoursStart), hoursEnd: num(E.hoursEnd),
      tankStart: num(E.tankStart), tankEnd: num(E.tankEnd),
    });
    toast.success('Relevé enregistré'); setEdit(null);
  };

  const filtered = q ? rows.filter((r) => `${r.vehicleCode}${r.label}${r.usage}${r.verdict}`.toLowerCase().includes(q.toLowerCase())) : rows;
  const groups = CAT_ORDER.map((cat) => ({ cat, items: filtered.filter((r) => r.category === cat) })).filter((g) => g.items.length);

  const printIt = () => printReport('Contrôle carburant mensuel', `Mois ${month}`, groups.map((grp) => ({
    heading: CAT_LABEL[grp.cat],
    columns: ['Véhicule', 'Réservoir dbt→fin', 'Achats L', 'Conso nette L', grp.cat === 'engin_site' ? 'Heures' : 'Km fait', 'Théorique', 'Écart %', 'Verdict'],
    rows: grp.items.map((r) => [
      `${r.vehicleCode} ${r.label}`,
      r.tankDeclared ? `${r.tankStart} → ${r.tankEnd} L` : 'non déclaré',
      fk(r.litresAchetes), fk(r.litresNets),
      grp.cat === 'engin_site' ? (r.hoursFait ?? '—') : (r.kmFait ?? '—'),
      grp.cat === 'engin_site' ? (r.litresTheoriques ?? '—') : (r.kmTheorique ?? '—'),
      r.ecartPct != null ? `${r.ecartPct > 0 ? '+' : ''}${r.ecartPct}%` : '—',
      V_LABEL[r.verdict] ?? r.verdict,
    ]),
  })));

  if (loading) return <div className="tpane act"><Loading /></div>;

  return (
    <div className="tpane act">
      <SubTabs tabs={['Suivi des relevés', 'Analyse de consommation']} active={sub} onChange={setSub} />

      {sub === 0 && <ReleveSuiviView data={suivi.data} loading={suivi.isLoading} month={month} onEdit={openEdit} />}

      {sub === 1 && (<>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0' }}>
        <SearchBox value={q} onChange={setQ} placeholder="Véhicule, usage, verdict…" count={filtered.length} total={rows.length} />
        <span style={{ fontSize: '.75rem', color: 'var(--tm)' }}>
          {rows.filter((r) => r.verdict === 'anomalie').length} anomalie(s) · {rows.filter((r) => r.verdict === 'surveiller').length} à surveiller · {rows.filter((r) => r.verdict === 'incomplet').length} incomplet(s)
        </span>
        <button className="btn btn-o btn-sm" onClick={printIt}>Imprimer le contrôle</button>
      </div>

      <div style={{ fontSize: '.74rem', color: 'var(--tm)', background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '8px 10px', marginBottom: 10 }}>
        <b>Conso nette</b> = achats du mois − (réservoir fin − réservoir début). Comparée au <b>théorique constructeur</b> :
        missions &amp; permanents sur les km faits · engins sur les heures de pointage · véhicules légers site sur km début / fin.
        La ligne bleue sous chaque véhicule non conforme <b>explique en clair pourquoi</b>.
      </div>

      {groups.map((grp) => {
        const isEngin = grp.cat === 'engin_site';
        const methods = [...new Set(grp.items.map((r: any) => r.controlMethod))];
        const methodLbl = methods.map((m) => CTRL_METHOD_LABEL[m as string] ?? m).join(' · ');
        return (
          <div className="tc" key={grp.cat} style={{ marginBottom: 12 }}>
            <div className="th"><h3>{CAT_LABEL[grp.cat]} <span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.78rem' }}>· {grp.items.length} {isEngin ? 'engin(s)' : 'véhicule(s)'} · contrôle {methodLbl}</span></h3></div>
            <div className="tw" style={{ overflowX: 'auto' }}>
              <table style={{ fontSize: '.72rem', minWidth: 780 }}>
                <thead><tr>
                  <th>Véhicule</th>
                  <th>Relevé {isEngin ? 'heures' : 'km'} · réservoir</th>
                  <th>Achats (L)</th><th>Conso nette</th>
                  <th>{isEngin ? 'Heures' : 'Km'} fait / théo.</th>
                  <th>Conso réelle / norme</th>
                  <th>Verdict</th><th />
                </tr></thead>
                <tbody>
                  {grp.items.map((r) => { const why = verdictReason(r); return (
                    <FragmentRow key={r.vehicleCode}
                      row={
                    <tr style={r.verdict === 'anomalie' ? { background: 'var(--r1)' } : r.verdict === 'incomplet' ? { background: 'var(--b0)' } : undefined}>
                      <td style={{ fontWeight: 600 }}>{r.vehicleCode}
                        <div style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.64rem' }}>{r.label}</div>
                        <span style={{ fontSize: '.58rem', color: FT_COLOR[r.fuelType] ?? 'var(--tm)' }}>{FT_LABEL[r.fuelType] ?? r.fuelType}</span>
                      </td>
                      <td style={{ fontSize: '.68rem' }}>
                        {isEngin
                          ? (r.reading?.hoursStart != null && r.reading?.hoursEnd != null ? `${fk(r.reading.hoursStart)} → ${fk(r.reading.hoursEnd)} h` : <MissingKm r={r} />)
                          : (r.reading?.kmStart != null && r.reading?.kmEnd != null ? `${fk(r.reading.kmStart)} → ${fk(r.reading.kmEnd)} km` : <MissingKm r={r} />)}
                        {!isEngin && r.kmMissions > 0 && <div style={{ color: 'var(--tm)', fontSize: '.6rem' }}>missions {fk(r.kmMissions)} km{r.kmNonJustifie ? ` · non justif. ${fk(r.kmNonJustifie)}` : ''}</div>}
                        <div style={{ fontSize: '.6rem', color: r.tankDeclared ? (r.deltaTank > 0 ? 'var(--g6)' : r.deltaTank < 0 ? 'var(--a6)' : 'var(--tm)') : 'var(--a6)' }}>
                          {r.tankDeclared ? `réservoir ${fk(r.tankStart)} → ${fk(r.tankEnd)} L (Δ ${r.deltaTank > 0 ? '+' : ''}${fk(r.deltaTank)})` : 'réservoir non déclaré'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{fk(r.litresAchetes)} L
                        <div style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.58rem' }}>
                          {Object.entries(r.litresBySource ?? {}).filter(([, l]) => (l as number) > 0).map(([s, l]) => `${SRC_LABEL[s] ?? s} ${fk(l as number)}`).join(' · ') || '—'}
                        </div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{fk(r.litresNets)} L</td>
                      <td>{isEngin
                        ? `${r.hoursFait != null ? fk(r.hoursFait) + ' h' : '—'} / ${r.litresTheoriques != null ? fk(r.litresTheoriques) + ' L' : '—'}`
                        : `${r.kmFait != null ? fk(r.kmFait) : '—'} / ${r.kmTheorique != null ? fk(r.kmTheorique) : '—'} km`}</td>
                      <td>
                        <span style={{ fontWeight: 600 }}>{r.consoReelle != null ? `${r.consoReelle}` : '—'}</span> / {r.norme ?? '—'}
                        {r.ecartPct != null && <div style={{ fontSize: '.66rem', ...ecCls(r.ecartPct) }}>{r.ecartPct > 0 ? '+' : ''}{r.ecartPct}% ({r.ecartLitres > 0 ? '+' : ''}{fk(Math.round(r.ecartLitres))} L)</div>}
                      </td>
                      <td>
                        <span style={{ color: vColor(r.verdict), fontWeight: 700 }}>{V_LABEL[r.verdict] ?? r.verdict}</span>
                        {(r.flags ?? []).filter((f: string) => !['reservoir_non_declare', 'km_manquant', 'heures_manquantes'].includes(f)).map((f: string) => <div key={f} style={{ fontSize: '.56rem', color: 'var(--a6)' }}>{FLAG_LABEL[f] ?? f}</div>)}
                      </td>
                      <td><button className="btn btn-o btn-sm" onClick={() => openEdit(r)}>Relevé</button></td>
                    </tr>
                      }
                      detail={why && r.verdict !== 'conforme' ? (
                        <tr><td colSpan={8} style={{ background: r.verdict === 'anomalie' ? 'var(--r1)' : 'var(--b0)', fontSize: '.68rem', color: 'var(--tp)', padding: '4px 10px', borderBottom: '2px solid var(--bd)' }}>
                          <b style={{ color: vColor(r.verdict) }}>Pourquoi {(V_LABEL[r.verdict] ?? '').toLowerCase()} :</b> {why}
                        </td></tr>
                      ) : null}
                    />
                  ); })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      {!groups.length && <div className="tc"><div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)' }}>Aucun véhicule avec activité carburant ce mois.</div></div>}
      </>)}

      {edit && (() => {
        const isEngin = !!edit.isEngin || edit.category === 'engin_site';
        const unit = isEngin ? 'Compteur heures' : 'Km';
        return (
        <Modal open onClose={() => setEdit(null)} title={`Relevés du mois — ${edit.vehicleCode} · ${month}`}
          footer={<><button className="btn btn-o" onClick={() => setEdit(null)}>Annuler</button><button className="btn btn-p" onClick={saveEdit} disabled={upsert.isPending}>Enregistrer</button></>}>
          <div style={{ fontSize: '.72rem', color: 'var(--tm)', marginBottom: 8 }}>
            Deux relevés distincts par mois : <b>ouverture</b> (le 1<sup>er</sup>) et <b>clôture</b> (fin de mois), pour le {isEngin ? 'compteur horaire' : 'kilométrage'} <b>et</b> le niveau de réservoir.
          </div>

          <div style={{ border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '8px 10px', marginBottom: 10 }}>
            <div style={{ fontSize: '.74rem', fontWeight: 700, marginBottom: 6, color: edit.openingDone ? 'var(--g6)' : 'var(--a6)' }}>
              {edit.openingDone ? '✓' : '●'} Relevé d&apos;OUVERTURE — début de {month}
            </div>
            <div className="form-r">
              <div className="form-g"><label>{unit} — début {edit.tankStart != null && !edit.reading?.[isEngin ? 'hoursStart' : 'kmStart'] && <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(report du mois précédent)</span>}</label>
                <input type="number" value={isEngin ? E.hoursStart : E.kmStart} onChange={(e) => setE({ ...E, [isEngin ? 'hoursStart' : 'kmStart']: e.target.value })} placeholder="0" /></div>
              <div className="form-g"><label>Réservoir — début (L)</label>
                <input type="number" value={E.tankStart} onChange={(e) => setE({ ...E, tankStart: e.target.value })} placeholder={edit.tankStart != null ? String(edit.tankStart) : '0'} /></div>
            </div>
          </div>

          <div style={{ border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '8px 10px' }}>
            <div style={{ fontSize: '.74rem', fontWeight: 700, marginBottom: 6, color: edit.closingDone ? 'var(--g6)' : 'var(--a6)' }}>
              {edit.closingDone ? '✓' : '●'} Relevé de CLÔTURE — fin de {month}
            </div>
            <div className="form-r">
              <div className="form-g"><label>{unit} — fin</label>
                <input type="number" value={isEngin ? E.hoursEnd : E.kmEnd} onChange={(e) => setE({ ...E, [isEngin ? 'hoursEnd' : 'kmEnd']: e.target.value })} placeholder="0" /></div>
              <div className="form-g"><label>Réservoir — fin (L)</label>
                <input type="number" value={E.tankEnd} onChange={(e) => setE({ ...E, tankEnd: e.target.value })} placeholder="0" /></div>
            </div>
          </div>

          <div style={{ fontSize: '.72rem', color: 'var(--tm)', marginTop: 8 }}>
            Conso réelle = carburant acheté − (réservoir fin − réservoir début). Sans le relevé réservoir, le carburant resté dans le réservoir est compté comme consommé.
          </div>
        </Modal>
        );
      })()}
    </div>
  );
}

/* ─── Suivi des relevés : petit menu de vérification (retour DG) ─────────────────────
   Deux étapes distinctes : qui a donné km + réservoir DÉBUT · qui a donné km + réservoir FIN. */
const SUIVI_STATUT: Record<string, { txt: string; c: string; bg: string }> = {
  fait: { txt: '✓ fait', c: 'var(--g6)', bg: 'var(--g1)' },
  a_faire: { txt: '● à faire', c: 'var(--a6)', bg: 'var(--a1)' },
  a_venir: { txt: 'à venir (fin de mois)', c: 'var(--b6)', bg: 'var(--b0)' },
  en_retard: { txt: 'en retard', c: 'var(--r6)', bg: 'var(--r1)' },
};
function SuiviBadge({ s }: { s: string }) {
  const v = SUIVI_STATUT[s] ?? SUIVI_STATUT.a_faire;
  return <span style={{ fontSize: '.66rem', fontWeight: 700, color: v.c, background: v.bg, padding: '2px 7px', borderRadius: 999 }}>{v.txt}</span>;
}
function ReleveSuiviView({ data, loading, month, onEdit }: { data: any; loading: boolean; month: string; onEdit: (r: any) => void }) {
  if (loading || !data) return <Loading />;
  const items: any[] = data.items ?? [];
  const r = data.resume ?? {};
  const Half = ({ phase, title, hint }: { phase: 'debut' | 'fin'; title: string; hint: string }) => (
    <div className="tc" style={{ marginBottom: 14 }}>
      <div className="th"><h3>{title} <span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.78rem' }}>· {hint}</span></h3></div>
      <div className="tw" style={{ overflowX: 'auto' }}>
        <table style={{ fontSize: '.72rem', minWidth: 620 }}>
          <thead><tr>
            <th>Véhicule</th><th>Usage</th>
            <th>{`Km / Heures ${phase === 'debut' ? 'début' : 'fin'}`}</th>
            <th>{`Réservoir ${phase === 'debut' ? 'début' : 'fin'}`}</th>
            <th>Demandé le</th><th>Statut</th><th />
          </tr></thead>
          <tbody>
            {items.map((it) => {
              const p = it[phase];
              return (
                <tr key={it.vehicleCode} style={p.statut === 'en_retard' ? { background: 'var(--r1)' } : undefined}>
                  <td style={{ fontWeight: 600 }}>{it.vehicleCode}
                    <div style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.62rem' }}>{it.label}</div></td>
                  <td style={{ fontSize: '.66rem', color: 'var(--tm)' }}>{it.usage}</td>
                  <td style={{ fontWeight: 600, color: p.valeur == null ? 'var(--r6)' : 'var(--tp)' }}>
                    {p.valeur != null ? `${fk(p.valeur)} ${it.unit}` : '—'}</td>
                  <td style={{ fontWeight: 600, color: p.reservoir == null ? 'var(--r6)' : 'var(--tp)' }}>
                    {p.reservoir != null ? `${fk(p.reservoir)} L` : '—'}</td>
                  <td style={{ fontSize: '.64rem', color: 'var(--tm)' }}>{p.demandeLe}{p.faitLe ? ` · fait ${p.faitLe}` : ''}</td>
                  <td><SuiviBadge s={p.statut} /></td>
                  <td><button className="btn btn-o btn-sm" onClick={() => onEdit(it)}>{p.fait ? 'Voir' : 'Saisir'}</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: '.74rem', color: 'var(--tm)', background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '8px 10px', marginBottom: 10 }}>
        Chaque véhicule doit donner <b>2 relevés distincts</b> par mois — <b>km/heures + niveau réservoir</b> — un en <b>début</b> de mois, un en <b>fin</b>. Les deux demandes sont émises dès le 1<sup>er</sup>.
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--b0)', fontSize: '.72rem' }}><b>{r.total ?? 0}</b> véhicules · {month}</span>
        <span style={{ padding: '5px 12px', borderRadius: 8, background: (r.debutManquant ?? 0) > 0 ? 'var(--a1)' : 'var(--g1)', color: (r.debutManquant ?? 0) > 0 ? 'var(--a6)' : 'var(--g6)', fontSize: '.72rem', fontWeight: 600 }}>{r.debutManquant ?? 0} sans relevé de début</span>
        <span style={{ padding: '5px 12px', borderRadius: 8, background: (r.finManquant ?? 0) > 0 ? 'var(--a1)' : 'var(--g1)', color: (r.finManquant ?? 0) > 0 ? 'var(--a6)' : 'var(--g6)', fontSize: '.72rem', fontWeight: 600 }}>{r.finManquant ?? 0} sans relevé de fin</span>
        <span style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--g1)', color: 'var(--g6)', fontSize: '.72rem', fontWeight: 600 }}>{r.complet ?? 0} complets</span>
      </div>
      <Half phase="debut" title="Relevés de DÉBUT de mois" hint="km / heures + réservoir de départ — dû dès le 1er" />
      <Half phase="fin" title="Relevés de FIN de mois" hint={`km / heures + réservoir de fin — dû le ${data.dueDate}`} />
    </div>
  );
}

/* ═══════════════════════ ONGLET BILAN PAR CARBURANT ═══════════════════════ */

function BilanTab({ month, b, loading }: { month: string; b: any; loading: boolean }) {
  const createOp = useCreateFuelStockOp();
  const [initFor, setInitFor] = useState<{ siteCode: string; fuelType: string } | null>(null);
  const [initVal, setInitVal] = useState('');
  if (loading || !b) return <div className="tpane act"><Loading /></div>;

  const saveInitial = async () => {
    if (!initFor || !Number(initVal)) return;
    const [y, m] = month.split('-').map(Number);
    await createOp.mutateAsync({
      siteCode: initFor.siteCode, fuelType: initFor.fuelType, opType: 'initial',
      date: `${y}-${String(m).padStart(2, '0')}-01`, liters: Number(initVal), supplier: 'Stock de départ (inventaire cuve)',
    });
    toast.success('Stock initial enregistré'); setInitFor(null); setInitVal('');
  };

  const printIt = () => printReport('Bilan carburant par type', `Mois ${month}`, FT.filter((ft) => b.parType[ft].entrees.total > 0).map((ft) => {
    const t = b.parType[ft];
    return {
      heading: FT_LABEL[ft],
      columns: ['Poste', 'Litres', 'Valeur (DA)'],
      rows: [
        ['Réserve début — cuves', fk(t.entrees.stockDebutCuves), ''],
        [`Réserve début — réservoirs véhicules (${t.reservoirsNbDeclares} déclaré${t.reservoirsNbDeclares > 1 ? 's' : ''})`, fk(t.reservoirsDebut), ''],
        ['+ Approvisionnements cuve', fk(t.entrees.approsCuves), fk(t.entrees.approsValue)],
        ['+ Cartes NAFTAL', fk(t.entrees.achatsCartes), fk(t.entrees.achatsCartesValue)],
        ['+ Bons régie', fk(t.entrees.achatsRegie), fk(t.entrees.achatsRegieValue)],
        ['+ Pompe externe', fk(t.entrees.achatsPompe), fk(t.entrees.achatsPompeValue)],
        ['+ Dotation site (pointage)', fk(t.entrees.achatsDotationSite), fk(t.entrees.achatsDotationSiteValue)],
        ['+ Saisie manuelle', fk(t.entrees.achatsManuel), fk(t.entrees.achatsManuelValue)],
        ['+ Pleins engins dédiés', fk(t.entrees.achatsEnginsDedies), fk(t.entrees.achatsEnginsDediesValue)],
        ['− Carburant fourni aux missions', fk(t.sorties.missions.liters), fk(t.sorties.missions.value)],
        ['− Carburant fourni aux affectations permanentes', fk(t.sorties.permanents.liters), fk(t.sorties.permanents.value)],
        ['− Carburant fourni aux véhicules légers site', fk(t.sorties.vlSite.liters), fk(t.sorties.vlSite.value)],
        ['− Carburant fourni aux engins de chantier', fk(t.sorties.engins.liters), fk(t.sorties.engins.value)],
        ['− Carburant fourni aux véhicules externes', fk(t.sorties.externes.liters), fk(t.sorties.externes.value)],
        [`  dont entré dans les réservoirs (non brûlé)`, `${t.deltaReservoirs > 0 ? '−' : '+'}${fk(Math.abs(t.deltaReservoirs))}`, ''],
        ['= CONSOMMATION RÉELLE (brûlée)', fk(t.consoNette), ''],
        ['Réserve fin — cuves', fk(t.sorties.stockFinCuves), ''],
        ['Réserve fin — réservoirs véhicules', fk(t.reservoirsFin), ''],
        [t.reconcilie ? 'Écart de bilan — équilibré' : 'Écart de bilan — À INVESTIGUER', fk(t.ecart), `tolérance ±${fk(t.tolerance)}`],
        ['Écart d\'inventaire cuve (jauge vs théorie)', fk(t.cuveEcart), ''],
        ['Contrôle conso flotte : nette vs norme', `${fk(t.controle.litresNets)} / ${fk(t.controle.litresTheoriques)}`, `${t.controle.ecartConso > 0 ? '+' : ''}${fk(t.controle.ecartConso)} L (${t.controle.ecartConsoPct > 0 ? '+' : ''}${t.controle.ecartConsoPct}%)`],
      ],
    };
  }));

  return (
    <div className="tpane act">
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0 10px' }}>
        <button className="btn btn-o btn-sm" onClick={printIt}>Imprimer le bilan</button>
      </div>

      <div style={{ fontSize: '.74rem', color: 'var(--tm)', background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '8px 10px', marginBottom: 12 }}>
        Un manque de gasoil ne se compense jamais avec un surplus d&apos;essence : chaque type est équilibré séparément.
        <b> Réserve = cuves + carburant dans les réservoirs des véhicules</b> (déclaré au contrôle). La <b>consommation réelle</b> = carburant fourni − ce qui est resté dans les réservoirs.
        Trois signaux : l&apos;<b>écart de bilan</b> (carburant non justifié), l&apos;<b>écart d&apos;inventaire cuve</b> (jauge vs théorie), l&apos;<b>écart de consommation flotte</b> (ce qu&apos;on brûle vs la norme).
      </div>

      {FT.map((ft) => {
        const t = b.parType[ft];
        if (!t.entrees.total && !t.sorties.total) {
          return (
            <div className="tc" key={ft} style={{ marginBottom: 10, opacity: 0.5 }}>
              <div className="th"><h3>{FT_LABEL[ft]}</h3><span style={{ fontSize: '.76rem', color: 'var(--tm)' }}>aucun mouvement ce mois</span></div>
            </div>
          );
        }
        const entreeSegs = [
          { key: 'debut', label: 'Réserve cuves', liters: t.entrees.stockDebutCuves, color: '#0f766e' },
          { key: 'resv', label: 'Réservoirs véh.', liters: t.reservoirsDebut, color: '#134e4a' },
          { key: 'appro', label: 'Appro. cuve', liters: t.entrees.approsCuves, color: '#14b8a6' },
          { key: 'carte', label: 'Cartes', liters: t.entrees.achatsCartes, color: '#2563eb' },
          { key: 'regie', label: 'Régie', liters: t.entrees.achatsRegie, color: '#f59e0b' },
          { key: 'pompe', label: 'Pompe ext.', liters: t.entrees.achatsPompe, color: '#8b5cf6' },
          { key: 'dotation', label: 'Dotation site', liters: t.entrees.achatsDotationSite, color: '#0ea5e9' },
          { key: 'manuel', label: 'Manuel', liters: t.entrees.achatsManuel, color: '#94a3b8' },
          { key: 'enginD', label: 'Engins dédiés', liters: t.entrees.achatsEnginsDedies, color: '#a16207' },
        ].map((s) => ({ ...s, value: 0 }));
        const entreeTotalBar = Math.round(t.reserveDebutTotale + t.entrees.total - t.entrees.stockDebutCuves);
        const sortieSegs = [
          { key: 'conso', label: 'Consommation réelle (brûlée)', liters: t.consoNette, color: '#dc2626' },
          { key: 'finC', label: 'Réserve fin — cuves', liters: t.sorties.stockFinCuves, color: '#16a34a' },
          { key: 'finR', label: 'Réserve fin — réservoirs', liters: t.reservoirsFin, color: '#15803d' },
          ...(Math.abs(t.ecart) > 1 ? [{ key: 'ecart', label: 'Écart non justifié', liters: Math.abs(t.ecart), color: '#7f1d1d' }] : []),
        ].map((s) => ({ ...s, value: 0 }));
        const ctl = t.controle;
        return (
          <div className="tc" key={ft} style={{ marginBottom: 14, borderTop: `3px solid ${FT_COLOR[ft]}` }}>
            <div className="th"><h3>{FT_LABEL[ft]}</h3>
              <span style={{ fontSize: '.78rem', color: 'var(--tm)' }}>{fk(Math.round(t.reserveDebutTotale + t.entrees.total - t.entrees.stockDebutCuves))} L à justifier · {fk(t.entrees.totalValue)} DA d&apos;achats</span>
            </div>

            <div style={{ padding: 14 }}>
              <div style={{ fontSize: '.72rem', color: 'var(--tm)', marginBottom: 4 }}>RÉSERVE DÉBUT (cuves + réservoirs) + ACHATS DE LA PÉRIODE</div>
              <StackBar segs={entreeSegs} total={entreeTotalBar} />
              <BilanLegend segs={entreeSegs} total={entreeTotalBar} />
              <div style={{ textAlign: 'center', fontSize: '1.05rem', color: 'var(--tm)', margin: '8px 0' }}>⇩</div>
              <div style={{ fontSize: '.72rem', color: 'var(--tm)', marginBottom: 4 }}>CONSOMMATION RÉELLE + RÉSERVE FIN (cuves + réservoirs)</div>
              <StackBar segs={sortieSegs} total={entreeTotalBar} />
              <BilanLegend segs={sortieSegs} total={entreeTotalBar} />
            </div>

            <div className="sg" style={{ padding: '0 12px 12px' }}>
              <div className="sc"><div>
                <div className="sv" style={{ color: !t.reconcilie ? 'var(--r6)' : 'var(--g6)' }}>{t.ecart > 0 ? '+' : ''}{fk(t.ecart)} L</div>
                <div className="sl">Écart de bilan {t.reconcilie ? '— équilibré' : '— à investiguer'}</div>
                <div className="st">carburant ni consommé ni en réserve · tolérance ±{fk(t.tolerance)} L</div>
              </div></div>
              <div className="sc"><div>
                <div className="sv" style={{ color: Math.abs(t.cuveEcart) > 50 ? 'var(--r6)' : 'var(--g6)' }}>{t.cuveEcart > 0 ? '+' : ''}{fk(t.cuveEcart)} L</div>
                <div className="sl">Écart d&apos;inventaire cuve</div>
                <div className="st">jauge physique vs stock théorique</div>
              </div></div>
              <div className="sc"><div>
                <div className="sv" style={ctl.litresTheoriques > 0 ? ecCls(ctl.ecartConsoPct) : undefined}>{ctl.ecartConso > 0 ? '+' : ''}{fk(ctl.ecartConso)} L</div>
                <div className="sl">Écart de consommation flotte</div>
                <div className="st">{fk(ctl.litresNets)} L nets vs {fk(ctl.litresTheoriques)} L théo. ({ctl.ecartConsoPct > 0 ? '+' : ''}{ctl.ecartConsoPct}%) · {ctl.nbAnomalie} anomalie(s)</div>
              </div></div>
            </div>

            <div className="tw">
              <table>
                <thead><tr><th>Poste</th><th>Litres</th><th>Valeur (DA)</th></tr></thead>
                <tbody>
                  <tr><td style={{ color: 'var(--tm)' }}>Réserve début — cuves</td><td>{fk(t.entrees.stockDebutCuves)} L</td><td>—</td></tr>
                  <tr><td style={{ color: 'var(--tm)' }}>Réserve début — réservoirs véhicules <span style={{ fontSize: '.62rem' }}>({t.reservoirsNbDeclares} déclaré{t.reservoirsNbDeclares > 1 ? 's' : ''})</span></td><td>{fk(t.reservoirsDebut)} L</td><td>—</td></tr>
                  {[['Approvisionnements cuve', 'approsCuves', 'approsValue'], ['Cartes NAFTAL', 'achatsCartes', 'achatsCartesValue'], ['Bons régie', 'achatsRegie', 'achatsRegieValue'], ['Pompe externe', 'achatsPompe', 'achatsPompeValue'], ['Dotation site (pointage)', 'achatsDotationSite', 'achatsDotationSiteValue'], ['Saisie manuelle', 'achatsManuel', 'achatsManuelValue'], ['Pleins engins dédiés', 'achatsEnginsDedies', 'achatsEnginsDediesValue']].map(([lbl, lk, vk]) => (
                    (t.entrees[lk] > 0) ? <tr key={lk}><td>+ {lbl}</td><td style={{ color: 'var(--g6)' }}>{fk(t.entrees[lk])} L</td><td>{fk(t.entrees[vk])} DA</td></tr> : null
                  ))}
                  <tr style={{ fontWeight: 700, background: 'var(--s2)' }}><td>= À JUSTIFIER (réserve début + achats)</td><td>{fk(Math.round(t.reserveDebutTotale + t.entrees.total - t.entrees.stockDebutCuves))} L</td><td>{fk(t.entrees.totalValue)} DA</td></tr>
                  <tr style={{ background: 'var(--s1)' }}><td colSpan={3} style={{ fontSize: '.66rem', color: 'var(--tm)', padding: '3px 10px' }}>Consommation réelle ventilée (carburant brûlé, corrigé des réservoirs) :</td></tr>
                  {BILAN_CAT_KEYS.map((k) => (
                    (t.sorties[k].liters > 0 || t.sorties[k].items.length) ? (
                      <tr key={k}><td style={{ paddingLeft: 20 }}>{BILAN_CAT[k].label}</td><td>{fk(t.sorties[k].liters)} L</td><td>{fk(t.sorties[k].value)} DA</td></tr>
                    ) : null
                  ))}
                  <tr><td style={{ paddingLeft: 20, color: 'var(--a6)' }}>dont resté dans les réservoirs (non brûlé)</td><td style={{ color: 'var(--a6)' }}>{t.deltaReservoirs >= 0 ? '−' : '+'}{fk(Math.abs(t.deltaReservoirs))} L</td><td>—</td></tr>
                  <tr style={{ fontWeight: 700, background: 'var(--s2)' }}><td>− CONSOMMATION RÉELLE (brûlée par la flotte)</td><td style={{ color: 'var(--r6)' }}>{fk(t.consoNette)} L</td><td>—</td></tr>
                  <tr><td>− Réserve fin — cuves (jauge)</td><td>{fk(t.sorties.stockFinCuves)} L</td><td>—</td></tr>
                  <tr><td>− Réserve fin — réservoirs véhicules</td><td>{fk(t.reservoirsFin)} L</td><td>—</td></tr>
                  <tr style={{ fontWeight: 700, background: t.reconcilie ? 'var(--g1)' : 'var(--r1)' }}>
                    <td>= ÉCART {t.reconcilie ? '— équilibré ✓' : '— NON JUSTIFIÉ'}</td>
                    <td style={{ color: t.reconcilie ? 'var(--g6)' : 'var(--r6)' }}>{t.ecart > 0 ? '+' : ''}{fk(t.ecart)} L</td>
                    <td style={{ fontSize: '.7rem', color: 'var(--tm)' }}>tolérance ±{fk(t.tolerance)} L</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <div className="tc">
        <div className="th"><h3>Stock des cuves — {month}</h3></div>
        <div className="tw">
          <table>
            <thead><tr><th>Site / Carburant</th><th>Stock début</th><th>+ Appros</th><th>− Sorties</th><th>= Théorique</th><th>Réel</th><th>Écart</th><th /></tr></thead>
            <tbody>
              {(b.cuves ?? []).map((c: any) => (
                <tr key={`${c.siteCode}-${c.fuelType}`}>
                  <td style={{ fontWeight: 600 }}>{c.siteCode} <span style={{ color: 'var(--tm)', fontWeight: 400 }}>{FT_LABEL[canon(c.fuelType)]}</span></td>
                  <td>{fk(c.stockDebut)} L</td>
                  <td style={{ color: 'var(--g6)' }}>+{fk(c.appros)} L</td>
                  <td style={{ color: 'var(--r6)' }}>−{fk(c.sorties)} L</td>
                  <td style={{ fontWeight: 600 }}>{fk(c.stockFinTheorique)} L</td>
                  <td>{fk(c.stockFinReel)} L</td>
                  <td style={{ color: Math.abs(c.ecart) > 1 ? 'var(--r6)' : 'var(--g6)', fontWeight: 600 }}>{c.ecart > 0 ? '+' : ''}{fk(c.ecart)} L</td>
                  <td><button className="btn btn-o btn-sm" onClick={() => { setInitFor({ siteCode: c.siteCode, fuelType: c.fuelType }); setInitVal(String(c.stockDebut || '')); }}>Stock initial</button></td>
                </tr>
              ))}
              {!(b.cuves ?? []).length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--tm)', padding: 14 }}>Aucune cuve — créez un stock initial ou un approvisionnement (onglet « Entrées → Cuves &amp; appros site »).</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {initFor && (
        <Modal open onClose={() => setInitFor(null)} title={`Stock initial — ${initFor.siteCode} · ${FT_LABEL[canon(initFor.fuelType)]}`}
          footer={<><button className="btn btn-o" onClick={() => setInitFor(null)}>Annuler</button><button className="btn btn-p" onClick={saveInitial} disabled={!Number(initVal) || createOp.isPending}>Enregistrer</button></>}>
          <p style={{ fontSize: '.78rem', color: 'var(--tm)' }}>Saisie manuelle du stock de départ de la cuve. Enregistré au 1<sup>er</sup> jour du mois ; les appros / sorties s&apos;ajoutent ensuite automatiquement.</p>
          <div className="form-g"><label>Litres en cuve au {month}-01</label><input type="number" value={initVal} onChange={(e) => setInitVal(e.target.value)} /></div>
        </Modal>
      )}
    </div>
  );
}

/* ═══════════════════════════ ONGLET ANOMALIES ═══════════════════════════ */

function AnomaliesTab({ b, rows }: { b: any; rows: any[] }) {
  const has = (r: any, f: string) => (r.flags ?? []).includes(f);
  const surconso = rows.filter((r) => has(r, 'surconsommation'));
  const kmIncoherent = rows.filter((r) => has(r, 'km_carburant_incoherent'));
  const activite = rows.filter((r) => has(r, 'activite_non_justifiee'));
  const sousDeclare = rows.filter((r) => r.ecartPct != null && r.ecartPct < -15 && !has(r, 'km_carburant_incoherent') && !has(r, 'activite_non_justifiee'));
  const incomplet = rows.filter((r) => r.verdict === 'incomplet');
  const cuveEcarts = b ? (b.cuves ?? []).filter((c: any) => Math.abs(c.ecart) > 1) : [];

  const Line = ({ r }: { r: any }) => {
    const why = verdictReason(r);
    return (
      <div className="ai" style={{ marginBottom: 6 }}>
        <div className={`ak ${r.verdict === 'anomalie' ? 'dg' : 'wr'}`} />
        <div style={{ flex: 1 }}>
          <div className="at">{r.vehicleCode} — {r.label} <span style={{ fontWeight: 400, color: 'var(--tm)' }}>· {CAT_LABEL[r.category] ?? r.category}</span>
            {' '}<span style={{ fontSize: '.6rem', color: vColor(r.verdict), fontWeight: 700 }}>{V_LABEL[r.verdict]}</span></div>
          {why && <div className="ad" style={{ color: 'var(--tp)' }}>{why}</div>}
          <div className="ad" style={{ fontSize: '.66rem' }}>
            conso nette {fk(r.litresNets)} L · achats {fk(r.litresAchetes)} L
            {Object.entries(r.litresBySource ?? {}).filter(([, l]) => (l as number) > 0).length > 0 && <> ({Object.entries(r.litresBySource ?? {}).filter(([, l]) => (l as number) > 0).map(([s, l]) => `${SRC_LABEL[s] ?? s} ${fk(l as number)}`).join(' · ')})</>}
          </div>
        </div>
      </div>
    );
  };

  const Section = ({ title, sub, items }: { title: string; sub: string; items: any[] }) => (
    <div className="cc">
      <h3>{title}</h3><div className="sub">{sub}</div>
      {items.length ? items.map((r) => <Line key={r.vehicleCode} r={r} />) : <p style={{ fontSize: '.8rem', color: 'var(--tm)', padding: 12 }}>Rien à signaler</p>}
    </div>
  );

  return (
    <div className="tpane act">
      <div style={{ fontSize: '.74rem', color: 'var(--tm)', background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '8px 10px', marginBottom: 10 }}>
        Trois natures de dérive, à traiter différemment : <b>sur-consommation</b> (le véhicule brûle trop → fuite / conduite / plein sur un autre véhicule) ·
        <b> km ↔ carburant incohérents</b> (compteur gonflé OU pleins non déclarés) ·
        <b> activité non justifiée</b> (km réels mais roulés hors mission).
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <Section title="Sur-consommation carburant" sub="conso réelle > norme constructeur (+15 %)" items={surconso} />
        <Section title="Km ↔ carburant incohérents" sub="le carburant ne « paie » pas les km au compteur" items={kmIncoherent} />
        <Section title="Activité roulée non justifiée" sub="beaucoup de km hors mission (carburant cohérent)" items={activite} />
      </div>

      <div className="cr" style={{ marginTop: 12 }}>
        <div className="cc">
          <h3>Contrôles incomplets</h3><div className="sub">relevé km / heures / réservoir manquant — impossible de contrôler</div>
          {incomplet.length ? incomplet.map((r) => (
            <div className="ai" key={r.vehicleCode} style={{ marginBottom: 4 }}>
              <div className="ak" style={{ background: 'var(--tm)' }} />
              <div style={{ flex: 1 }}>
                <div className="at">{r.vehicleCode} — {r.label}</div>
                <div className="ad">{fk(r.litresAchetes)} L achetés · {(r.flags ?? []).map((f: string) => FLAG_LABEL[f] ?? f).join(' · ') || 'relevé manquant'}</div>
              </div>
            </div>
          )) : <p style={{ fontSize: '.8rem', color: 'var(--tm)', padding: 12 }}>Tous les contrôles sont complets</p>}
          {sousDeclare.length > 0 && <>
            <h3 style={{ marginTop: 10 }}>Carburant possiblement sous-déclaré</h3><div className="sub">conso &lt; norme de plus de 15 % — pleins peut-être manquants</div>
            {sousDeclare.map((r) => <Line key={r.vehicleCode} r={r} />)}
          </>}
        </div>
        <div className="cc">
          <h3>Écarts d&apos;inventaire cuve</h3><div className="sub">jauge physique ≠ stock théorique (carburant sorti de la cuve non tracé)</div>
          {cuveEcarts.length ? cuveEcarts.map((c: any) => (
            <div className="ai" key={`${c.siteCode}-${c.fuelType}`} style={{ marginBottom: 4 }}>
              <div className={`ak ${Math.abs(c.ecart) > 50 ? 'dg' : 'wr'}`} />
              <div style={{ flex: 1 }}>
                <div className="at">{c.siteCode} — {FT_LABEL[canon(c.fuelType)]}</div>
                <div className="ad">Théorique {fk(c.stockFinTheorique)} L · jauge réelle {fk(c.stockFinReel)} L · <strong style={{ color: 'var(--r6)' }}>{c.ecart > 0 ? '+' : ''}{fk(c.ecart)} L</strong> non justifié{Math.abs(c.ecart) > 50 ? ' — à investiguer' : ''}</div>
              </div>
            </div>
          )) : <p style={{ fontSize: '.8rem', color: 'var(--tm)', padding: 12 }}>Cuves équilibrées</p>}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════ Pleins véhicules (saisie) ═══════════════════════ */

function PleinsVehiculesPanel({ month }: { month: string }) {
  const fuel = useFuelEntries();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const missions = useMissions();
  const prices = useConfig<FuelPrices>('FUEL_PRICES');
  const createFuel = useCreate<FuelEntry>('fuel-entries');
  const updateFuel = useUpdate<FuelEntry>('fuel-entries');
  const importFuel = useImportFuelEntries();

  const [q, setQ] = useState('');
  const [fVh, setFVh] = useState('');
  const [fuelForm, setFuelForm] = useState<FuelEntry | null | undefined>(undefined);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('');

  const V = vehicles.data ?? [];
  const D = drivers.data ?? [];
  const drName = (c: string | null) => D.find((d) => d.code === c)?.name ?? c ?? '—';
  const gasoilPrice = prices.data?.GASOIL ?? 52.5;
  const FU = (fuel.data ?? []).filter((f) => inMonth(f.date, month));

  const fuList = useMemo(() => {
    let l = FU;
    if (fVh) l = l.filter((f) => f.vehicleCode === fVh);
    if (q) { const s = q.toLowerCase(); l = l.filter((f) => `${f.date}${f.vehicleCode}${drName(f.driverCode)}${f.fuelType}`.toLowerCase().includes(s)); }
    return l;
  }, [FU, fVh, q, D]);

  return (
    <div className="tc">
      <div className="th"><h3>Pleins véhicules — {month}</h3><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} style={{ padding: '6px 10px', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', fontSize: '.76rem', background: 'var(--s1)', color: 'var(--tp)' }} />
        <select value={fVh} onChange={(e) => setFVh(e.target.value)} style={{ padding: '6px 8px', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', fontSize: '.74rem', background: 'var(--s1)', color: 'var(--tp)' }}>
          <option value="">Tous véhicules</option>{[...new Set(FU.map((f) => f.vehicleCode))].sort().map((c) => <option key={c}>{c}</option>)}
        </select>
        <button className="btn btn-o btn-sm" onClick={() => downloadCSV(`pleins-vehicules-${month}`, ['Date', 'Véhicule', 'Carte/Site', 'Chauffeur', 'Type', 'Litres', 'Prix U.', 'Montant DA', 'Canal'], fuList.map((f) => [f.date, f.vehicleCode, f.cardNumber ?? '', drName(f.driverCode), canon(f.fuelType, f.grade), f.qty, f.unitPrice, f.amount ?? Math.round(f.qty * f.unitPrice), f.source ?? 'manuel']))}>Export</button>
        <button className="btn btn-o btn-sm" onClick={() => setImportOpen(true)}>Importer</button>
        <button className="btn btn-p btn-sm" onClick={() => setFuelForm(null)}>+ Saisir un plein</button>
      </div></div>
      <div className="tw">
        <table>
          <thead><tr><th>Date</th><th>Véhicule</th><th>Carte / Site</th><th>Chauffeur</th><th>Type</th><th>Litres</th><th>Prix U.</th><th>Montant</th><th>Km (fin)</th><th>Canal</th></tr></thead>
          <tbody>
            {fuList.map((f) => {
              const ft = canon(f.fuelType, f.grade);
              const montant = f.amount ?? Math.round((f.qty ?? 0) * (f.unitPrice ?? 0));
              return (
                <tr key={f.id} className="clickable" onClick={() => setFuelForm(f)} style={f.closed ? { opacity: 0.7 } : undefined}>
                  <td>{fd(f.date)}</td><td style={{ fontWeight: 600 }}>{f.vehicleCode}</td>
                  <td>{f.cardNumber ?? (f as { siteCode?: string }).siteCode ?? '—'}</td><td>{drName(f.driverCode)}</td>
                  <td><span className="bg" style={{ background: `${FT_COLOR[ft]}22`, color: FT_COLOR[ft] }}>{FT_LABEL[ft]}</span></td>
                  <td style={{ fontWeight: 600 }}>{f.qty ? `${fk(f.qty)} L` : '—'}</td>
                  <td>{f.unitPrice ? f.unitPrice.toFixed(2) : '—'}</td>
                  <td style={{ fontWeight: 600 }}>{fk(Math.round(montant))} DA</td>
                  <td>{f.kmEnd ? fk(f.kmEnd) : '—'}</td>
                  <td><span className="bg bg-t">{SRC_LABEL[f.source ?? 'manuel'] ?? f.source}</span></td>
                </tr>
              );
            })}
            {!fuList.length && <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun plein ce mois</td></tr>}
          </tbody>
        </table>
      </div>

      {importOpen && (
        <Modal open onClose={() => setImportOpen(false)} title="Importer un fichier de pleins"
          footer={<><button className="btn btn-o" onClick={() => setImportOpen(false)}>Fermer</button>
            <button className="btn btn-p" disabled={!csv.trim() || importFuel.isPending}
              onClick={async () => { const r = await importFuel.mutateAsync(csv); toast.success(`${r.imported} plein(s) importé(s)`); setCsv(''); setImportOpen(false); }}>Importer</button></>}>
          <p style={{ fontSize: '.78rem', color: 'var(--tm)' }}>Fichier CSV — colonnes : <b>date, vehicule, carte, chauffeur, montant</b> (litres et prix optionnels).</p>
          <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={7} style={{ width: '100%', marginTop: 8, fontFamily: 'monospace', fontSize: '.72rem' }}
            placeholder={'date,vehicule,carte,chauffeur,montant\n2026-09-01,FL-001,NAFTAL-4587,EMP-101,8140'} />
        </Modal>
      )}

      {fuelForm !== undefined && (
        <FuelEntryModal entry={fuelForm} vehicles={V} drivers={D} fuelEntries={FU} defaultPrice={gasoilPrice}
          onClose={() => setFuelForm(undefined)}
          onSave={async (b) => { fuelForm ? await updateFuel.mutateAsync({ id: fuelForm.id, body: b }) : await createFuel.mutateAsync(b); toast.success('Plein enregistré'); }} />
      )}
    </div>
  );
}

/* ═══════════════════════ Pleins engins (saisie) ═══════════════════════ */

function PleinsEnginsPanel({ month }: { month: string }) {
  const eng = useEngineFuelEntries();
  const vehicles = useVehicles();
  const prices = useConfig<FuelPrices>('FUEL_PRICES');
  const createEng = useCreate<EngineFuelEntry>('engine-fuel-entries');
  const updateEng = useUpdate<EngineFuelEntry>('engine-fuel-entries');
  const [engForm, setEngForm] = useState<EngineFuelEntry | null | undefined>(undefined);

  const V = vehicles.data ?? [];
  const gasoilPrice = prices.data?.GASOIL ?? 52.5;
  const FUE = (eng.data ?? []).filter((f) => inMonth(f.date, month));

  return (
    <div className="tc">
      <div className="th"><h3>Pleins engins — {month}</h3><button className="btn btn-p btn-sm" onClick={() => setEngForm(null)}>+ Saisir un plein</button></div>
      <div className="tw">
        <table>
          <thead><tr><th>Date</th><th>Engin</th><th>Opérateur</th><th>Litres</th><th>Prix U.</th><th>Total</th><th>H compteur</th><th>H préc.</th><th>H trav.</th><th>Conso L/h</th><th>Norme</th><th>Écart</th></tr></thead>
          <tbody>
            {FUE.map((f) => {
              const hrs = (f.hourEnd ?? 0) - (f.hourStart ?? 0);
              const consoH = hrs > 0 ? f.qty / hrs : 0;
              const ecart = hrs > 0 && (f.normH ?? 0) > 0 ? ((consoH - (f.normH ?? 0)) / (f.normH ?? 1)) * 100 : NaN;
              return (
                <tr key={f.id} className="clickable" onClick={() => setEngForm(f)}>
                  <td>{fd(f.date)}</td><td style={{ fontWeight: 600 }}>{f.vehicleCode}</td><td>{f.operator}</td><td>{f.qty} L</td><td>{f.unitPrice.toFixed(2)}</td>
                  <td style={{ fontWeight: 500 }}>{fk(Math.round(f.qty * f.unitPrice))}</td>
                  <td>{fk(f.hourEnd)}</td><td>{fk(f.hourStart)}</td><td>{hrs}h</td>
                  <td style={{ fontWeight: 600 }}>{consoH.toFixed(1)} L/h</td><td>{f.normH} L/h</td>
                  <td style={isNaN(ecart) ? undefined : ecCls(ecart)}>{isNaN(ecart) ? '-' : `${ecart > 0 ? '+' : ''}${ecart.toFixed(0)}%`}</td>
                </tr>
              );
            })}
            {!FUE.length && <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun plein engin ce mois</td></tr>}
          </tbody>
        </table>
      </div>
      {engForm !== undefined && (
        <EngineEntryModal entry={engForm} engins={V.filter((v) => v.type === 'ENGIN')} defaultPrice={gasoilPrice}
          onClose={() => setEngForm(undefined)}
          onSave={async (b) => { engForm ? await updateEng.mutateAsync({ id: engForm.id, body: b }) : await createEng.mutateAsync(b); toast.success('Plein engin enregistré'); }} />
      )}
    </div>
  );
}

function RegieTabWrap() {
  const vehicles = useVehicles();
  const drivers = useDrivers();
  return <RegieTab vehicles={vehicles.data ?? []} drivers={drivers.data ?? []} />;
}

function Loading() {
  return <div className="tc"><div style={{ padding: 24, color: 'var(--tm)' }}>Chargement…</div></div>;
}

/* ═══════════════ composants conservés (inchangés fonctionnellement) ═══════════════ */

function FuelEntryModal({ entry, vehicles, drivers, fuelEntries, defaultPrice, onClose, onSave }: {
  entry: FuelEntry | null; vehicles: Vehicle[]; drivers: import('@/lib/types').Driver[];
  fuelEntries: FuelEntry[]; defaultPrice: number;
  onClose: () => void; onSave: (b: Partial<FuelEntry>) => Promise<void>;
}) {
  const prices = useConfig<FuelPrices>('FUEL_PRICES');
  const priceFor = (type?: string | null, grade?: string | null) => {
    const pr = prices.data as Record<string, number> | undefined;
    const t = (type ?? 'GASOIL').toUpperCase();
    const key = t === 'ESSENCE' && grade ? String(grade).toUpperCase() : t;
    return pr?.[key] ?? pr?.[t] ?? defaultPrice;
  };
  const lastKmFor = (code: string | undefined) => {
    if (!code) return null;
    const prev = fuelEntries
      .filter((x) => x.vehicleCode === code && x.kmEnd != null && x.id !== entry?.id)
      .sort((a, b) => (b.kmEnd ?? 0) - (a.kmEnd ?? 0))[0];
    return prev?.kmEnd ?? vehicles.find((v) => v.code === code)?.km ?? null;
  };

  const cards = useFuelCards();
  const assignments = useVehicleAssignments();
  const CARD_NUMS = [...new Set(((cards.data ?? []) as any[]).map((c) => c.cardNumber).filter(Boolean))] as string[];
  const SITE_NAMES = [...new Set([
    ...vehicles.map((v) => v.siteBase),
    ...((assignments.data ?? []) as any[]).map((a) => a.siteCode),
  ].filter(Boolean))] as string[];

  const [f, setF] = useState<Partial<FuelEntry>>(() => {
    if (entry) return entry;
    const v0 = vehicles[0];
    const fu = (v0?.fuel ?? 'GASOIL').toUpperCase();
    const grade = fu === 'ESSENCE' ? 'SP' : null;
    return {
      date: new Date().toISOString().slice(0, 10),
      vehicleCode: v0?.code, fuelType: fu, grade, qty: undefined,
      unitPrice: (prices.data as Record<string, number> | undefined)?.[grade ?? fu] ?? defaultPrice,
      closed: false, kmStart: lastKmFor(v0?.code) ?? undefined,
    };
  });
  const set = (k: keyof FuelEntry) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const val = e.target.value;
    setF((s) => {
      const next: Partial<FuelEntry> = { ...s, [k]: val };
      if (k === 'vehicleCode') {
        next.kmStart = lastKmFor(val) ?? undefined;
        const fu = (vehicles.find((v) => v.code === val)?.fuel ?? 'GASOIL').toUpperCase();
        next.fuelType = fu;
        next.grade = fu === 'ESSENCE' ? (s.grade ?? 'SP') : null;
        next.unitPrice = priceFor(fu, next.grade);
        // pré-remplit la carte affectée au véhicule si origine = carte
        if ((s as { source?: string }).source === 'carte') {
          const cc = ((cards.data ?? []) as any[]).find((c) => c.vehicleCode === val);
          if (cc?.cardNumber) (next as { cardNumber?: string }).cardNumber = cc.cardNumber;
        }
      }
      if (k === 'fuelType') { next.grade = val === 'ESSENCE' ? (s.grade ?? 'SP') : null; next.unitPrice = priceFor(val, next.grade); }
      if (k === 'grade') next.unitPrice = priceFor(s.fuelType, val);
      return next;
    });
  };

  const vh = vehicles.find((v) => v.code === f.vehicleCode);
  const isEssence = (f.fuelType ?? '').toUpperCase() === 'ESSENCE';
  const norm = vh?.normCorr ?? vh?.normOff ?? 0;
  const src = (f as { source?: string }).source ?? 'carte';
  const kmRun = Number(f.kmEnd) > 0 && Number(f.kmStart) > 0 ? Number(f.kmEnd) - Number(f.kmStart) : 0;
  const conso = kmRun > 0 && Number(f.qty) > 0 ? (Number(f.qty) / kmRun) * 100 : 0;
  const overNorm = norm > 0 && conso > 0 && conso > norm * 1.15;
  const kmError = Number(f.kmEnd) > 0 && Number(f.kmStart) > 0 && Number(f.kmEnd) <= Number(f.kmStart);

  const submit = async () => {
    const miss = [!f.date && 'date', !f.vehicleCode && 'véhicule', !(Number(f.qty) > 0) && 'quantité (litres)'].filter(Boolean);
    if (miss.length) { toast.error(`Champs obligatoires : ${miss.join(', ')}`); return; }
    if (kmError) { toast.error('Le km (fin) doit être supérieur au km précédent'); return; }
    await onSave({
      ...f, qty: Number(f.qty) || 0, unitPrice: Number(f.unitPrice) || 0,
      kmEnd: f.kmEnd ? Number(f.kmEnd) : null, kmStart: f.kmStart ? Number(f.kmStart) : null,
      norm: norm || null,
    });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={entry ? 'Modifier Plein' : 'Saisir Plein — Véhicule'}
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={submit}>Enregistrer</button></>}>
      <div className="form-r">
        <div className="form-g"><label>Date</label><DateInput value={/^\d{4}-\d{2}-\d{2}/.test(String(f.date ?? '')) ? String(f.date).slice(0, 10) : ''} onChange={set('date')} /></div>
        <div className="form-g"><label>Véhicule</label><select value={f.vehicleCode ?? ''} onChange={set('vehicleCode')}>{vehicles.map((v) => <option key={v.code} value={v.code}>{v.code}</option>)}</select></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Chauffeur</label><select value={f.driverCode ?? ''} onChange={set('driverCode')}><option value="">—</option>{drivers.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}</select></div>
        <div className="form-g"><label>Type {vh?.fuel ? <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(fiche : {vh.fuel})</span> : ''}</label><select value={f.fuelType ?? 'GASOIL'} onChange={set('fuelType')}>{['GASOIL', 'ESSENCE', 'GPL'].map((t) => <option key={t}>{t}</option>)}</select></div>
      </div>
      {isEssence && (
        <div className="form-r">
          <div className="form-g"><label>Qualité essence <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(sans plomb / super)</span></label>
            <select value={(f as { grade?: string }).grade ?? 'SP'} onChange={set('grade' as keyof FuelEntry)}>
              <option value="SP">Sans plomb — {priceFor('ESSENCE', 'SP').toFixed(2)} DA/L</option>
              <option value="SUPER">Super — {priceFor('ESSENCE', 'SUPER').toFixed(2)} DA/L</option>
            </select>
          </div>
          <div className="form-g" />
        </div>
      )}
      <div className="form-r">
        <div className="form-g"><label>Origine</label>
          <select value={src} onChange={set('source' as keyof FuelEntry)}>
            <option value="carte">Carte NAFTAL</option><option value="stock_site">Stock site</option>
            <option value="pompe_externe">Pompe externe</option><option value="regie">Régie</option><option value="manuel">Manuel</option>
          </select>
        </div>
        {src === 'carte' ? (
          <div className="form-g"><label>Carte carburant</label>
            <input list="fuel-card-list" value={(f as { cardNumber?: string }).cardNumber ?? ''} onChange={(e) => setF((s) => ({ ...s, cardNumber: e.target.value } as Partial<FuelEntry>))} placeholder="Choisir ou saisir un n° de carte" />
            <datalist id="fuel-card-list">{CARD_NUMS.map((c) => <option key={c} value={c} />)}</datalist>
          </div>
        ) : src === 'stock_site' ? (
          <div className="form-g"><label>Site</label>
            <input list="fuel-site-list" value={(f as { siteCode?: string }).siteCode ?? ''} onChange={(e) => setF((s) => ({ ...s, siteCode: e.target.value } as Partial<FuelEntry>))} placeholder="Choisir ou saisir un site" />
            <datalist id="fuel-site-list">{SITE_NAMES.map((s) => <option key={s} value={s} />)}</datalist>
          </div>
        ) : (
          <div className="form-g"><label>Référence <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(station, bon…)</span></label>
            <input value={(f as { cardNumber?: string }).cardNumber ?? ''} onChange={(e) => setF((s) => ({ ...s, cardNumber: e.target.value } as Partial<FuelEntry>))} placeholder="facultatif" /></div>
        )}
      </div>
      <div className="form-r">
        <div className="form-g"><label>Quantité (L) <span style={{ color: 'var(--r6)' }}>*</span></label><input type="number" value={f.qty ?? ''} onChange={set('qty')} placeholder="0" /></div>
        <div className="form-g"><label>Prix Unitaire</label><input type="number" step="0.01" value={f.unitPrice ?? ''} onChange={set('unitPrice')} placeholder="0" /></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Km compteur (fin) <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— facultatif</span></label><input type="number" value={f.kmEnd ?? ''} onChange={set('kmEnd')} placeholder="renseigné au relevé de fin de mois" /></div>
        <div className="form-g"><label>Km compteur (préc.) <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— auto</span></label><input type="number" value={f.kmStart ?? ''} onChange={set('kmStart')} placeholder="—" /></div>
      </div>
      <div style={{ fontSize: '.68rem', color: 'var(--tm)', marginTop: 2 }}>
        Le contrôle de consommation se fait sur le <b>relevé km de fin de mois</b> (onglet Contrôle), pas plein par plein — le km ci-dessus est optionnel.
      </div>
      {kmError && <div style={{ fontSize: '.72rem', color: 'var(--r6)', marginTop: 2 }}>Le km (fin) doit être &gt; km précédent.</div>}
      {kmRun > 0 && Number(f.qty) > 0 && (
        <div style={{ marginTop: 6, padding: '6px 10px', borderRadius: 'var(--rs)', fontSize: '.74rem', background: overNorm ? 'var(--r1)' : 'var(--g1)', color: overNorm ? 'var(--r6)' : 'var(--g6)' }}>
          {kmRun} km parcourus · consommation <b>{conso.toFixed(1)} L/100 km</b>
          {norm > 0 && <> · norme {norm} (seuil {(norm * 1.15).toFixed(1)}) — {overNorm ? 'SURCONSOMMATION' : 'conforme'}</>}
        </div>
      )}
    </Modal>
  );
}

function EngineEntryModal({ entry, engins, defaultPrice, onClose, onSave }: {
  entry: EngineFuelEntry | null; engins: Vehicle[]; defaultPrice: number;
  onClose: () => void; onSave: (b: Partial<EngineFuelEntry>) => Promise<void>;
}) {
  const [f, setF] = useState<Partial<EngineFuelEntry>>(entry ?? {
    date: new Date().toISOString().slice(0, 10),
    vehicleCode: engins[0]?.code, fuelType: 'GASOIL', qty: undefined, unitPrice: defaultPrice, closed: false,
  });
  const set = (k: keyof EngineFuelEntry) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  // Opérateur : liste des chauffeurs (retour DG — pas de saisie libre) ; on conserve une valeur legacy hors liste.
  const drivers = useDrivers();
  const operators = (() => {
    const names = (drivers.data ?? []).filter((d) => d.personType !== 'utilisateur').map((d) => d.name).filter(Boolean) as string[];
    const cur = String(f.operator ?? '').trim();
    return cur && !names.some((n) => n.toLowerCase() === cur.toLowerCase()) ? [cur, ...names] : names;
  })();
  const submit = async () => {
    const miss = [!f.date && 'date', !f.vehicleCode && 'engin', !(Number(f.qty) > 0) && 'quantité (litres)'].filter(Boolean);
    if (miss.length) { toast.error(`Champs obligatoires : ${miss.join(', ')}`); return; }
    await onSave({ ...f, qty: Number(f.qty) || 0, unitPrice: Number(f.unitPrice) || 0, hourEnd: Number(f.hourEnd) || 0, hourStart: Number(f.hourStart) || 0 });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={entry ? 'Modifier Plein Engin' : 'Saisir Plein — Engin'}
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={submit}>Enregistrer</button></>}>
      <div className="form-r">
        <div className="form-g"><label>Date</label><DateInput value={/^\d{4}-\d{2}-\d{2}/.test(String(f.date ?? '')) ? String(f.date).slice(0, 10) : ''} onChange={set('date')} /></div>
        <div className="form-g"><label>Engin</label><select value={f.vehicleCode ?? ''} onChange={set('vehicleCode')}>{engins.map((v) => <option key={v.code} value={v.code}>{v.code}</option>)}</select></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Opérateur</label>
          <select value={f.operator ?? ''} onChange={set('operator')}>
            <option value="">— Choisir —</option>
            {operators.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="form-g"><label>Quantité (L) <span style={{ color: 'var(--r6)' }}>*</span></label><input type="number" value={f.qty ?? ''} onChange={set('qty')} placeholder="0" /></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Compteur horaire (fin)</label><input type="number" value={f.hourEnd ?? ''} onChange={set('hourEnd')} placeholder="0" /></div>
        <div className="form-g"><label>Compteur horaire (préc.)</label><input type="number" value={f.hourStart ?? ''} onChange={set('hourStart')} placeholder="0" /></div>
      </div>
    </Modal>
  );
}

/* ─── Stock carburant par site (litres) ───
   focus 'appro'  → appros cuve uniquement (sous Entrées)
   focus 'sortie' → carburant servi aux véhicules & engins (sous Consommations)
   focus 'all'    → les deux (vue complète) */
function FuelStockTab({ focus = 'all' }: { focus?: 'all' | 'appro' | 'sortie' }) {
  const months = monthOptions();
  const [month, setMonth] = useState(months[0].value);
  const ops = useFuelStockOps();
  const balance = useFuelStockBalance(undefined, month);
  const create = useCreateFuelStockOp();
  const remove = useRemoveFuelStockOp();
  const vehicles = useVehicles();
  const externals = useCollection<any>('external-vehicles');
  const assignments = useVehicleAssignments();
  const suppliers = useSuppliers();
  const siteNames = useSiteNames();
  const [modal, setModal] = useState<'appro' | 'sortie' | null>(null);
  const [F, setF] = useState<any>({});
  const allOps = (ops.data ?? []) as any[];
  const list = focus === 'appro' ? allOps.filter((o) => o.opType === 'appro' || o.opType === 'initial')
    : focus === 'sortie' ? allOps.filter((o) => o.opType === 'sortie')
      : allOps;
  const search = useSearch(list, (o) => [o.siteCode, o.opType, o.date, o.supplier, o.targetCode, o.targetLabel].join(' '));
  const bal = (balance.data ?? []) as any[];
  const extList = ((externals.data ?? []) as any[]).filter((e) => e.active !== false);
  // Fournisseurs : référentiel Paramètres › Fournisseurs (retour DG — pas de saisie libre).
  const supplierNames = (() => {
    const names = (suppliers.data ?? []).map((s) => s.name).filter(Boolean) as string[];
    const cur = String(F.supplier ?? '').trim();
    return cur && !names.some((n) => n.toLowerCase() === cur.toLowerCase()) ? [cur, ...names] : names;
  })();

  // Retour DG « logique affectation site » : quand une cuve de chantier est choisie, on propose
  // d'abord les véhicules / engins AFFECTÉS à ce chantier (VehicleAssignment.siteCode), actifs à la date.
  const assignedToSite = useMemo(() => {
    if (!F.siteCode) return [] as string[];
    const d = String(F.date ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    return ((assignments.data ?? []) as any[])
      .filter((a) => a.siteCode === F.siteCode && a.vehicleCode
        && (!a.dateStart || a.dateStart <= d) && (!a.dateEnd || a.dateEnd >= d))
      .map((a) => a.vehicleCode as string);
  }, [assignments.data, F.siteCode, F.date]);
  const assignedSet = new Set(assignedToSite);
  const vehList = (vehicles.data ?? []).filter((v) => v.type !== 'REMORQUE');
  const vehOnSite = vehList.filter((v) => assignedSet.has(v.code));
  const vehOffSite = vehList.filter((v) => !assignedSet.has(v.code));
  const extOnSite = extList.filter((e) => F.siteCode && (e.siteCode ?? '') === F.siteCode);
  const extOffSite = extList.filter((e) => !F.siteCode || (e.siteCode ?? '') !== F.siteCode);

  const save = async () => {
    const miss = [
      !F.siteCode && !F.offStock && 'site / cuve',
      !(Number(F.liters) > 0) && 'litres',
      modal === 'appro' && !F.amount && 'montant',
      modal === 'sortie' && !F.targetCode && !F.targetLabel && 'bénéficiaire',
      modal === 'sortie' && F.targetKind === 'external' && !F.businessUnit && 'Business Unit',
      modal === 'sortie' && F.targetKind === 'external' && !F.costCenter && 'centre de coût',
    ].filter(Boolean);
    if (miss.length) { toast.error(`Champs obligatoires : ${miss.join(', ')}`); return; }
    try {
      await create.mutateAsync({
        ...F,
        liters: Number(F.liters) || 0,
        amount: F.amount ? Number(F.amount) : undefined,
        opType: modal,
      });
      toast.success(modal === 'appro' ? 'Approvisionnement enregistré' : 'Sortie enregistrée');
      setModal(null); setF({});
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur');
    }
  };

  return (
    <div className="tpane act">
      {focus === 'sortie' && (
        <div style={{ fontSize: '.78rem', color: 'var(--tm)', background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '8px 10px', margin: '6px 0' }}>
          <b>Sorties de cuve</b> = carburant servi depuis la cuve d&apos;un chantier à un véhicule ou engin — <b>interne</b> (crée le plein pour le contrôle) ou <b>externe</b> (véhicule enregistré dans Sites &amp; Engins → Parc site &amp; externes). La cuve se décrémente automatiquement.
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', margin: '6px 0' }}>
        <select value={month} onChange={(e) => setMonth(e.target.value)}>{months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
        {focus !== 'sortie' && <button className="btn btn-p btn-sm" onClick={() => { setModal('appro'); setF({ siteCode: siteNames[0] ?? '', fuelType: 'GASOIL', date: new Date().toISOString().slice(0, 10) }); }}>+ Approvisionnement</button>}
        {focus !== 'appro' && <button className={focus === 'sortie' ? 'btn btn-p btn-sm' : 'btn btn-o btn-sm'} onClick={() => { setModal('sortie'); setF({ siteCode: siteNames[0] ?? '', fuelType: 'GASOIL', targetKind: 'vehicle', date: new Date().toISOString().slice(0, 10) }); }}>+ Sortie carburant</button>}
        <button className="btn btn-o btn-sm" onClick={() => printReport('Stock carburant site', `Mois ${month}`, bal.map((b) => ({
          heading: `${b.siteCode} — ${b.fuelType}`,
          columns: ['Indicateur', 'Valeur'],
          rows: [
            ['Stock actuel', `${fk(b.stockLiters)} L`],
            ['Valeur stock (PMP)', `${fk(b.stockValue)} DA (${b.avgUnitPrice} DA/L)`],
            ['Approvisionnements du mois', `${fk(b.periodApproLiters)} L · ${fk(b.periodApproValue)} DA`],
            ['Sorties du mois', `${fk(b.periodSortieLiters)} L · ${fk(b.periodSortieValue)} DA`],
          ],
        })).concat(bal.map((b) => ({
          heading: `${b.siteCode} — où part le carburant (${month})`,
          columns: ['Bénéficiaire', 'Type', 'BU / Centre de coût', 'Litres', 'Valeur (DA)'],
          rows: b.whereItGoes.map((w: any) => [w.targetLabel || w.targetCode, w.targetKind === 'external' ? 'externe' : 'interne', [w.businessUnit, w.costCenter].filter(Boolean).join(' / ') || '—', fk(w.liters), fk(w.value)]),
        }))))}>Imprimer l&apos;état</button>
      </div>

      {bal.map((b: any) => (
        <div className="tc" key={`${b.siteCode}-${b.fuelType}`} style={{ marginBottom: 12 }}>
          <div className="th"><h3>{b.siteCode} — {b.fuelType}</h3></div>
          <div className="sg" style={{ padding: 10 }}>
            <div className="sc"><div><div className="sv">{fk(b.stockLiters)} L</div><div className="sl">Stock actuel</div><div className="st">{fk(b.stockValue)} DA · PMP {b.avgUnitPrice} DA/L</div></div></div>
            <div className="sc"><div><div className="sv" style={{ color: 'var(--g6)' }}>+{fk(b.periodApproLiters)} L</div><div className="sl">Appro. du mois</div><div className="st">{fk(b.periodApproValue)} DA</div></div></div>
            <div className="sc"><div><div className="sv" style={{ color: 'var(--r6)' }}>−{fk(b.periodSortieLiters)} L</div><div className="sl">Sorties du mois</div><div className="st">{fk(b.periodSortieValue)} DA</div></div></div>
          </div>
          <div className="tw">
            <table>
              <thead><tr><th>Où part le carburant ({month})</th><th>Type</th><th>BU / Centre de coût</th><th>Litres</th><th>Valeur (DA)</th></tr></thead>
              <tbody>
                {b.whereItGoes.map((w: any, i: number) => (
                  <tr key={i}><td style={{ fontWeight: 600 }}>{w.targetLabel || w.targetCode}</td>
                    <td><span className={`bg ${w.targetKind === 'external' ? 'bg-a' : 'bg-b'}`}>{w.targetKind === 'external' ? 'Externe' : 'Interne'}</span></td>
                    <td style={{ fontSize: '.74rem' }}>{[w.businessUnit, w.costCenter].filter(Boolean).join(' / ') || <span style={{ color: 'var(--tm)' }}>—</span>}</td>
                    <td>{fk(w.liters)} L</td><td>{fk(w.value)} DA</td></tr>
                ))}
                {!b.whereItGoes.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Aucune sortie ce mois</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      ))}
      {!bal.length && <div className="tc"><div style={{ padding: 24, textAlign: 'center', color: 'var(--tm)' }}>Aucun stock carburant site — créez un approvisionnement.</div></div>}

      <div className="tc">
        <div className="th"><h3>{focus === 'sortie' ? 'Sorties de cuve — carburant servi' : focus === 'appro' ? 'Approvisionnements de cuve' : 'Mouvements de stock'}</h3><SearchBox value={search.q} onChange={search.setQ} placeholder="Site, fournisseur, véhicule…" count={search.count} total={list.length} /></div>
        <div className="tw">
          <table>
            <thead><tr><th>Date</th><th>Site</th><th>Type</th><th>Litres</th><th>Prix U.</th><th>Montant / Bénéficiaire</th><th /></tr></thead>
            <tbody>
              {search.filtered.map((o: any) => (
                <tr key={o.id}>
                  <td>{fd(o.date)}</td><td>{o.siteCode}</td>
                  <td><span className={`bg ${o.opType === 'appro' ? 'bg-g' : 'bg-r'}`}>{o.opType === 'appro' ? 'Appro.' : 'Sortie'}</span></td>
                  <td style={{ fontWeight: 600 }}>{fk(o.liters)} L</td>
                  <td>{o.unitPrice ? `${o.unitPrice} DA` : '—'}</td>
                  <td style={{ fontSize: '.75rem' }}>{o.opType === 'appro' ? `${fk(o.amount)} DA · ${o.supplier ?? ''}` : `${o.targetLabel || o.targetCode} (${o.targetKind === 'external' ? 'externe' : 'interne'})`}</td>
                  <td><button className="btn btn-r btn-sm" onClick={() => remove.mutate(o.id)}>Suppr.</button></td>
                </tr>
              ))}
              {!search.filtered.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Aucun mouvement</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal open onClose={() => setModal(null)} title={modal === 'appro' ? 'Approvisionnement carburant site' : 'Sortie carburant site'}
          footer={<><button className="btn btn-o" onClick={() => setModal(null)}>Annuler</button><button className="btn btn-p" onClick={save} disabled={!F.siteCode || !F.liters || create.isPending}>Enregistrer</button></>}>
          <div className="form-r">
            <div className="form-g"><label>Site</label>
              <select value={F.siteCode ?? ''} onChange={(e) => setF({ ...F, siteCode: e.target.value })}>
                <option value="">— Choisir —</option>
                {withCurrentSite(siteNames, F.siteCode).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-g"><label>Date</label><DateInput value={F.date ?? ''} onChange={(e) => setF({ ...F, date: e.target.value })} /></div>
          </div>
          <div className="form-r">
            <div className="form-g"><label>Carburant</label><select value={F.fuelType ?? 'GASOIL'} onChange={(e) => setF({ ...F, fuelType: e.target.value })}>{['GASOIL', 'SP', 'SUPER', 'GPL'].map((t) => <option key={t} value={t}>{FT_LABEL[t]}</option>)}</select></div>
            <div className="form-g"><label>Litres</label><input type="number" value={F.liters ?? ''} onChange={(e) => setF({ ...F, liters: e.target.value })} /></div>
          </div>
          {modal === 'appro' ? (
            <div className="form-r">
              <div className="form-g"><label>Montant (DA)</label><input type="number" value={F.amount ?? ''} onChange={(e) => setF({ ...F, amount: e.target.value })} /></div>
              <div className="form-g"><label>Fournisseur</label>
                <select value={F.supplier ?? ''} onChange={(e) => setF({ ...F, supplier: e.target.value })}>
                  <option value="">— Choisir —</option>
                  {supplierNames.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <>
              <div className="form-r">
                <div className="form-g"><label>Bénéficiaire</label>
                  <select value={F.targetKind ?? 'vehicle'} onChange={(e) => setF({ ...F, targetKind: e.target.value, targetCode: '', targetLabel: '' })}>
                    <option value="vehicle">Véhicule interne</option><option value="external">Véhicule externe</option>
                  </select>
                </div>
                {F.targetKind === 'external'
                  ? <div className="form-g"><label>Véhicule externe</label>
                    <select value={F.targetLabel ?? ''} onChange={(e) => { const ex = extList.find((x) => (x.label ?? '') === e.target.value); setF({ ...F, targetLabel: e.target.value, targetCode: ex?.id ?? null }); }}>
                      <option value="">— choisir dans le parc externe —</option>
                      {!!extOnSite.length && <optgroup label={`Sur ce chantier (${F.siteCode})`}>
                        {extOnSite.map((ex) => <option key={ex.id} value={ex.label ?? ex.id}>{ex.label}{ex.owner ? ` — ${ex.owner}` : ''}</option>)}
                      </optgroup>}
                      {!!extOffSite.length && <optgroup label={extOnSite.length ? 'Autres véhicules externes' : 'Parc externe'}>
                        {extOffSite.map((ex) => <option key={ex.id} value={ex.label ?? ex.id}>{ex.label}{ex.owner ? ` — ${ex.owner}` : ''}{ex.siteCode ? ` (${ex.siteCode})` : ''}</option>)}
                      </optgroup>}
                    </select>
                    {!extList.length && <div style={{ fontSize: '.68rem', color: 'var(--a6)', marginTop: 3 }}>Aucun véhicule externe enregistré. Ajoute-le d&apos;abord dans <b>Sites &amp; Engins → Parc site &amp; externes</b>.</div>}
                  </div>
                  : <div className="form-g"><label>Véhicule / engin interne</label>
                    <select value={F.targetCode ?? ''} onChange={(e) => { const v = vehicles.data?.find((x) => x.code === e.target.value); setF({ ...F, targetCode: e.target.value, targetLabel: v ? `${v.brand} ${v.model}` : '' }); }}>
                      <option value="">—</option>
                      {!!vehOnSite.length && <optgroup label={`Affectés à ce chantier (${F.siteCode})`}>
                        {vehOnSite.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}{v.type === 'ENGIN' ? ' · engin' : ''}</option>)}
                      </optgroup>}
                      <optgroup label={vehOnSite.length ? 'Autres véhicules (mission / passage)' : 'Tous les véhicules'}>
                        {vehOffSite.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}
                      </optgroup>
                    </select>
                  </div>}
              </div>
              {F.targetKind === 'external' && (
                <>
                  <BuCcSelect bu={F.businessUnit} cc={F.costCenter}
                    onChange={(bu, cc) => setF({ ...F, businessUnit: bu, costCenter: cc })}
                    buLabel="Business Unit *" ccLabel="Centre de coût *" noneLabel="— choisir —" />
                  <div style={{ fontSize: '.72rem', color: 'var(--a6)' }}>
                    Véhicule externe : <b>BU + centre de coût obligatoires</b> — cette consommation est imputée à cette BU dans le reporting (Bilan carburant, Synthèse par Site / BU).
                  </div>
                </>
              )}
              {F.siteCode && !!assignedToSite.length && (
                <div style={{ fontSize: '.72rem', color: 'var(--b6)' }}>
                  {assignedToSite.length} véhicule(s) / engin(s) affecté(s) à <b>{F.siteCode}</b> — proposés en premier. Pour en ajouter : <b>Sites &amp; Engins → Affectations</b>.
                </div>
              )}
              {F.siteCode && !assignedToSite.length && (
                <div style={{ fontSize: '.72rem', color: 'var(--a6)' }}>
                  Aucun véhicule affecté à <b>{F.siteCode}</b>. Déclare l&apos;affectation dans <b>Sites &amp; Engins → Affectations</b> pour un suivi propre du chantier.
                </div>
              )}
              <div style={{ fontSize: '.72rem', color: 'var(--tm)' }}>Le prix de la sortie = prix moyen pondéré du stock. Une sortie vers un véhicule interne crée automatiquement le plein correspondant ; une sortie externe est suivie mais sans contrôle de norme.</div>
            </>
          )}
        </Modal>
      )}
    </div>
  );
}

/** Cellule « km/heures manquant ». */
function MissingKm({ r }: { r: { readingStatus?: string | null; requestedAt?: string | null; driverCode?: string | null } }) {
  if (r.readingStatus === 'pending') {
    return (
      <span style={{ color: 'var(--r6)', fontWeight: 600 }} title={`Demande envoyée au chauffeur ${r.driverCode ?? ''} le ${r.requestedAt ?? ''}`}>
        demandé au chauffeur
      </span>
    );
  }
  return <span style={{ color: 'var(--r6)' }}>manquant</span>;
}

/* ─── Bons d'achat carburant régie : pré-autorisation + QR ─── */
function RegieTab({ vehicles, drivers }: { vehicles: Vehicle[]; drivers: import('@/lib/types').Driver[] }) {
  const list = useRegiePurchases();
  const create = useCreateRegiePurchase();
  const consume = useConsumeRegiePurchase();
  const remove = useRemoveRegiePurchase();
  const prices = useConfig<FuelPrices>('FUEL_PRICES');
  const vehFuel = (code: string | null | undefined, grade?: string | null) => {
    const v = vehicles.find((x) => x.code === code);
    const type = (v?.fuel ?? 'GASOIL').toUpperCase();
    const pr = prices.data as Record<string, number> | undefined;
    const isEssence = type === 'ESSENCE';
    const key = isEssence && grade ? String(grade).toUpperCase() : type;
    const px = pr?.[key] ?? pr?.[type] ?? pr?.GASOIL ?? 52.5;
    return { type, isEssence, price: Number(px) || 52.5, tank: v?.tankLiters ?? null, label: v ? `${v.brand ?? ''} ${v.model ?? ''}`.trim() : '' };
  };
  const rows = ((list.data ?? []) as RegieRow[]);
  const search = useSearch(rows, (r) => [r.ref, r.vehicleCode, r.driverCode, r.reason, r.status, r.station].join(' '));
  const drName = (c: string | null | undefined) => drivers.find((d) => d.code === c)?.name ?? c ?? '—';

  const [form, setForm] = useState<Partial<RegieRow> | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const [consumeRow, setConsumeRow] = useState<RegieRow | null>(null);
  const [C, setC] = useState<{ actualLiters: string; actualAmount: string; station: string; actualDate: string }>({ actualLiters: '', actualAmount: '', station: '', actualDate: '' });

  const monthPfx = new Date().toISOString().slice(0, 7);
  const kpi = {
    emis: rows.filter((r) => r.status === 'emis').length,
    litresMois: Math.round(rows.filter((r) => r.status === 'consomme' && (r.actualDate ?? '').startsWith(monthPfx)).reduce((s, r) => s + (r.actualLiters ?? 0), 0)),
    montantMois: Math.round(rows.filter((r) => r.status === 'consomme' && (r.actualDate ?? '').startsWith(monthPfx)).reduce((s, r) => s + (r.actualAmount ?? 0), 0)),
  };

  const openNew = () => {
    const vh = vehicles.filter((v) => v.type !== 'REMORQUE')[0]?.code;
    setForm({
      vehicleCode: vh, grade: 'SP',
      date: new Date().toISOString().slice(0, 10),
      validUntil: new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10),
      maxLiters: 50, maxAmount: null, reason: '',
    });
  };

  const [capBy, setCapBy] = useState<'liters' | 'amount'>('liters');
  const formFuel = vehFuel(form?.vehicleCode, (form as { grade?: string })?.grade);
  const setCap = (val: string) => {
    const n = val === '' ? undefined : Number(val);
    if (capBy === 'liters') setForm((f) => ({ ...f!, maxLiters: n, maxAmount: n != null ? Math.round(n * formFuel.price) : undefined }));
    else setForm((f) => ({ ...f!, maxAmount: n, maxLiters: n != null ? Math.round((n / formFuel.price) * 10) / 10 : undefined }));
  };
  useEffect(() => {
    if (!form) return;
    setForm((f) => {
      if (!f) return f;
      if (capBy === 'liters' && f.maxLiters != null) return { ...f, maxAmount: Math.round(Number(f.maxLiters) * formFuel.price) };
      if (capBy === 'amount' && f.maxAmount != null) return { ...f, maxLiters: Math.round((Number(f.maxAmount) / formFuel.price) * 10) / 10 };
      return f;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form?.vehicleCode, (form as { grade?: string })?.grade, capBy, formFuel.price]);
  const capOverTank = formFuel.tank != null && (form?.maxLiters ?? 0) > formFuel.tank + 0.5;

  const saveNew = async () => {
    if (!form?.vehicleCode || !form.reason?.trim()) { toast.error('Véhicule et motif obligatoires'); return; }
    if (!form.maxLiters && !form.maxAmount) { toast.error('Renseignez un plafond (litres ou montant)'); return; }
    if (capOverTank) { toast.error(`Plafond au-delà du plein max (${formFuel.tank} L)`); return; }
    const r = await create.mutateAsync({
      vehicleCode: form.vehicleCode, driverCode: form.driverCode || null,
      grade: formFuel.isEssence ? ((form as { grade?: string }).grade ?? 'SP') : null,
      date: form.date, validUntil: form.validUntil || null,
      maxLiters: capBy === 'liters' ? (form.maxLiters != null ? Number(form.maxLiters) : null) : null,
      maxAmount: capBy === 'amount' ? (form.maxAmount != null ? Number(form.maxAmount) : null) : null,
      reason: form.reason.trim(), issuedBy: 'Chargé exploitation',
    });
    toast.success(`Bon ${r.ref} émis — envoyez le QR au chauffeur`);
    setForm(null);
    setQrId(r.id);
  };

  const [consBy, setConsBy] = useState<'liters' | 'amount'>('liters');
  const openConsume = (r: RegieRow) => {
    setConsumeRow(r);
    setConsBy('liters');
    const px = vehFuel(r.vehicleCode).price;
    const L = r.maxLiters ?? (r.maxAmount != null ? Math.round((r.maxAmount / px) * 10) / 10 : 0);
    setC({ actualLiters: String(L || ''), actualAmount: String(L ? Math.round(L * px) : ''), station: '', actualDate: new Date().toISOString().slice(0, 10) });
  };
  const consPrice = vehFuel(consumeRow?.vehicleCode, consumeRow?.grade).price;
  const setCons = (val: string) => {
    const n = val === '' ? '' : Number(val);
    if (consBy === 'liters') setC((c) => ({ ...c, actualLiters: val, actualAmount: n === '' ? '' : String(Math.round(Number(n) * consPrice)) }));
    else setC((c) => ({ ...c, actualAmount: val, actualLiters: n === '' ? '' : String(Math.round((Number(n) / consPrice) * 10) / 10) }));
  };
  const overL = consumeRow?.maxLiters != null && Number(C.actualLiters) > consumeRow.maxLiters + 0.5;
  const overA = consumeRow?.maxAmount != null && Number(C.actualAmount) > consumeRow.maxAmount + 1;
  const overTank = (() => { const t = vehFuel(consumeRow?.vehicleCode).tank; return t != null && Number(C.actualLiters) > t + 0.5; })();
  const saveConsume = async () => {
    if (!consumeRow) return;
    if (!Number(C.actualLiters) && !Number(C.actualAmount)) { toast.error('Renseignez les litres ou le montant réel'); return; }
    if (overL || overA || overTank) { toast.error('Au-delà du plafond autorisé'); return; }
    try {
      await consume.mutateAsync({ id: consumeRow.id, body: { [consBy === 'liters' ? 'actualLiters' : 'actualAmount']: Number(consBy === 'liters' ? C.actualLiters : C.actualAmount), station: C.station || undefined, actualDate: C.actualDate } });
      toast.success('Achat régie enregistré — plein créé et rattaché au contrôle carburant');
      setConsumeRow(null);
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur');
    }
  };

  const stBadge = (s: string) => s === 'consomme' ? <span className="bg bg-g">Consommé</span> : s === 'annule' ? <span className="bg bg-t">Annulé</span> : <span className="bg bg-a">Émis</span>;

  return (
    <div className="tpane act">
      <div className="sg" style={{ marginBottom: 12 }}>
        <div className="sc"><div><div className="sv">{kpi.emis}</div><div className="sl">Bons en attente d&apos;achat</div><div className="st">émis, non encore consommés</div></div><div className="si am">{icons.alert}</div></div>
        <div className="sc"><div><div className="sv">{fk(kpi.litresMois)} L</div><div className="sl">Litres régie ce mois</div></div><div className="si bl">{icons.truck}</div></div>
        <div className="sc"><div><div className="sv">{fk(kpi.montantMois)} DA</div><div className="sl">Montant régie ce mois</div></div><div className="si tl">{icons.activity}</div></div>
      </div>

      <div className="tc">
        <div className="th">
          <h3>Bons d&apos;achat carburant régie</h3>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <SearchBox value={search.q} onChange={search.setQ} placeholder="N° bon, véhicule, motif…" count={search.count} total={rows.length} />
            <button className="btn btn-p" onClick={openNew}>+ Nouveau bon régie</button>
          </div>
        </div>
        <div style={{ fontSize: '.72rem', color: 'var(--tm)', padding: '0 12px 8px' }}>
          Avant tout achat carburant hors réseau (régie), on émet ici un bon avec un QR à envoyer au chauffeur / à la station. Au retour, on saisit l&apos;achat réel : le plein entre alors dans le contrôle carburant (source « Régie »).
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>N° Bon</th><th>Date</th><th>Véhicule</th><th>Chauffeur</th><th>Plafond L</th><th>Plafond DA</th><th>Valable jusqu&apos;au</th><th>Motif</th><th>Achat réel</th><th>Statut</th><th /></tr></thead>
            <tbody>
              {search.filtered.map((r) => {
                const expired = !!r.validUntil && r.validUntil < new Date().toISOString().slice(0, 10) && r.status === 'emis';
                return (
                  <tr key={r.id} style={expired ? { background: 'var(--r1)' } : undefined}>
                    <td style={{ fontWeight: 600 }}>{r.ref}</td>
                    <td>{fd(r.date)}</td>
                    <td>{r.vehicleCode}<div style={{ fontSize: '.6rem', color: 'var(--tm)' }}>{gradeLabel(r.grade) ?? r.fuelType}</div></td>
                    <td>{drName(r.driverCode)}</td>
                    <td>{r.maxLiters ?? '—'}</td>
                    <td>{r.maxAmount != null ? fk(r.maxAmount) : '—'}</td>
                    <td style={expired ? { color: 'var(--r6)', fontWeight: 600 } : undefined}>{r.validUntil ?? '—'}{expired ? ' (expiré)' : ''}</td>
                    <td style={{ fontSize: '.72rem', maxWidth: 220 }}>{r.reason}</td>
                    <td style={{ fontSize: '.72rem' }}>{r.status === 'consomme' ? `${fk(r.actualLiters)} L · ${fk(r.actualAmount)} DA${r.station ? ` · ${r.station}` : ''}` : '—'}</td>
                    <td>{stBadge(r.status)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-o btn-sm" onClick={() => setQrId(r.id)}>QR</button>{' '}
                      {r.status === 'emis' && <button className="btn btn-p btn-sm" onClick={() => openConsume(r)}>Enregistrer l&apos;achat</button>}{' '}
                      <button className="btn btn-r btn-sm" onClick={() => { if (confirm(`Supprimer le bon ${r.ref} ?${r.linkedFuelEntryId ? ' Le plein rattaché sera aussi supprimé.' : ''}`)) remove.mutate(r.id); }}>Suppr.</button>
                    </td>
                  </tr>
                );
              })}
              {!search.filtered.length && <tr><td colSpan={11} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun bon régie. Créez-en un avant tout achat carburant hors réseau.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {form && (
        <Modal open onClose={() => setForm(null)} title="Nouveau bon d'achat carburant régie"
          footer={<><button className="btn btn-o" onClick={() => setForm(null)}>Annuler</button><button className="btn btn-p" onClick={saveNew} disabled={create.isPending}>Émettre le bon + QR</button></>}>
          <div className="form-r">
            <div className="form-g"><label>Véhicule</label>
              <select value={form.vehicleCode ?? ''} onChange={(e) => { const v = vehicles.find((x) => x.code === e.target.value); setForm({ ...form, vehicleCode: e.target.value, driverCode: form.driverCode || v?.driverCode || undefined }); }}>
                {vehicles.filter((v) => v.type !== 'REMORQUE').map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}
              </select>
            </div>
            <div className="form-g"><label>Chauffeur</label>
              <select value={form.driverCode ?? ''} onChange={(e) => setForm({ ...form, driverCode: e.target.value })}>
                <option value="">—</option>{drivers.map((d) => <option key={d.code} value={d.code}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ fontSize: '.74rem', color: 'var(--tm)', background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '8px 10px', margin: '2px 0 10px' }}>
            Carburant : <b style={{ color: 'var(--tp)' }}>{formFuel.type === 'ESSENCE' ? 'Essence' : formFuel.type}</b> <span style={{ opacity: .8 }}>(fiche véhicule)</span> · prix {formFuel.price.toFixed(2)} DA/L
            {formFuel.tank != null && <> · plein max <b style={{ color: 'var(--tp)' }}>{formFuel.tank} L</b></>}
          </div>
          {formFuel.isEssence && (
            <div className="form-r">
              <div className="form-g">
                <label>Qualité essence <span style={{ color: 'var(--tm)', fontWeight: 400 }}>(ce véhicule accepte les deux)</span></label>
                <select value={(form as { grade?: string }).grade ?? 'SP'} onChange={(e) => setForm({ ...form, grade: e.target.value } as Partial<RegieRow>)}>
                  <option value="SP">Sans plomb — {(prices.data?.SP ?? 0).toFixed(2)} DA/L</option>
                  <option value="SUPER">Super — {(prices.data?.SUPER ?? 0).toFixed(2)} DA/L</option>
                </select>
              </div>
              <div className="form-g" />
            </div>
          )}
          <div className="form-r">
            <div className="form-g">
              <label>Plafond — je saisis</label>
              <select value={capBy} onChange={(e) => { setCapBy(e.target.value as 'liters' | 'amount'); }}>
                <option value="liters">les litres</option>
                <option value="amount">le montant (DA)</option>
              </select>
            </div>
            <div className="form-g"><label>Valable jusqu&apos;au</label><DateInput value={form.validUntil ?? ''} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} /></div>
          </div>
          <div className="form-r">
            <div className="form-g">
              <label>Plafond litres {capBy === 'amount' && <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— calculé</span>}</label>
              <input type="number" value={form.maxLiters ?? ''} readOnly={capBy === 'amount'}
                style={capOverTank ? { borderColor: 'var(--r6)' } : capBy === 'amount' ? { background: 'var(--s0)' } : undefined}
                onChange={(e) => setCap(e.target.value)} />
              {capOverTank && <span style={{ fontSize: '.7rem', color: 'var(--r6)' }}>Au-delà du plein max ({formFuel.tank} L)</span>}
            </div>
            <div className="form-g">
              <label>Plafond montant (DA) {capBy === 'liters' && <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— calculé</span>}</label>
              <input type="number" value={form.maxAmount ?? ''} readOnly={capBy === 'liters'}
                style={capBy === 'liters' ? { background: 'var(--s0)' } : undefined}
                onChange={(e) => setCap(e.target.value)} />
            </div>
          </div>
          <div className="form-g"><label>Motif <span style={{ color: 'var(--r6)' }}>*</span></label>
            <textarea rows={2} value={form.reason ?? ''} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Ex : déplacement hors réseau NAFTAL, panne / remorquage, station fermée…" style={{ width: '100%' }} />
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--tm)' }}>À l&apos;émission, un QR de vérification est généré : envoyez-le au chauffeur (il le présente à la station). La station peut scanner le QR pour confirmer l&apos;autorisation et les plafonds.</div>
        </Modal>
      )}

      {qrId && <RegieQrModal id={qrId} onClose={() => setQrId(null)} />}

      {consumeRow && (
        <Modal open onClose={() => setConsumeRow(null)} title={`Enregistrer l'achat — ${consumeRow.ref}`}
          footer={<><button className="btn btn-o" onClick={() => setConsumeRow(null)}>Annuler</button><button className="btn btn-p" onClick={saveConsume} disabled={consume.isPending || overL || overA || overTank}>Enregistrer l&apos;achat</button></>}>
          <div style={{ fontSize: '.75rem', color: 'var(--tm)', marginBottom: 8 }}>
            {consumeRow.vehicleCode} · {drName(consumeRow.driverCode)} · {gradeLabel(consumeRow.grade) ?? vehFuel(consumeRow.vehicleCode).type} à {consPrice.toFixed(2)} DA/L · plafonds : {consumeRow.maxLiters ?? '—'} L / {consumeRow.maxAmount != null ? fk(consumeRow.maxAmount) : '—'} DA
          </div>
          <div className="form-r">
            <div className="form-g"><label>Je saisis</label>
              <select value={consBy} onChange={(e) => setConsBy(e.target.value as 'liters' | 'amount')}>
                <option value="liters">les litres réels</option>
                <option value="amount">le montant réel (DA)</option>
              </select>
            </div>
            <div className="form-g" />
          </div>
          <div className="form-r">
            <div className="form-g"><label>Litres réels {consBy === 'amount' && <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— calculé</span>}</label>
              <input type="number" value={C.actualLiters} readOnly={consBy === 'amount'} style={consBy === 'amount' ? { background: 'var(--s0)' } : undefined} onChange={(e) => setCons(e.target.value)} />
              {(overL || overTank) && <span style={{ fontSize: '.7rem', color: 'var(--r6)' }}>Au-delà du plafond ({overTank ? `plein max ${vehFuel(consumeRow.vehicleCode).tank} L` : `${consumeRow.maxLiters} L`})</span>}</div>
            <div className="form-g"><label>Montant réel (DA) {consBy === 'liters' && <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— calculé</span>}</label>
              <input type="number" value={C.actualAmount} readOnly={consBy === 'liters'} style={consBy === 'liters' ? { background: 'var(--s0)' } : undefined} onChange={(e) => setCons(e.target.value)} />
              {overA && <span style={{ fontSize: '.7rem', color: 'var(--r6)' }}>Au-delà du plafond ({fk(consumeRow.maxAmount)} DA)</span>}</div>
          </div>
          <div className="form-r">
            <div className="form-g"><label>Date</label><DateInput value={C.actualDate} onChange={(e) => setC({ ...C, actualDate: e.target.value })} /></div>
            <div className="form-g"><label>Station</label><PlaceInput value={C.station} onChange={(v) => setC({ ...C, station: v })} placeholder="Nom / adresse de la station (Naftal…)" /></div>
          </div>
          {Number(C.actualLiters) > 0 && Number(C.actualAmount) > 0 && (
            <div style={{ fontSize: '.74rem', color: 'var(--tm)' }}>Prix unitaire : {(Number(C.actualAmount) / Number(C.actualLiters)).toFixed(2)} DA/L — un plein « Régie » sera créé pour {consumeRow.vehicleCode}.</div>
          )}
        </Modal>
      )}
    </div>
  );
}

type RegieRow = {
  id: string; ref: string; verifyToken: string; vehicleCode: string; driverCode: string | null;
  fuelType: string; grade?: string | null; date: string; validUntil: string | null; maxLiters: number | null; maxAmount: number | null;
  reason: string; status: string; actualLiters: number | null; actualAmount: number | null; actualDate: string | null;
  station: string | null; linkedFuelEntryId: string | null;
};
const gradeLabel = (g?: string | null) => (g === 'SP' ? 'Sans plomb' : g === 'SUPER' ? 'Super' : null);

function RegieQrModal({ id, onClose }: { id: string; onClose: () => void }) {
  const qr = useRegieQr(id);
  const d = qr.data;
  const doPrint = () => {
    if (!d) return;
    const p = d.purchase as Record<string, unknown>;
    printHTML(`Bon régie ${d.ref ?? ''}`, `
      <h1>Bon d'achat carburant régie — ${htmlEsc(d.ref)}</h1>
      <table class="info"><tbody>
        <tr><td>Véhicule</td><td>${htmlEsc(p.vehicleCode)}</td></tr>
        <tr><td>Chauffeur</td><td>${htmlEsc(p.driverCode ?? '—')}</td></tr>
        <tr><td>Carburant</td><td>${htmlEsc(p.fuelType)}</td></tr>
        <tr><td>Plafond litres</td><td>${htmlEsc(p.maxLiters ?? '—')} L</td></tr>
        <tr><td>Plafond montant</td><td>${htmlEsc(p.maxAmount ?? '—')} DA</td></tr>
        <tr><td>Valable jusqu'au</td><td>${htmlEsc(p.validUntil ?? '—')}</td></tr>
        <tr><td>Motif</td><td>${htmlEsc(p.reason ?? '')}</td></tr>
      </tbody></table>
      <div style="text-align:center;margin-top:16px">
        <img src="${d.qr}" width="180" height="180" alt="QR" />
        <div style="font-size:11px;color:#666;margin-top:6px">${htmlEsc(d.verifyUrl)}</div>
        <div style="font-size:12px;margin-top:10px">La station scanne ce QR pour vérifier l'autorisation avant de servir.</div>
      </div>`);
  };
  return (
    <Modal open onClose={onClose} title="QR du bon régie — à envoyer au chauffeur"
      footer={<><button className="btn btn-o" onClick={onClose}>Fermer</button><button className="btn btn-p" onClick={doPrint} disabled={!d}>Imprimer le bon</button></>}>
      {qr.isLoading && <p style={{ padding: 16 }}>Génération…</p>}
      {d && (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>{d.ref}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={d.qr} width={180} height={180} alt="QR bon régie" style={{ border: '1px solid var(--bd)', borderRadius: 8 }} />
          <div style={{ fontSize: '.72rem', color: 'var(--tm)', marginTop: 8, wordBreak: 'break-all' }}>{d.verifyUrl}</div>
          <div style={{ fontSize: '.75rem', color: 'var(--tm)', marginTop: 8 }}>
            Envoyez cette image au chauffeur (WhatsApp) ou imprimez le bon. La station scanne le QR pour confirmer l&apos;autorisation et les plafonds.
          </div>
        </div>
      )}
    </Modal>
  );
}

function htmlEsc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ─── Bilan visuel : barres empilées ─── */
type BilanSeg = { key: string; label: string; liters: number; value: number; color: string };

function StackBar({ segs, total }: { segs: BilanSeg[]; total: number }) {
  const t = total > 0 ? total : 1;
  return (
    <div style={{ display: 'flex', width: '100%', height: 40, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--bd)' }}>
      {segs.filter((s) => s.liters > 0).map((s) => (
        <div key={s.key} title={`${s.label} : ${fk(s.liters)} L`}
          style={{ flex: `${s.liters} 0 0`, minWidth: (s.liters / t) > 0.06 ? 0 : 2, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '.62rem', fontWeight: 600, overflow: 'hidden', whiteSpace: 'nowrap' }}>
          {(s.liters / t) > 0.08 ? `${fk(s.liters)} L` : ''}
        </div>
      ))}
    </div>
  );
}

function BilanLegend({ segs, total }: { segs: BilanSeg[]; total: number }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 8 }}>
      {segs.filter((s) => s.liters > 0).map((s) => (
        <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '.72rem' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--tm)' }}>{s.label}</span>
          <b>{fk(s.liters)} L</b>
          {total > 0 && <span style={{ color: 'var(--tm)' }}>({Math.round((s.liters / total) * 100)}%)</span>}
        </div>
      ))}
    </div>
  );
}
