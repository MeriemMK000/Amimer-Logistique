'use client';

import { icons } from '@/components/ui/icons';
import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  useCreate, useFuelEntries, useLeaseContracts, useLeasePointage, useMaintenanceOrders,
  useUpdate, useUpsertLeasePointage, useVehicles,
} from '@/lib/api/hooks';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import SearchBox from '@/components/ui/SearchBox';
import DateInput from '@/components/ui/DateInput';
import { useSearch } from '@/lib/useSearch';
import { fd, fk } from '@/lib/fleet/format';
import { getContractForMonth, immoPrice, last6Months, leaseDayCost, leaseMonthAgg } from '@/lib/fleet/location';
import { printReport } from '@/lib/export';
import type { LeaseContract, LeasePointage, Vehicle } from '@/lib/types';

const typeCls = (t: string) => (t === 'ENGIN' ? 'bg-b' : t === 'LOURD' ? 'bg-a' : 'bg-t');
const MONTH_ABBR = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];

// Journee de travail = 8 h. La fraction pointee sert au calcul du cout :
//   cout du jour = prix quotidien du contrat × fraction.
// Liste en heures, pas de 30 min (demande DG) : 0 · 0h30 · 1h · 1h30 · … · 8h = 1 journee.
const HOURS_PER_DAY = 8;
const FRACTIONS: { v: number; l: string }[] = (() => {
  const list: { v: number; l: string }[] = [{ v: 0, l: '0' }];
  for (let h = 0.5; h <= HOURS_PER_DAY; h += 0.5) {
    const label =
      h === HOURS_PER_DAY ? '8 h — 1 jour'
        : Number.isInteger(h) ? `${h} h`
          : `${Math.floor(h)} h 30`;
    list.push({ v: h / HOURS_PER_DAY, l: label });
  }
  return list;
})();
/** Valeur spéciale « immobilisé sur place » dans la liste déroulante. */
const IMMO = 'I';
/** Cale une fraction quelconque sur l'option la plus proche de la liste. */
const snap = (f: number) =>
  FRACTIONS.reduce((best, o) => (Math.abs(o.v - f) < Math.abs(best.v - f) ? o : best), FRACTIONS[0]).v;
const ptFraction = (p?: { fraction?: number | null; present?: boolean }) =>
  p ? (p.fraction ?? (p.present ? 1 : 0)) : 0;
const fmtDays = (d: number) => (Number.isInteger(d) ? String(d) : d.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));

export default function LocationPage() {
  const [tab, setTab] = useState(0);
  const months = last6Months();
  const [month, setMonth] = useState(months[0].value);
  const [ptVh, setPtVh] = useState('ALL');
  const [contractModal, setContractModal] = useState<LeaseContract | null | undefined>(undefined);

  const vehicles = useVehicles();
  const contracts = useLeaseContracts();
  const pointage = useLeasePointage();
  const fuel = useFuelEntries();
  const maint = useMaintenanceOrders();
  const createCt = useCreate<LeaseContract>('lease-contracts');
  const updateCt = useUpdate<LeaseContract>('lease-contracts');
  const upsertPt = useUpsertLeasePointage();

  const V = vehicles.data ?? [];
  const CT = contracts.data ?? [];
  const PT = pointage.data ?? [];
  const FU = fuel.data ?? [];
  const MT = maint.data ?? [];
  const locVh = V.filter((v) => v.ownership === 'LOCATION');
  const ctSearch = useSearch(CT, (c) => {
    const v = V.find((x) => x.code === c.vehicleCode);
    return [c.num, c.vehicleCode, v?.brand, v?.model, c.notes].join(' ');
  });
  const today = new Date();
  const ym = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const todayStr = today.toISOString().slice(0, 10);

  const kpi = useMemo(() => {
    let totalMensuel = 0;
    let immoMois = 0;
    locVh.forEach((v) => {
      const a = leaseMonthAgg(v.code, ym, PT, CT);
      totalMensuel += a.cost;
      immoMois += a.immoDays;
    });
    const expiring = CT.filter((c) => { const diff = Math.ceil((+new Date(c.endDate) - +today) / 86_400_000); return diff >= 0 && diff <= 60; }).length;
    const active = CT.filter((c) => c.startDate <= todayStr && c.endDate >= todayStr).length;
    const propre = V.filter((v) => v.ownership === 'PROPRE').length;
    return { totalMensuel, immoMois, expiring, active, propre };
  }, [locVh, CT, PT, V]);

  const ptVhList = ptVh === 'ALL' ? locVh : locVh.filter((v) => v.code === ptVh);
  const [y, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  const setPt = (vh: string, date: string, opt: number | typeof IMMO) =>
    upsertPt.mutate([opt === IMMO
      ? { vehicleCode: vh, date, fraction: 1, immobilized: true }
      : { vehicleCode: vh, date, fraction: opt, immobilized: false }]);

  /** Remplit tous les jours ouvrés du mois (Dim→Jeu) pour un véhicule. */
  const fillWorkdays = (vh: string, fraction: number) => {
    const rows: { vehicleCode: string; date: string; fraction: number; immobilized: boolean }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(y, mo - 1, d).getDay();
      if (dow === 5 || dow === 6) continue; // vendredi / samedi
      rows.push({ vehicleCode: vh, date: `${month}-${String(d).padStart(2, '0')}`, fraction, immobilized: false });
    }
    upsertPt.mutate(rows);
  };
  const clearRow = (vh: string) => {
    const rows = Array.from({ length: daysInMonth }, (_, i) => ({
      vehicleCode: vh, date: `${month}-${String(i + 1).padStart(2, '0')}`, fraction: 0, immobilized: false,
    }));
    upsertPt.mutate(rows);
  };

  return (
    <div className="page active">
      <div className="sg" style={{ marginBottom: 12 }}>
        <div className="sc"><div><div className="sv">{locVh.length}</div><div className="sl">Véhicules en Location</div><div className="st">sur {V.length} total</div></div><div className="si bl">{icons.truck}</div></div>
        <div className="sc"><div><div className="sv">{fk(Math.round(kpi.totalMensuel))}</div><div className="sl">Location Mois en Cours (DA)</div><div className="st">Pointage × prix/jour + immobilisation</div></div><div className="si am">{icons.activity}</div></div>
        <div className="sc"><div><div className="sv" style={kpi.immoMois ? { color: 'var(--a6)' } : undefined}>{kpi.immoMois}</div><div className="sl">Jours Immobilisation (mois)</div><div className="st dn">Sur place, hors déplacement</div></div><div className="si am">{icons.alert}</div></div>
        <div className="sc"><div><div className="sv">{kpi.active}</div><div className="sl">Contrats Actifs</div><div className="st">{kpi.expiring ? `${kpi.expiring} expirant · ` : ''}{kpi.propre} propres</div></div><div className="si gn">{icons.check}</div></div>
      </div>

      <Tabs tabs={['Contrats', 'Pointage', 'Facturation', 'Statistiques', 'Répartition BU']} active={tab} onChange={setTab} />

      {tab === 0 && (
        <div className="tpane act">
          <div className="tc">
            <div className="th"><h3>Contrats de Location</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <SearchBox value={ctSearch.q} onChange={ctSearch.setQ} placeholder="N° contrat, véhicule…" count={ctSearch.count} total={CT.length} />
                <button className="btn btn-p btn-sm" onClick={() => setContractModal(null)}>+ Nouveau Contrat</button>
              </div>
            </div>
            <div className="tw">
              <table>
                <thead><tr><th>N° Contrat</th><th>Véhicule</th><th>Marque / Modèle</th><th>Type</th><th>Prix/Jour (DA)</th><th>Prix Immo. (DA)</th><th>Début</th><th>Fin</th><th>Jours Restants</th><th>Coût Mensuel Est. (DA)</th><th>Statut</th><th>Actions</th></tr></thead>
                <tbody>
                  {ctSearch.filtered.map((ct) => {
                    const v = V.find((x) => x.code === ct.vehicleCode);
                    const jrs = Math.ceil((+new Date(ct.endDate) - +today) / 86_400_000);
                    const expired = ct.endDate < todayStr;
                    return (
                      <tr key={ct.id}>
                        <td style={{ fontWeight: 600 }}>{ct.num}</td><td style={{ fontWeight: 600 }}>{ct.vehicleCode}</td>
                        <td>{v ? `${v.brand} ${v.model}` : ct.vehicleCode}</td>
                        <td><span className={`bg ${typeCls(v?.type ?? '')}`}>{v?.type ?? '—'}</span></td>
                        <td style={{ fontWeight: 700, color: 'var(--b5)' }}>{fk(ct.dailyPrice)} DA</td>
                        <td style={{ color: 'var(--a6)' }}>{fk(immoPrice(ct))} DA</td>
                        <td>{fd(ct.startDate)}</td><td>{fd(ct.endDate)}</td>
                        <td style={{ fontWeight: 600, color: jrs < 30 ? 'var(--r6)' : undefined }}>{jrs}j</td>
                        <td>{fk(Math.round(ct.dailyPrice * 30))} DA</td>
                        <td>{expired ? <span className="bg bg-r">Expiré</span> : jrs < 30 ? <span className="bg bg-r">Critique</span> : jrs < 60 ? <span className="bg bg-a">Bientôt</span> : <span className="bg bg-g">Actif</span>}</td>
                        <td><button className="btn btn-o btn-sm" onClick={() => setContractModal(ct)}>Modifier</button></td>
                      </tr>
                    );
                  })}
                  {!ctSearch.filtered.length && <tr><td colSpan={12} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>{CT.length ? `Aucun contrat ne correspond à « ${ctSearch.q} »` : 'Aucun contrat'}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 1 && (
        <div className="tpane act">
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <select value={month} onChange={(e) => setMonth(e.target.value)}>{months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
            <select value={ptVh} onChange={(e) => setPtVh(e.target.value)}><option value="ALL">Tous</option>{locVh.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}</select>
            <span style={{ fontSize: '.7rem', color: 'var(--tm)' }}>
              Journée = {HOURS_PER_DAY} h · <b>0</b> pas travaillé · <b>8 h = 1 jour</b> · <b>I</b> = immobilisé sur place (prix immo.) · coût = prix/jour × fraction
            </span>
          </div>
          <div className="tc">
            <div className="th">
              <h3>Pointage Location</h3>
              <div style={{ fontSize: '.75rem', color: 'var(--tm)' }}>Choisir la fraction de journée dans la liste — enregistrement immédiat.</div>
            </div>
            <div className="tw" style={{ overflowX: 'auto' }}>
              <table style={{ fontSize: '.7rem', borderCollapse: 'collapse', minWidth: daysInMonth * 42 + 220 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth: 150, textAlign: 'left', padding: '4px 6px', position: 'sticky', left: 0, background: 'var(--s1)', zIndex: 1 }}>Véhicule</th>
                    {Array.from({ length: daysInMonth }, (_, i) => {
                      const d = i + 1;
                      const dow = new Date(y, mo - 1, d).getDay();
                      const isWe = dow === 5 || dow === 6;
                      return <th key={d} style={{ textAlign: 'center', padding: '2px 1px', minWidth: 40, fontSize: '.58rem', background: isWe ? 'var(--b0)' : undefined }}>{d}<br /><span style={{ fontWeight: 400, color: 'var(--tm)' }}>{dayNames[dow]}</span></th>;
                    })}
                    <th style={{ textAlign: 'center', padding: '4px 6px', minWidth: 130, fontWeight: 700 }}>Total mois</th>
                  </tr>
                </thead>
                <tbody>
                  {ptVhList.map((v) => {
                    const ct = getContractForMonth(v.code, month, CT);
                    let sumFrac = 0, immoDays = 0, cost = 0;
                    const cells = Array.from({ length: daysInMonth }, (_, i) => {
                      const d = i + 1;
                      const dateStr = `${month}-${String(d).padStart(2, '0')}`;
                      const dow = new Date(y, mo - 1, d).getDay();
                      const isWe = dow === 5 || dow === 6;
                      const p = PT.find((x) => x.vehicleCode === v.code && x.date === dateStr);
                      const isImmo = !!p?.immobilized;
                      const f = isImmo ? 1 : snap(ptFraction(p));
                      if (isImmo) { immoDays += 1; cost += immoPrice(ct); }
                      else { sumFrac += f; cost += f * (ct?.dailyPrice ?? 0); }
                      const bg = isImmo ? 'var(--r1)' : f >= 1 ? 'var(--g1)' : f > 0 ? 'var(--a1)' : isWe ? 'var(--b0)' : 'transparent';
                      return (
                        <td key={d} style={{ padding: 1, border: '1px solid var(--bd)', background: bg }}>
                          <select
                            value={isImmo ? IMMO : String(f)}
                            onChange={(e) => setPt(v.code, dateStr, e.target.value === IMMO ? IMMO : Number(e.target.value))}
                            title={isImmo ? 'Immobilisé sur place' : `${(f * HOURS_PER_DAY).toFixed(2)} h`}
                            style={{ width: '100%', border: 0, background: 'transparent', fontSize: '.62rem', textAlign: 'center', color: isImmo ? 'var(--r6)' : f > 0 ? 'var(--tp)' : 'var(--tm)', fontWeight: isImmo || f > 0 ? 700 : 400, cursor: 'pointer', appearance: 'none' }}
                          >
                            {FRACTIONS.map((o) => <option key={o.v} value={String(o.v)}>{o.l}</option>)}
                            <option value={IMMO}>I — Immobilisé</option>
                          </select>
                        </td>
                      );
                    });
                    return (
                      <tr key={v.code}>
                        <td style={{ fontWeight: 600, padding: '4px 6px', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--s1)', zIndex: 1 }}>
                          <div>{v.code} <span className={`bg ${typeCls(v.type)}`} style={{ fontSize: '.5rem' }}>{v.type}</span></div>
                          <div style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.58rem' }}>{v.brand} {v.model} · {fk(ct?.dailyPrice ?? 0)} DA/j · immo {fk(immoPrice(ct))}</div>
                          <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                            <button className="btn btn-o btn-sm" style={{ fontSize: '.55rem', padding: '1px 5px' }} onClick={() => fillWorkdays(v.code, 1)}>Ouvrés = 1 j</button>
                            <button className="btn btn-o btn-sm" style={{ fontSize: '.55rem', padding: '1px 5px' }} onClick={() => clearRow(v.code)}>Effacer</button>
                          </div>
                        </td>
                        {cells}
                        <td style={{ textAlign: 'center', padding: '4px 6px', fontWeight: 700, background: 'var(--s1)', whiteSpace: 'nowrap' }}>
                          {fmtDays(Math.round(sumFrac * 1000) / 1000)} j{immoDays ? ` + ${immoDays} I` : ''} · {Math.round(sumFrac * HOURS_PER_DAY)} h<br />
                          <span style={{ color: 'var(--b5)' }}>{fk(Math.round(cost))} DA</span>
                        </td>
                      </tr>
                    );
                  })}
                  {!ptVhList.length && <tr><td colSpan={daysInMonth + 2} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun véhicule en location</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === 2 && (
        <div className="tpane act">
          <div style={{ marginBottom: 8 }}><select value={month} onChange={(e) => setMonth(e.target.value)}>{months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
          <FacturationTable month={month} locVh={locVh} CT={CT} PT={PT} FU={FU} MT={MT} />
        </div>
      )}

      {tab === 3 && <LocationStats locVh={locVh} CT={CT} PT={PT} />}

      {tab === 4 && <BuBreakdown />}

      {contractModal !== undefined && (
        <ContractModal contract={contractModal} vehicles={V} nextId={`LC-${String(CT.length + 1).padStart(3, '0')}`}
          onClose={() => setContractModal(undefined)}
          onCreate={async (b) => { await createCt.mutateAsync(b); toast.success(`Contrat ${b.num} enregistré`); }}
          onUpdate={async (id, b) => { await updateCt.mutateAsync({ id, body: b }); toast.success('Contrat mis à jour'); }} />
      )}
    </div>
  );
}

function FacturationTable({ month, locVh, CT, PT, FU, MT }: {
  month: string; locVh: Vehicle[]; CT: LeaseContract[]; PT: LeasePointage[]; FU: import('@/lib/types').FuelEntry[]; MT: import('@/lib/types').MaintenanceOrder[];
}) {
  const mSlash = month.replace('-', '/').slice(2);
  const rows = locVh.map((v) => {
    const ct = getContractForMonth(v.code, month, CT);
    const agg = leaseMonthAgg(v.code, month, PT, CT);
    const ptHours = Math.round(agg.days * 8);
    const locCost = agg.cost;
    const fuCost = FU.filter((f) => f.vehicleCode === v.code && f.date?.endsWith(mSlash)).reduce((s, f) => s + (f.amount ?? (f.qty ?? 0) * (f.unitPrice ?? 0)), 0);
    const mtCost = MT.filter((o) => o.vehicleCode === v.code).reduce((s, o) => s + (o.totalCost ?? 0), 0);
    return { v, ct, ptFrac: agg.days, immoDays: agg.immoDays, ptHours, locCost: Math.round(locCost), fuCost: Math.round(fuCost), mtCost, total: Math.round(locCost + fuCost + mtCost) };
  }).sort((a, b) => b.total - a.total);
  const g = rows.reduce((acc, r) => ({ loc: acc.loc + r.locCost, fu: acc.fu + r.fuCost, mt: acc.mt + r.mtCost, tot: acc.tot + r.total }), { loc: 0, fu: 0, mt: 0, tot: 0 });
  return (
    <div className="tc">
      <div className="th"><h3>Facturation Mensuelle Location</h3>
        <button className="btn btn-o btn-sm" onClick={() => printReport('Facturation Mensuelle Location', `Mois ${month}`, [{
          columns: ['Véhicule', 'Type', 'N° Contrat', 'Prix/Jour (DA)', 'Jours pointés', 'Jours immo.', 'Montant Location (DA)', 'Carburant (DA)', 'Maintenance (DA)', 'TOTAL (DA)'],
          rows: rows.map((r) => [`${r.v.code} ${r.v.brand} ${r.v.model}`, r.v.type, r.ct?.num ?? '—', fk(r.ct?.dailyPrice ?? 0), fmtDays(Math.round(r.ptFrac * 1000) / 1000), r.immoDays, fk(r.locCost), fk(r.fuCost), fk(r.mtCost), fk(r.total)]),
          footer: ['TOTAL FLOTTE LOUÉE', '', '', '', '', '', fk(Math.round(g.loc)), fk(g.fu), fk(g.mt), fk(Math.round(g.tot))],
        }])}>Imprimer l&apos;état</button>
      </div>
      <div className="tw">
        <table>
          <thead><tr><th>Véhicule</th><th>Type</th><th>N° Contrat</th><th>Prix/Jour (DA)</th><th>Jours pointés</th><th>Jours immo.</th><th>Heures pointées</th><th>Montant Location (DA)</th><th>Carburant (DA)</th><th>Maintenance (DA)</th><th>TOTAL (DA)</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.v.code}>
                <td style={{ fontWeight: 600 }}>{r.v.code} <span style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.7rem' }}>{r.v.brand} {r.v.model}</span></td>
                <td><span className={`bg ${typeCls(r.v.type)}`}>{r.v.type}</span></td>
                <td style={{ fontSize: '.7rem' }}>{r.ct?.num ?? '—'}</td>
                <td>{fk(r.ct?.dailyPrice ?? 0)} DA</td>
                <td>{fmtDays(Math.round(r.ptFrac * 1000) / 1000)} j</td>
                <td style={{ color: r.immoDays ? 'var(--a6)' : undefined }}>{r.immoDays} j</td>
                <td>{r.ptHours} h</td>
                <td style={{ fontWeight: 600, color: 'var(--b5)' }}>{fk(r.locCost)} DA</td>
                <td>{fk(r.fuCost)} DA</td><td>{fk(r.mtCost)} DA</td>
                <td style={{ fontWeight: 700 }}>{fk(r.total)} DA</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr style={{ background: 'var(--b0)', fontWeight: 700 }}><td colSpan={7}>TOTAL FLOTTE LOUÉE</td><td style={{ color: 'var(--b5)' }}>{fk(Math.round(g.loc))} DA</td><td>{fk(g.fu)} DA</td><td>{fk(g.mt)} DA</td><td>{fk(Math.round(g.tot))} DA</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}

function BuBreakdown() {
  return (
    <div className="tpane act">
      <div className="cc" style={{ padding: 24 }}>
        <h3>Répartition des Coûts par BU / Centre Analytique</h3>
        <p style={{ fontSize: '.8rem', color: 'var(--tm)', marginTop: 8 }}>Voir le module <b>Facturation BU</b> pour la ventilation complète par Business Unit.</p>
      </div>
    </div>
  );
}

/** Statistiques location : facturation mensuelle / jours / immobilisation par véhicule sur une année. */
function LocationStats({ locVh, CT, PT }: { locVh: Vehicle[]; CT: LeaseContract[]; PT: LeasePointage[] }) {
  const curYear = new Date().getFullYear();
  const [year, setYear] = useState(curYear);
  const yearOptions = [curYear + 1, curYear, curYear - 1, curYear - 2];
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

  const rows = locVh.map((v) => {
    const perMonth = months.map((ym) => leaseMonthAgg(v.code, ym, PT, CT));
    const totalCost = perMonth.reduce((s, a) => s + a.cost, 0);
    const totalDays = perMonth.reduce((s, a) => s + a.days, 0);
    const immoYear = perMonth.reduce((s, a) => s + a.immoDays, 0);
    const immoCumul = PT.filter((p) => p.vehicleCode === v.code && p.immobilized).length;
    return { v, perMonth, totalCost, totalDays, immoYear, immoCumul };
  });
  const colTot = months.map((_, mi) => rows.reduce((s, r) => s + r.perMonth[mi].cost, 0));

  return (
    <div className="tpane act">
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10 }}>
        <label style={{ fontSize: '.78rem', color: 'var(--tm)' }}>Année</label>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="tc">
        <div className="th"><h3>Facturation mensuelle par véhicule — {year} (DA)</h3></div>
        <div className="tw">
          <table style={{ fontSize: '.72rem', minWidth: 900 }}>
            <thead><tr>
              <th style={{ position: 'sticky', left: 0, background: 'var(--s1)', zIndex: 1 }}>Véhicule</th>
              {MONTH_ABBR.map((m) => <th key={m}>{m}</th>)}
              <th>Total année</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.v.code}>
                  <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--s1)', whiteSpace: 'nowrap', zIndex: 1 }}>{r.v.code} <span style={{ color: 'var(--tm)', fontWeight: 400 }}>{r.v.brand}</span></td>
                  {r.perMonth.map((a, i) => <td key={i}>{a.cost ? fk(Math.round(a.cost)) : '—'}</td>)}
                  <td style={{ fontWeight: 700, color: 'var(--b5)' }}>{fk(Math.round(r.totalCost))} DA</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={14} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun véhicule loué</td></tr>}
            </tbody>
            <tfoot><tr style={{ background: 'var(--b0)', fontWeight: 700 }}>
              <td style={{ position: 'sticky', left: 0, background: 'var(--b0)' }}>TOTAL</td>
              {colTot.map((c, i) => <td key={i}>{c ? fk(Math.round(c)) : '—'}</td>)}
              <td style={{ color: 'var(--b5)' }}>{fk(Math.round(colTot.reduce((s, c) => s + c, 0)))} DA</td>
            </tr></tfoot>
          </table>
        </div>
      </div>

      <div className="tc">
        <div className="th"><h3>Jours facturés par véhicule — {year}</h3></div>
        <div className="tw">
          <table style={{ fontSize: '.72rem', minWidth: 900 }}>
            <thead><tr>
              <th style={{ position: 'sticky', left: 0, background: 'var(--s1)', zIndex: 1 }}>Véhicule</th>
              {MONTH_ABBR.map((m) => <th key={m}>{m}</th>)}
              <th>Total jours</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.v.code}>
                  <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--s1)', whiteSpace: 'nowrap', zIndex: 1 }}>{r.v.code}</td>
                  {r.perMonth.map((a, i) => <td key={i}>{a.days || a.immoDays ? `${fmtDays(Math.round((a.days) * 100) / 100)}${a.immoDays ? ` +${a.immoDays}I` : ''}` : '—'}</td>)}
                  <td style={{ fontWeight: 700 }}>{fmtDays(Math.round(r.totalDays * 100) / 100)} j</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="tc">
        <div className="th"><h3>Jours d&apos;immobilisation par véhicule — <b>info importante</b></h3></div>
        <div className="tw">
          <table>
            <thead><tr><th>Véhicule</th><th>Marque / Modèle</th><th>Immobilisation {year}</th><th>Immobilisation cumulée</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.v.code}>
                  <td style={{ fontWeight: 600 }}>{r.v.code}</td>
                  <td>{r.v.brand} {r.v.model}</td>
                  <td style={{ fontWeight: 700, color: r.immoYear ? 'var(--a6)' : undefined }}>{r.immoYear} j</td>
                  <td style={{ fontWeight: 700, color: r.immoCumul ? 'var(--a6)' : undefined }}>{r.immoCumul} j</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{ background: 'var(--b0)', fontWeight: 700 }}>
              <td colSpan={2}>TOTAL</td>
              <td>{rows.reduce((s, r) => s + r.immoYear, 0)} j</td>
              <td>{rows.reduce((s, r) => s + r.immoCumul, 0)} j</td>
            </tr></tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function ContractModal({ contract, vehicles, nextId, onClose, onCreate, onUpdate }: {
  contract: LeaseContract | null; vehicles: Vehicle[]; nextId: string;
  onClose: () => void; onCreate: (b: Partial<LeaseContract>) => Promise<void>; onUpdate: (id: string, b: Partial<LeaseContract>) => Promise<void>;
}) {
  const isEdit = !!contract;
  const [f, setF] = useState<Partial<LeaseContract>>(contract ?? {
    vehicleCode: vehicles.find((v) => v.ownership === 'LOCATION')?.code ?? vehicles[0]?.code,
    num: `CTR-${new Date().getFullYear()}-${nextId.slice(3)}`, startDate: new Date().toISOString().slice(0, 10),
  });
  const set = (k: keyof LeaseContract) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const submit = async () => {
    if (!f.vehicleCode || !f.num || !f.dailyPrice || !f.startDate || !f.endDate) { toast.error('Remplir tous les champs obligatoires'); return; }
    if ((f.endDate ?? '') <= (f.startDate ?? '')) { toast.error('La date fin doit être après la date début'); return; }
    const body = {
      ...f,
      dailyPrice: Number(f.dailyPrice),
      immobilizationPrice: f.immobilizationPrice != null && f.immobilizationPrice !== ('' as unknown)
        ? Number(f.immobilizationPrice)
        : Math.round(Number(f.dailyPrice) * 0.5),
    };
    if (isEdit) await onUpdate(contract!.id, body);
    else await onCreate({ ...body, id: nextId });
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={isEdit ? `Modifier Contrat ${contract!.num}` : 'Nouveau Contrat de Location'}
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button><button className="btn btn-p" onClick={submit}>Enregistrer</button></>}>
      <div className="form-r">
        <div className="form-g"><label>Véhicule</label><select value={f.vehicleCode ?? ''} onChange={set('vehicleCode')} disabled={isEdit}>{vehicles.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model} ({v.type})</option>)}</select></div>
        <div className="form-g"><label>N° Contrat</label><input value={f.num ?? ''} onChange={set('num')} /></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Prix Quotidien (DA)</label><input type="number" value={f.dailyPrice ?? ''} onChange={set('dailyPrice')} /></div>
        <div className="form-g"><label>Prix Immobilisation (DA) <span style={{ color: 'var(--tm)', fontWeight: 400 }}>— ~50 % du prix/jour, libre</span></label><input type="number" value={f.immobilizationPrice ?? ''} onChange={set('immobilizationPrice')} placeholder={f.dailyPrice ? String(Math.round(Number(f.dailyPrice) * 0.5)) : ''} /></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Notes</label><input value={f.notes ?? ''} onChange={set('notes')} /></div>
      </div>
      <div className="form-r">
        <div className="form-g"><label>Date Début</label><DateInput value={f.startDate ?? ''} onChange={set('startDate')} /></div>
        <div className="form-g"><label>Date Fin</label><DateInput value={f.endDate ?? ''} onChange={set('endDate')} /></div>
      </div>
    </Modal>
  );
}
