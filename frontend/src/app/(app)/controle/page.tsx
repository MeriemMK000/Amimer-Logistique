'use client';

import { useMemo, useState } from 'react';
import { useDrivers, useFuelControlMonth, useFuelEntries, useKmBreakdown, useMaintenanceDue, useMissions, useVehicles } from '@/lib/api/hooks';
import StatusBadge from '@/components/ui/StatusBadge';
import LineChart from '@/components/charts/LineChart';
import PeriodPicker from '@/components/ui/PeriodPicker';
import { usePeriod } from '@/lib/period';
import { fd, fk } from '@/lib/fleet/format';
import { printReport } from '@/lib/export';

const analyzeColor = (ec: number) => (ec > 15 ? 'var(--r6)' : ec > 5 ? 'var(--a6)' : ec < -15 ? 'var(--a6)' : 'var(--g6)');
// Verdict aligné sur le module Carburant (mêmes seuils, mêmes libellés).
const V_MAP: Record<string, { t: string; c: string; i: string; m: string }> = {
  anomalie: { t: 'ANOMALIE', c: 'bad', i: '', m: 'Écart significatif entre la consommation réelle (corrigée du réservoir) et la norme constructeur, ou km au compteur incohérents.' },
  surveiller: { t: 'À SURVEILLER', c: 'warn', i: '', m: 'Écart modéré, ou km roulés au-delà des missions enregistrées.' },
  incomplet: { t: 'INCOMPLET', c: 'warn', i: '•', m: 'Relevé km / heures / réservoir manquant — contrôle impossible ce mois.' },
  conforme: { t: 'CONFORME', c: 'ok', i: '✓', m: 'Consommation dans les normes constructeur.' },
};
function verdict(ec: number) {
  if (ec > 15 || ec < -15) return V_MAP.anomalie;
  if (ec > 5) return V_MAP.surveiller;
  return V_MAP.conforme;
}
function verdictFor(row: { verdict?: string } | undefined, ec: number) {
  return (row?.verdict && V_MAP[row.verdict]) || verdict(ec);
}

export default function ControlePage() {
  const [mode, setMode] = useState<'vh' | 'dr'>('vh');
  const [vhCode, setVhCode] = useState('');
  const [drCode, setDrCode] = useState('');
  const period = usePeriod();

  const vehicles = useVehicles();
  const drivers = useDrivers();
  const missions = useMissions();
  const fuel = useFuelEntries();

  const V = vehicles.data ?? [];
  const D = drivers.data ?? [];
  // Filtre période : mission = date de départ, plein = date du plein.
  const MI = (missions.data ?? []).filter((m) => period.mode === 'cumul' || period.matches(m.dateStart) || period.matches(m.dateEnd));
  const FU = (fuel.data ?? []).filter((f) => period.mode === 'cumul' || period.matches(f.date));
  const eligibleV = V.filter((v) => (v.normOff ?? 0) > 0 && v.fuel !== '—');
  const vhLabel = (c: string | null) => { const v = V.find((x) => x.code === c); return v ? `${v.code} — ${v.brand} ${v.model}` : c ?? '—'; };
  const drName = (c: string | null) => D.find((d) => d.code === c)?.name ?? c ?? '—';

  const selVh = vhCode || eligibleV[0]?.code || '';
  const selDr = drCode || D[0]?.code || '';
  const kmBd = useKmBreakdown(mode === 'vh' ? selVh : null);

  /** Jours ouvrés (lun-jeu, sam) de la période retenue — pour la distance non productive. */
  const periodWorkingDays = useMemo(() => {
    if (period.mode === 'cumul') return kmBd.data?.homeWorkingDays ?? 22;
    const [y, m] = period.month.split('-').map(Number);
    let n = 0;
    for (let d = 1; d <= new Date(y, m, 0).getDate(); d++) {
      const dow = new Date(y, m - 1, d).getDay();
      if (dow !== 5 && dow !== 6) n++;
    }
    return n;
  }, [period.mode, period.month, kmBd.data]);
  const homePerDay = kmBd.data?.homePerDay ?? 0;
  const nonProductiveKm = homePerDay * periodWorkingDays;

  // Contrôle carburant du mois (backend fuel-control) — MÊMES calculs que le module Carburant.
  const fcMonth = useFuelControlMonth(period.mode === 'cumul' ? '' : period.month);
  const monthRow = (fcMonth.data ?? []).find((r: any) => r.vehicleCode === selVh) as any | undefined;
  // Échéances d'entretien du véhicule (retour DG : les relevés km alimentent la maintenance).
  const due = useMaintenanceDue();
  const vhDue = (due.data ?? []).filter((x: any) => x.vehicleCode === selVh).sort((a: any, b: any) => a.remaining - b.remaining);

  const result = useMemo(() => {
    if (mode === 'vh') {
      const v = V.find((x) => x.code === selVh);
      if (!v) return null;
      const isEngin = (v.type ?? '').toUpperCase() === 'ENGIN';
      const vhMi = MI.filter((m) => m.vehicleCode === selVh && ['TERMINEE', 'CLOTUREE', 'EN_COURS'].includes(m.status));
      const vhFu = FU.filter((f) => f.vehicleCode === selVh);
      const kmMissions = vhMi.reduce((s, m) => s + (m.distance ?? 0), 0);
      // coût carburant : montant du plein si connu, sinon qty × prix unitaire.
      const cost = vhFu.reduce((s, f) => s + (f.amount ?? f.qty * (f.unitPrice ?? 0)), 0);
      const fuRows = vhFu.map((f) => {
        const km = (f.kmEnd && f.kmStart && f.kmEnd - f.kmStart > 0) ? f.kmEnd - f.kmStart : 0;
        const c = km > 0 ? (f.qty / km) * 100 : 0;
        return { f, km, c, ec: NaN, who: drName(f.driverCode) };
      });

      // ── MÊMES CALCULS QUE LE MODULE CARBURANT (backend fuel-control) quand le mois est connu ──
      if (monthRow && period.mode !== 'cumul') {
        const base = isEngin ? (monthRow.hoursFait ?? 0) : (monthRow.kmFait ?? 0);
        const kmTheo = isEngin ? (monthRow.litresTheoriques ?? 0) : (monthRow.kmTheorique ?? 0);
        return {
          title: vhLabel(selVh), sub: `${v.brand} ${v.model}`,
          fromCarburant: true, isEngin, category: monthRow.category as string,
          controlMethod: monthRow.controlMethod as string,
          totalKm: base, kmSource: isEngin ? 'heures de pointage' : (monthRow.reading?.kmStart != null ? 'relevé mensuel (km début → fin)' : 'km des missions'),
          kmMissions, kmNonJustifie: monthRow.kmNonJustifie ?? null,
          reading: monthRow.reading ?? null, tankDeclared: !!monthRow.tankDeclared,
          tankStart: monthRow.tankStart ?? null, tankEnd: monthRow.tankEnd ?? null, deltaTank: monthRow.deltaTank ?? 0,
          litresAchetes: monthRow.litresAchetes ?? 0, litresNets: monthRow.litresNets ?? 0,
          litresBySource: monthRow.litresBySource ?? {},
          totalL: monthRow.litresNets ?? 0,
          conso: monthRow.consoReelle ?? 0, norm: monthRow.norme ?? (v.normCorr ?? 0),
          ecart: monthRow.ecartPct ?? 0, ecartLitres: monthRow.ecartLitres ?? null,
          kmTheorique: kmTheo, litresTheoriques: monthRow.litresTheoriques ?? null,
          verdictKey: monthRow.verdict as string, flags: (monthRow.flags ?? []) as string[],
          cost: monthRow.montant ?? cost, perKm: base > 0 ? (monthRow.montant ?? cost) / base : 0,
          nbMi: vhMi.length, nbFu: vhFu.length, miRows: vhMi, fuRows,
        };
      }
      // ── Repli (cumul / mois sans relevé) : estimation simple sur les données locales ──
      const totalKm = kmMissions;
      const totalL = vhFu.reduce((s, f) => s + f.qty, 0);
      const norm = v.normCorr ?? 0;
      const conso = totalKm > 0 ? (totalL / totalKm) * 100 : 0;
      const ecart = norm > 0 ? ((conso - norm) / norm) * 100 : 0;
      return {
        title: vhLabel(selVh), sub: `${v.brand} ${v.model}`, fromCarburant: false, isEngin,
        totalKm, kmSource: 'missions (estimation)', kmMissions, totalL, conso, norm, ecart,
        cost, perKm: totalKm > 0 ? cost / totalKm : 0, nbMi: vhMi.length, nbFu: vhFu.length, miRows: vhMi, fuRows,
      };
    }
    const d = D.find((x) => x.code === selDr);
    if (!d) return null;
    const drMi = MI.filter((m) => m.driverCode === selDr && ['TERMINEE', 'CLOTUREE', 'EN_COURS'].includes(m.status));
    const drFu = FU.filter((f) => f.driverCode === selDr);
    const totalKm = drMi.reduce((s, m) => s + (m.distance ?? 0), 0);
    const totalL = drFu.reduce((s, f) => s + f.qty, 0);
    const vhUsed = [...new Set(drMi.map((m) => m.vehicleCode))];
    const avgNorm = vhUsed.length ? vhUsed.reduce((s, vc) => s + (V.find((x) => x.code === vc)?.normCorr ?? 0), 0) / vhUsed.length : 0;
    const conso = totalKm > 0 ? (totalL / totalKm) * 100 : 0;
    const ecart = avgNorm > 0 ? ((conso - avgNorm) / avgNorm) * 100 : 0;
    const cost = drFu.reduce((s, f) => s + f.qty * f.unitPrice, 0);
    const perFuKm = totalKm > 0 && drFu.length ? totalKm / drFu.length : 0;
    const fuRows = drFu.map((f) => {
      const nc = V.find((x) => x.code === f.vehicleCode)?.normCorr ?? 0;
      const c = perFuKm > 0 ? (f.qty / perFuKm) * 100 : 0;
      const ec = perFuKm > 0 && nc > 0 ? ((c - nc) / nc) * 100 : NaN;
      return { f, km: perFuKm, c, ec, who: vhLabel(f.vehicleCode) };
    });
    return { title: `${d.name} (${d.license})`, sub: `${vhUsed.length} véhicule(s) conduit(s)`, totalKm, kmSource: 'missions', kmMissions: totalKm, totalL, conso, norm: avgNorm, ecart, cost, perKm: totalKm > 0 ? cost / totalKm : 0, nbMi: drMi.length, nbFu: drFu.length, miRows: drMi, fuRows };
  }, [mode, selVh, selDr, V, D, MI, FU, monthRow, period.mode]);

  const R = result as any;
  const useHrs: boolean = !result ? false : R.fromCarburant ? R.controlMethod === 'hours' : !!(R as { isEngin?: boolean }).isEngin;
  const v = result ? (mode === 'vh' ? verdictFor({ verdict: R.verdictKey }, R.ecart) : verdict(R.ecart)) : null;
  const SRC_LBL: Record<string, string> = { carte: 'Carte', regie: 'Régie', pompe_externe: 'Pompe', manuel: 'Manuel', stock_site: 'Stock site', dotation_site: 'Dotation site', engin_dedie: 'Plein engin' };

  return (
    <div className="page active">
      <div className="ctrl-header">
        <div className="btn-group" style={{ marginRight: 8 }}>
          <button className={`btn btn-sm ${mode === 'vh' ? 'btn-p' : 'btn-o'}`} onClick={() => setMode('vh')}>Véhicule</button>
          <button className={`btn btn-sm ${mode === 'dr' ? 'btn-p' : 'btn-o'}`} onClick={() => setMode('dr')}>Chauffeur</button>
        </div>
        {mode === 'vh' ? (
          <div className="form-g" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Véhicule</label>
            <select value={selVh} onChange={(e) => setVhCode(e.target.value)}>{eligibleV.map((x) => <option key={x.code} value={x.code}>{x.code} — {x.brand} {x.model}</option>)}</select>
          </div>
        ) : (
          <div className="form-g" style={{ marginBottom: 0, minWidth: 220 }}>
            <label>Chauffeur</label>
            <select value={selDr} onChange={(e) => setDrCode(e.target.value)}>{D.map((x) => <option key={x.code} value={x.code}>{x.name} ({x.license})</option>)}</select>
          </div>
        )}
        <div className="period-bar" style={{ border: 'none', padding: 0, margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <label>Période :</label>
          <PeriodPicker period={period} />
        </div>
        {result && v && (
          <button className="btn btn-o btn-sm" onClick={() => printReport(
            `Contrôle ${mode === 'vh' ? 'véhicule' : 'chauffeur'} — ${R.title}`,
            `${period.label} · verdict : ${v.t}`,
            [
              {
                heading: 'Synthèse',
                columns: ['Indicateur', 'Valeur'],
                rows: [
                  [mode === 'vh' ? `Km de la période (${R.kmSource})` : 'Km parcourus', `${fk(R.totalKm)} km`],
                  ['Litres consommés', `${R.totalL.toFixed(0)} L`],
                  ['Consommation réelle', `${R.conso.toFixed(1)} L/100 (norme ${R.norm.toFixed(1)})`],
                  ['Écart norme', `${R.ecart > 0 ? '+' : ''}${R.ecart.toFixed(1)} %`],
                  ['Coût carburant', `${fk(Math.round(R.cost))} DA`],
                  ...(mode === 'vh' && homePerDay > 0 ? [['Distance non productive (domicile)', `${fk(Math.round(nonProductiveKm))} km (${homePerDay} km/j × ${periodWorkingDays} j)`] as [string, string]] : []),
                ],
              },
              {
                heading: 'Missions de la période',
                columns: ['Mission', 'Trajet', 'Dates', 'Distance', mode === 'vh' ? 'Chauffeur' : 'Véhicule', 'Statut'],
                rows: R.miRows.map((m: any) => [m.num, `${m.fromLoc} → ${m.toLoc}`, `${m.dateStart} → ${m.dateEnd}`, `${fk(m.distance)} km`, mode === 'vh' ? drName(m.driverCode) : vhLabel(m.vehicleCode), m.status]),
              },
            ],
          )}>Imprimer l&apos;état</button>
        )}
      </div>

      {result && v && (
        <>
          {mode === 'vh' && R.fromCarburant && (
            <div style={{ fontSize: '.72rem', color: 'var(--tm)', background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '6px 10px', marginBottom: 10 }}>
              Chiffres <b>identiques au module Carburant</b> (contrôle {({ hours: 'par heures de fonctionnement', km_difference: 'par différence de kilométrage (relevé début → fin)', mission: 'par km réels des missions' } as Record<string, string>)[R.controlMethod] ?? R.controlMethod}) · {period.label}.
            </div>
          )}
          <div className="ctrl-grid">
            <Card label={useHrs ? 'Heures de la période' : 'Km de la période'} val={fk(R.totalKm)}
              sub={mode === 'vh' ? `réf. ${R.kmSource}${R.kmMissions && !useHrs ? ` · ${fk(R.kmMissions)} km missions` : ''}` : `${R.nbMi} mission(s)`} />
            {mode === 'vh' && !useHrs && homePerDay > 0 && (
              <Card label="Distance non productive" val={`${fk(Math.round(nonProductiveKm))} km`}
                sub={`${homePerDay} km/j domicile × ${periodWorkingDays} j ouvrés (${period.label})`} />
            )}
            <Card label={mode === 'vh' && R.fromCarburant ? 'Conso nette (corrigée réservoir)' : 'Litres Consommés'} val={`${R.totalL.toFixed(0)} L`}
              sub={mode === 'vh' && R.fromCarburant && R.tankDeclared ? `achats ${fk(R.litresAchetes)} L − réservoir Δ ${R.deltaTank > 0 ? '+' : ''}${fk(R.deltaTank)} L` : `${R.nbFu} plein(s)`} />
            <Card label="Conso Réelle" val={`${R.fromCarburant ? R.conso : R.conso.toFixed(1)} ${useHrs ? 'L/h' : 'L/100'}`} sub={`Norme: ${R.norm}`} color={analyzeColor(R.ecart)} />
            <Card label="Écart Norme" val={`${R.ecart > 0 ? '+' : ''}${R.ecart.toFixed(0)}%`} sub={R.ecartLitres != null ? `${R.ecartLitres > 0 ? '+' : ''}${fk(Math.round(R.ecartLitres))} L vs théorique` : 'vs norme corrigée'} color={analyzeColor(R.ecart)} />
            <Card label="Coût Carburant" val={`${fk(Math.round(R.cost))} DA`} sub={`${R.perKm.toFixed(1)} DA/${useHrs ? 'h' : 'km'}`} />
            <div className={`ctrl-card ${v.c}`}><div className="ctrl-card-label">Verdict</div><div className="ctrl-card-val">{v.i ? v.i + ' ' : ''}{v.t}</div><div style={{ fontSize: '.68rem' }}>{R.sub}</div></div>
          </div>
          <div className={`ctrl-verdict ${v.c}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{v.i && <span style={{ fontSize: '1.4rem' }}>{v.i}</span>}<div><strong>{v.t}</strong> — {v.m}</div></div>
          </div>

          {mode === 'vh' && R.fromCarburant && (
            <div className="cc" style={{ marginBottom: 14 }}>
              <h3>Bilan carburant du véhicule — {period.label}</h3>
              <div className="tw"><table><tbody>
                {!useHrs && (
                  <tr><td style={{ color: 'var(--tm)' }}>Relevé kilométrique</td><td style={{ fontWeight: 600 }}>
                    {R.reading?.kmStart != null && R.reading?.kmEnd != null
                      ? <>{fk(R.reading.kmStart)} → {fk(R.reading.kmEnd)} km <span style={{ color: 'var(--tm)', fontWeight: 400 }}>· km fait {fk(R.totalKm)}</span></>
                      : <span style={{ color: 'var(--a6)' }}>relevé début / fin de mois manquant</span>}
                  </td></tr>
                )}
                {!useHrs && R.kmMissions != null && (
                  <tr><td style={{ color: 'var(--tm)' }}>Km justifiés par des missions</td><td>{fk(R.kmMissions)} km
                    {R.kmNonJustifie ? <span style={{ color: 'var(--a6)' }}> · {fk(R.kmNonJustifie)} km hors missions</span> : null}</td></tr>
                )}
                {useHrs && (
                  <tr><td style={{ color: 'var(--tm)' }}>Relevé compteur horaire</td><td style={{ fontWeight: 600 }}>
                    {R.reading?.hoursStart != null && R.reading?.hoursEnd != null ? `${fk(R.reading.hoursStart)} → ${fk(R.reading.hoursEnd)} h` : <span style={{ color: 'var(--a6)' }}>relevé manquant</span>}
                    <span style={{ color: 'var(--tm)', fontWeight: 400 }}> · {fk(R.totalKm)} h faites</span></td></tr>
                )}
                <tr><td style={{ color: 'var(--tm)' }}>Réservoir (début → fin de mois)</td><td>
                  {R.tankDeclared ? <>{fk(R.tankStart)} → {fk(R.tankEnd)} L · Δ {R.deltaTank > 0 ? '+' : ''}{fk(R.deltaTank)} L</> : <span style={{ color: 'var(--a6)' }}>non déclaré</span>}</td></tr>
                <tr><td style={{ color: 'var(--tm)' }}>Carburant acheté (tous canaux)</td><td style={{ fontWeight: 600 }}>{fk(R.litresAchetes)} L
                  <span style={{ color: 'var(--tm)', fontWeight: 400, fontSize: '.9em' }}> — {Object.entries(R.litresBySource ?? {}).filter(([, l]) => (l as number) > 0).map(([s, l]) => `${SRC_LBL[s] ?? s} ${fk(l as number)}`).join(' · ') || '—'}</span></td></tr>
                <tr><td style={{ color: 'var(--tm)' }}>Consommation réelle (nette)</td><td style={{ fontWeight: 700 }}>{fk(R.litresNets)} L</td></tr>
                <tr><td style={{ color: 'var(--tm)' }}>{useHrs ? 'Consommation théorique' : 'Km théorique (ce que le carburant paie)'}</td><td>
                  {useHrs ? `${fk(R.litresTheoriques ?? 0)} L` : `${fk(R.kmTheorique ?? 0)} km`}</td></tr>
                {(R.flags ?? []).length > 0 && (
                  <tr><td style={{ color: 'var(--tm)' }}>Alertes</td><td style={{ color: 'var(--a6)' }}>{(R.flags as string[]).join(' · ')}</td></tr>
                )}
                <tr><td style={{ color: 'var(--tm)' }}>Prochaine échéance d&apos;entretien</td><td>
                  {vhDue.length ? (() => {
                    const n = vhDue[0];
                    const unit = n.trigger === 'HOURS' ? 'h' : 'km';
                    return <span style={{ fontWeight: 600, color: n.overdue ? 'var(--r6)' : n.alert ? 'var(--a6)' : 'var(--tp)' }}>
                      {n.planName} — {n.overdue ? `en retard de ${fk(-n.remaining)} ${unit}` : `dans ${fk(n.remaining)} ${unit}`}
                      <span style={{ color: 'var(--tm)', fontWeight: 400 }}> (compteur {fk(n.current)} {unit} → échéance {fk(n.nextDue)} {unit})</span>
                    </span>;
                  })() : <span style={{ color: 'var(--tm)' }}>aucun modèle d&apos;entretien rattaché</span>}
                  <div style={{ fontSize: '.62rem', color: 'var(--tm)' }}>Basé sur le compteur alimenté par les relevés de clôture mensuels.</div>
                </td></tr>
              </tbody></table></div>
            </div>
          )}

          <div className="cr">
            <div className="cc">
              <h3>{mode === 'vh' ? 'Missions du Véhicule' : 'Missions du Chauffeur'}</h3>
              <div className="tw">
                <table>
                  <thead><tr><th>Mission</th><th>Trajet</th><th>Distance</th><th>{mode === 'vh' ? 'Chauffeur' : 'Véhicule'}</th><th>Statut</th></tr></thead>
                  <tbody>
                    {R.miRows.map((m: any) => (
                      <tr key={m.num}>
                        <td>{m.num}<div style={{ fontSize: '.6rem', color: 'var(--tm)', fontWeight: 400 }}>{fd(m.dateStart)} → {fd(m.dateEnd)}</div></td>
                        <td title={`${m.fromLoc} → ${m.toLoc}`}>{m.fromLoc} → {m.toLoc}</td>
                        <td style={{ fontWeight: 600 }}>{fk(m.distance)} km</td>
                        <td>{mode === 'vh' ? drName(m.driverCode) : vhLabel(m.vehicleCode)}</td>
                        <td><StatusBadge status={m.status} /></td>
                      </tr>
                    ))}
                    {!R.miRows.length && <tr><td colSpan={5} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucune mission</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="cc">
              <h3>Pleins Enregistrés</h3>
              <div className="tw">
                <table>
                  <thead><tr><th>Date</th><th>Qté (L)</th><th>Total</th><th>{mode === 'vh' ? 'Chauffeur' : 'Véhicule'}</th><th>Conso</th><th>Écart</th></tr></thead>
                  <tbody>
                    {R.fuRows.map(({ f, c, ec, who }: any) => (
                      <tr key={f.id}>
                        <td>{fd(f.date)}</td>
                        <td>{f.qty} L</td>
                        <td style={{ fontWeight: 500 }}>{fk(Math.round(f.amount ?? f.qty * (f.unitPrice ?? 0)))} DA</td>
                        <td>{who}</td>
                        <td style={{ fontWeight: 600 }}>{c > 0 ? c.toFixed(1) : '-'}</td>
                        <td style={isNaN(ec) ? undefined : { color: analyzeColor(ec), fontWeight: ec > 15 ? 600 : 400 }}>{isNaN(ec) ? '-' : `${ec > 0 ? '+' : ''}${ec.toFixed(0)}%`}</td>
                      </tr>
                    ))}
                    {!R.fuRows.length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun plein</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {R.fuRows.length >= 2 && (
            <div className="cr">
              <div className="cc">
                <h3>Évolution Consommation</h3><div className="sub">Historique des pleins vs norme constructeur</div>
                <LineChart
                  labels={R.fuRows.map((_: any, i: number) => `P${i + 1}`)}
                  values={R.fuRows.map((r: any) => +r.c.toFixed(1))}
                  norm={R.fuRows.map(() => R.norm)}
                />
                <div className="lg">
                  <div className="li"><span className="ld" style={{ background: 'var(--c1)' }} />Conso Réelle</div>
                  <div className="li"><span className="ld" style={{ background: 'var(--c3)' }} />Norme Corrigée</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Card({ label, val, sub, color }: { label: string; val: string; sub: string; color?: string }) {
  return (
    <div className="ctrl-card">
      <div className="ctrl-card-label">{label}</div>
      <div className="ctrl-card-val" style={color ? { color } : undefined}>{val}</div>
      <div style={{ fontSize: '.68rem', color: 'var(--tm)' }}>{sub}</div>
    </div>
  );
}
