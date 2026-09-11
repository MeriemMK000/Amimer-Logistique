'use client';

import { icons } from '@/components/ui/icons';
import { Fragment, useMemo, useState } from 'react';
import {
  useBusinessUnits, useConfig, useDrivers, useEngineFuelEntries, useFuelCardMovements, useFuelEntries,
  useFuelStockOps, useLeaseContracts, useMissions, useSaveConfig, useSitePointage, useUpdate,
  useVehicleAssignments, useVehicles,
} from '@/lib/api/hooks';
import { useBuCcLabel } from '@/components/ui/BuCcSelect';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import SearchBox from '@/components/ui/SearchBox';
import { useSearch } from '@/lib/useSearch';
import BarChart from '@/components/charts/BarChart';
import toast from 'react-hot-toast';
import { fk } from '@/lib/fleet/format';
import { printReport } from '@/lib/export';
import { calcMissionCoutInterne, missionBuShares, type MargeMode } from '@/lib/fleet/factbu';
import { vehicleCostModel } from '@/lib/fleet/vehicleCost';
import PeriodPicker from '@/components/ui/PeriodPicker';
import { usePeriod } from '@/lib/period';
import type { BaremeMission } from '@/lib/fleet/bareme';
import type { MargeType, Mission, Vehicle } from '@/lib/types';

const VH_TYPES: Vehicle['type'][] = ['LEGER', 'LOURD', 'ENGIN', 'REMORQUE'];
const TYPE_LABEL: Record<string, string> = { LEGER: 'Léger', LOURD: 'Lourd', ENGIN: 'Engin', REMORQUE: 'Remorque' };

export default function FacturationBuPage() {
  const [tab, setTab] = useState(0);
  const period = usePeriod();
  const [margeMode, setMargeMode] = useState<MargeMode>('global');
  const [margeCfgOpen, setMargeCfgOpen] = useState(false);
  const [siteFilter, setSiteFilter] = useState('');

  const missions = useMissions();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const fuel = useFuelEntries();
  const eng = useEngineFuelEntries();
  const bus = useBusinessUnits();
  const assignments = useVehicleAssignments();
  const fuelStockOps = useFuelStockOps();
  const leaseContracts = useLeaseContracts();
  const cardMoves = useFuelCardMovements();
  const buCcLabel = useBuCcLabel();
  const sitePointage = useSitePointage();
  const bareme = useConfig<BaremeMission>('BAREME_MISSION');
  const paramsCfg = useConfig<import('@/lib/types').Params>('PARAMS');
  const fuelPrices = useConfig<{ GASOIL?: number }>('FUEL_PRICES');
  const margePctCfg = useConfig<number>('MARGE_PCT');
  const margeTypeCfg = useConfig<MargeType>('MARGE_TYPE');
  const saveMargePct = useSaveConfig('MARGE_PCT');
  const saveMargeType = useSaveConfig('MARGE_TYPE');
  const updateVehicle = useUpdate<Vehicle>('vehicles');

  const MI = missions.data ?? [];
  const V = vehicles.data ?? [];
  const D = drivers.data ?? [];
  const B = bareme.data;
  const CT = leaseContracts.data ?? [];
  const joursOuvres = paramsCfg.data?.joursOuvresMois ?? 22;
  const margePct = margePctCfg.data ?? 12;
  const margeType = margeTypeCfg.data ?? {};

  const siteOptions = useMemo(
    () => [...new Set(MI.map((m) => m.site).filter(Boolean) as string[])].sort(),
    [MI],
  );

  const factMissions = useMemo(() => {
    return MI.filter((m) => {
      if (!m.bu || m.status === 'ANNULEE') return false;
      if (siteFilter && (m.site ?? '') !== siteFilter) return false;
      return period.matches(m.dateStart);
    });
  }, [MI, period, siteFilter]);

  const calcs = useMemo(() => {
    if (!B) return [];
    return factMissions.map((m) => ({ m, c: calcMissionCoutInterne(m, V, D, fuel.data ?? [], eng.data ?? [], B, margeMode, margePct, margeType, CT, joursOuvres) }));
  }, [factMissions, V, D, fuel.data, eng.data, B, margeMode, margePct, margeType, CT, joursOuvres]);

  const tot = calcs.reduce((a, r) => ({
    h: a.h + r.c.hours, couts: a.couts + r.c.totalCouts, cession: a.cession + r.c.prixCession,
    vh: a.vh + r.c.coutVh, fuel: a.fuel + r.c.fuelCost, dr: a.dr + r.c.coutDr, frais: a.frais + r.c.fraisMission,
  }), { h: 0, couts: 0, cession: 0, vh: 0, fuel: 0, dr: 0, frais: 0 });
  // Un libellé de BU peut arriver sous forme de code (« LOG ») ou de nom (« Logistique »,
  // saisi dans une demande de prise en charge) : on ramène tout au code du référentiel.
  const canonBu = useMemo(() => {
    const list = bus.data ?? [];
    return (raw: string | null | undefined): string => {
      const s = (raw ?? '').trim();
      if (!s) return '—';
      const hit = list.find((b) => b.code === s || b.name.toLowerCase() === s.toLowerCase());
      return hit?.code ?? s;
    };
  }, [bus.data]);
  const nbBU = new Set(factMissions.map((m) => canonBu(m.bu)).filter((x) => x !== '—')).size;

  // synthèse par BU + centre de coût (retour DG : « en bas de la BU le centre de coût »).
  const byBU = useMemo(() => {
    type Agg = { nbMi: number; km: number; couts: number; cession: number };
    const blank = (): Agg => ({ nbMi: 0, km: 0, couts: 0, cession: 0 });
    const map: Record<string, Agg & { bu: string; ca: Record<string, Agg> }> = {};
    calcs.forEach(({ m, c }) => {
      const shares = missionBuShares(m, c);
      shares.forEach((sh) => {
        const key = canonBu(sh.bu);
        const e = (map[key] ??= { bu: key, ca: {}, ...blank() });
        const caKey = (m.ca ?? '').trim() || '(sans centre de coût)';
        const ca = (e.ca[caKey] ??= blank());
        const w = shares.length > 1 ? sh.pct / 100 : 1;
        for (const t of [e, ca]) {
          t.nbMi += w;
          t.km += (m.distance ?? 0) * (shares.length > 1 ? sh.pct / 100 : 1);
          t.couts += sh.totalCouts;
          t.cession += sh.prixCession;
        }
      });
    });
    return Object.values(map)
      .map((e) => ({
        ...e, nbMi: Math.round(e.nbMi * 10) / 10, km: Math.round(e.km),
        caRows: Object.entries(e.ca)
          .map(([code, a]) => ({ code, ...a, nbMi: Math.round(a.nbMi * 10) / 10, km: Math.round(a.km) }))
          .sort((a, b) => b.cession - a.cession),
      }))
      .sort((a, b) => b.cession - a.cession);
  }, [calcs, canonBu]);

  const buName = (code: string) => bus.data?.find((b) => b.code === code)?.name ?? code;
  const caName = (buCode: string, caCode: string) => bus.data?.find((b) => b.code === buCode)?.ca?.find((c) => c.code === caCode)?.nom ?? '';
  const cessSearch = useSearch(calcs, ({ m, c }) => [m.num, m.site, c.buCode, c.caCode, c.vhLabel, c.drLabel].join(' '));

  // Pointage engin/site sur la période (fraction de journée × prix jour + carburant estimé).
  const sitePtRows = useMemo(
    () => (sitePointage.data ?? []).filter((p: { date?: string; siteCode?: string }) => {
      if (siteFilter && (p.siteCode ?? '') !== siteFilter) return false;
      return period.mode === 'cumul' || period.matches(p.date);
    }),
    [sitePointage.data, period, siteFilter],
  );
  const GASOIL = (fuelPrices.data as { GASOIL?: number } | undefined)?.GASOIL ?? 45;
  const enginCost = (p: { immobilized?: boolean; fraction?: number | null; dayPrice?: number | null; fuelLiters?: number | null }) => {
    const loc = p.immobilized ? Math.round((p.dayPrice ?? 0) * 0.5) : (p.fraction ?? 0) * (p.dayPrice ?? 0);
    return { loc, fuel: (p.fuelLiters ?? 0) * GASOIL };
  };

  // Retour DG « logique affectation site » : véhicules AFFECTÉS au site actifs sur la période.
  const siteAssignRows = useMemo(
    () => (assignments.data ?? []).filter((a) => {
      if (!a.siteCode) return false;
      if (siteFilter && a.siteCode !== siteFilter) return false;
      if (period.mode === 'cumul') return true;
      const start = (a.dateStart ?? '0000-00').slice(0, 7);
      const end = (a.dateEnd ?? '9999-99').slice(0, 7);
      return start <= period.month && end >= period.month;
    }),
    [assignments.data, period, siteFilter],
  );
  // Sorties de cuve chantier constatées sur la période (carburant réellement servi au site).
  const cuveSortieBySite = useMemo(() => {
    const m: Record<string, number> = {};
    ((fuelStockOps.data ?? []) as { opType?: string; siteCode?: string; date?: string; liters?: number | null; unitPrice?: number | null }[])
      .filter((o) => o.opType === 'sortie' && o.siteCode)
      .filter((o) => (siteFilter ? o.siteCode === siteFilter : true))
      .filter((o) => period.mode === 'cumul' || period.matches(o.date))
      .forEach((o) => { m[o.siteCode as string] = (m[o.siteCode as string] ?? 0) + (o.liters ?? 0) * (o.unitPrice ?? 0); });
    return m;
  }, [fuelStockOps.data, period, siteFilter]);

  // Synthèse par SITE (retour DG « à la fin on a l'ensemble de conso où il part ») :
  //   Total site = missions vers le site + location engins (pointage) + coût des véhicules
  //   affectés SANS pointage (sinon double compte) + carburant (dotation pointage + cuve chantier).
  const bySite = useMemo(() => {
    type Row = { site: string; bu: Set<string>; nbMi: number; missionCession: number; enginLoc: number; enginFuel: number;
      enginDays: number; immoDays: number; vehProps: number; vehLoues: number; vehCost: number; vehCostBillable: number;
      cuveFuel: number; pointed: Set<string> };
    const map: Record<string, Row> = {};
    const get = (s: string): Row => (map[s] ??= { site: s, bu: new Set(), nbMi: 0, missionCession: 0, enginLoc: 0, enginFuel: 0,
      enginDays: 0, immoDays: 0, vehProps: 0, vehLoues: 0, vehCost: 0, vehCostBillable: 0, cuveFuel: 0, pointed: new Set() });
    calcs.forEach(({ m, c }) => {
      if (!m.site) return;
      const e = get(m.site); e.nbMi++; e.missionCession += c.prixCession; if (m.bu) e.bu.add(m.bu);
    });
    // pointage AVANT les affectations → on sait quels véhicules sont déjà facturés au pointage
    sitePtRows.forEach((p: { siteCode?: string; targetCode?: string; businessUnit?: string; fraction?: number | null; immobilized?: boolean }) => {
      const e = get(p.siteCode || '—'); if (p.businessUnit) e.bu.add(p.businessUnit);
      if (p.targetCode) e.pointed.add(p.targetCode);
      const cost = enginCost(p);
      e.enginLoc += cost.loc; e.enginFuel += cost.fuel;
      if (p.immobilized) e.immoDays += 1; else e.enginDays += p.fraction ?? 0;
    });
    siteAssignRows.forEach((a) => {
      const e = get(a.siteCode as string); if (a.businessUnit) e.bu.add(a.businessUnit);
      const v = V.find((x) => x.code === a.vehicleCode);
      if (v?.ownership === 'LOCATION') e.vehLoues++; else e.vehProps++;
      // Coût mensuel : celui saisi sur l'affectation, sinon le modèle de coût du véhicule
      // (loué → contrat, propre → coût de possession).
      const ct = CT.find((c) => c.vehicleCode === a.vehicleCode) ?? null;
      const mc = a.vehicleMonthlyCost ?? vehicleCostModel(v, ct, joursOuvres).monthly;
      e.vehCost += mc;
      if (!a.vehicleCode || !e.pointed.has(a.vehicleCode)) e.vehCostBillable += mc; // pas de pointage → coût mensuel facturé
    });
    Object.entries(cuveSortieBySite).forEach(([s, val]) => { get(s).cuveFuel += val; });
    return Object.values(map)
      .map((e) => ({ ...e, buLabel: [...e.bu].join(', ') || '—',
        total: e.missionCession + e.enginLoc + e.enginFuel + e.vehCostBillable + e.cuveFuel }))
      .sort((a, b) => b.total - a.total);
  }, [calcs, sitePtRows, siteAssignRows, cuveSortieBySite, V, CT, joursOuvres]);

  // Voitures de service (retour DG) : coût véhicule + carburant de la période, refacturés à la
  // BU / au centre de coût saisis à l'affectation.
  const serviceCarRows = useMemo(() => {
    const active = (a: import('@/lib/types').VehicleAssignment) => {
      if (period.mode === 'cumul') return true;
      const start = (a.dateStart ?? '0000-00').slice(0, 7);
      const end = (a.dateEnd ?? '9999-99').slice(0, 7);
      return start <= period.month && end >= period.month;
    };
    return (assignments.data ?? [])
      .filter((a) => a.assigneeName && a.kind === 'permanent' && active(a))
      .map((a) => {
        const v = V.find((x) => x.code === a.vehicleCode);
        const fuelLedger = (fuel.data ?? [])
          .filter((f) => f.vehicleCode === a.vehicleCode && period.matches(f.date))
          .reduce((s, f) => s + (f.amount ?? (f.qty ?? 0) * (f.unitPrice ?? 0)), 0);
        const fuelCard = (cardMoves.data ?? [])
          .filter((m: { vehicleCode?: string; date?: string; amount?: number }) => m.vehicleCode === a.vehicleCode && period.matches(m.date))
          .reduce((s: number, m: { amount?: number }) => s + (m.amount ?? 0), 0);
        // Le mouvement de carte peut déjà être répliqué dans le journal des pleins : on prend le max, pas la somme.
        const fuelCost = Math.round(Math.max(fuelLedger, fuelCard));
        const ct = CT.find((c) => c.vehicleCode === a.vehicleCode) ?? null;
        const vehCost = Math.round(a.vehicleMonthlyCost ?? vehicleCostModel(v, ct, joursOuvres).monthly);
        return {
          a, bu: canonBu(a.businessUnit), cc: a.costCenter ?? null,
          label: v ? `${v.code} — ${v.brand} ${v.model}` : (a.vehicleCode ?? '—'),
          assignee: a.assigneeName ?? '—', structure: a.structure ?? '—',
          vehCost, fuelCost, total: vehCost + fuelCost,
        };
      })
      .sort((x, y) => y.total - x.total);
  }, [assignments.data, fuel.data, cardMoves.data, V, period, canonBu, CT, joursOuvres]);

  const serviceCarByBU = useMemo(() => {
    const map: Record<string, { bu: string; cars: number; vehCost: number; fuelCost: number; total: number }> = {};
    serviceCarRows.forEach((r) => {
      const e = (map[r.bu] ??= { bu: r.bu, cars: 0, vehCost: 0, fuelCost: 0, total: 0 });
      e.cars++; e.vehCost += r.vehCost; e.fuelCost += r.fuelCost; e.total += r.total;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [serviceCarRows]);
  const serviceCarTotal = serviceCarRows.reduce((s, r) => s + r.total, 0);

  return (
    <div className="page active">
      <div className="sg" style={{ marginBottom: 12 }}>
        <div className="sc"><div><div className="sv">{factMissions.length}</div><div className="sl">Missions</div></div><div className="si bl">{icons.truck}</div></div>
        <div className="sc"><div><div className="sv">{nbBU}</div><div className="sl">Business Units</div></div><div className="si tl">{icons.clock}</div></div>
        <div className="sc"><div><div className="sv">{fk(Math.round(tot.h))}h</div><div className="sl">Heures Totales</div></div><div className="si am">{icons.activity}</div></div>
        <div className="sc"><div><div className="sv">{fk(Math.round(tot.couts))}</div><div className="sl">Total Coûts (DA)</div></div><div className="si gn">{icons.check}</div></div>
        <div className="sc"><div><div className="sv">{fk(Math.round(tot.cession))}</div><div className="sl">Prix Cession (DA)</div></div><div className="si bl">{icons.truck}</div></div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <PeriodPicker period={period} />
        <label style={{ fontSize: '.8rem', color: 'var(--tm)' }}>Mode marge :</label>
        <select value={margeMode} onChange={(e) => setMargeMode(e.target.value as MargeMode)}>
          <option value="global">Marge globale ({margePct}%)</option>
          <option value="type">Marge par type</option>
          <option value="vehicule">Marge par véhicule</option>
        </select>
        <button className="btn btn-o btn-sm" onClick={() => setMargeCfgOpen(true)}>Configurer les marges</button>
        <label style={{ fontSize: '.8rem', color: 'var(--tm)' }}>Site :</label>
        <select value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)}>
          <option value="">Tous les sites</option>
          {siteOptions.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn btn-o btn-sm" onClick={() => printReport(
          'Facturation Business Unit',
          `${period.label}${siteFilter ? ` · site ${siteFilter}` : ''} · mode marge : ${margeMode}`,
          [
            {
              heading: 'Cession par mission',
              columns: ['Mission', 'BU / CA', 'Site', 'Véhicule', 'Chauffeur', 'Heures', 'Total Coûts (DA)', 'Marge', 'Prix Cession (DA)'],
              rows: calcs.map(({ m, c }) => [m.num, `${c.buCode}/${c.caCode || '—'}`, m.site ?? '—', c.vhLabel, c.drLabel, c.hours.toFixed(1), fk(Math.round(c.totalCouts)), `${c.margePct}%`, fk(Math.round(c.prixCession))]),
              footer: ['TOTAL', '', '', '', '', tot.h.toFixed(1), fk(Math.round(tot.couts)), '', fk(Math.round(tot.cession))],
            },
            {
              heading: 'Synthèse par BU / centre de coût',
              columns: ['Business Unit / Centre de coût', 'Nb Missions', 'Km', 'Total Coûts (DA)', 'Prix Cession (DA)', 'Marge Dégagée (DA)'],
              rows: byBU.flatMap((b) => [
                [`${b.bu} — ${buName(b.bu)}`, b.nbMi, fk(b.km), fk(Math.round(b.couts)), fk(Math.round(b.cession)), fk(Math.round(b.cession - b.couts))],
                ...b.caRows.map((ca) => [`   ↳ ${ca.code}`, ca.nbMi, fk(ca.km), fk(Math.round(ca.couts)), fk(Math.round(ca.cession)), fk(Math.round(ca.cession - ca.couts))]),
              ]),
            },
            {
              heading: 'Synthèse par Site',
              columns: ['Site', 'BU', 'Nb Missions', 'Cession Missions (DA)', 'Location Engins pointage (DA)', 'Véh. affectés (propres/loués)', 'Coût véh. affectés (DA)', 'Carburant engins dotation (DA)', 'Carburant cuve chantier (DA)', 'Total Facturé (DA)'],
              rows: bySite.map((s) => [s.site, s.buLabel, s.nbMi, fk(Math.round(s.missionCession)), fk(Math.round(s.enginLoc)), `${s.vehProps + s.vehLoues} (${s.vehProps}/${s.vehLoues})`, fk(Math.round(s.vehCostBillable)), fk(Math.round(s.enginFuel)), fk(Math.round(s.cuveFuel)), fk(Math.round(s.total))]),
            },
          ],
        )}>Imprimer l&apos;état</button>
      </div>

      <MargeConfigModal
        open={margeCfgOpen} onClose={() => setMargeCfgOpen(false)}
        margePct={margePct} margeType={margeType} vehicles={V}
        onSave={async (glob, byType, byVh) => {
          await saveMargePct.mutateAsync(glob);
          await saveMargeType.mutateAsync(byType);
          for (const [code, val] of Object.entries(byVh)) {
            const cur = V.find((v) => v.code === code)?.margePct ?? null;
            const next = val === '' ? null : Number(val);
            if (next !== cur) await updateVehicle.mutateAsync({ id: code, body: { margePct: next } });
          }
          toast.success('Marges enregistrées');
          setMargeCfgOpen(false);
        }}
      />

      <Tabs tabs={['Cession par Mission', 'Synthèse par BU', 'Synthèse par Site', 'Voitures de service', 'Productivité Véhicules', 'Productivité Chauffeurs']} active={tab} onChange={setTab} />

      {tab === 0 && (
        <div className="tpane act">
          <div style={{ marginBottom: 8 }}>
            <SearchBox value={cessSearch.q} onChange={cessSearch.setQ} placeholder="Mission, véhicule, chauffeur, BU, site…" count={cessSearch.count} total={calcs.length} />
          </div>
          <div className="tc"><div className="tw">
            <table>
              <thead><tr><th>Mission</th><th>BU / CA</th><th>Site</th><th>Véhicule</th><th>Chauffeur</th><th>Heures</th><th>Coût VH (DA)</th><th>Carburant (DA)</th><th>Coût Chauffeur (DA)</th><th>Frais (DA)</th><th>Total Coûts (DA)</th><th>Marge</th><th>Prix Cession (DA)</th></tr></thead>
              <tbody>
                {cessSearch.filtered.map(({ m, c }) => {
                  const shares = missionBuShares(m, c);
                  const grouped = shares.length > 1;
                  return (
                    <Fragment key={m.num}>
                      <tr style={grouped ? { background: 'var(--b0)' } : undefined}>
                        <td style={{ fontWeight: 600 }}>{m.num}{grouped && <span className="bg bg-b" style={{ fontSize: '.55rem', marginLeft: 4 }}>{shares.length} demandes</span>}</td>
                        <td style={{ fontSize: '.72rem' }}>{grouped ? shares.map((s) => buName(canonBu(s.bu))).join(' + ') : `${c.buCode} / ${c.caCode || '—'}`}</td>
                        <td style={{ fontSize: '.72rem' }}>{m.site ?? '—'}</td>
                        <td style={{ fontSize: '.72rem' }}>{c.vhLabel}</td><td style={{ fontSize: '.72rem' }}>{c.drLabel}</td>
                        <td>{c.hours.toFixed(1)}h</td><td>{fk(c.coutVh)} DA</td><td>{fk(c.fuelCost)} DA</td><td>{fk(c.coutDr)} DA</td><td>{fk(c.fraisMission)} DA</td>
                        <td style={{ fontWeight: 600 }}>{fk(c.totalCouts)} DA</td><td>{c.margePct}%</td>
                        <td style={{ fontWeight: 700, color: 'var(--b6)' }}>{fk(c.prixCession)} DA</td>
                      </tr>
                      {grouped && shares.map((s) => (
                        <tr key={m.num + s.dpcCode} style={{ fontSize: '.7rem', color: 'var(--tm)' }}>
                          <td style={{ paddingLeft: 20 }}>↳ {s.dpcCode}</td>
                          <td>{buName(canonBu(s.bu))}{s.structure ? ` · ${s.structure}` : ''}</td>
                          <td colSpan={7} style={{ textAlign: 'right' }}>part {s.pct} %</td>
                          <td>{fk(s.totalCouts)} DA</td><td />
                          <td style={{ fontWeight: 600 }}>{fk(s.prixCession)} DA</td>
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
                {!cessSearch.filtered.length && <tr><td colSpan={13} style={{ textAlign: 'center', padding: 24, color: 'var(--tm)' }}>{calcs.length ? 'Aucune mission ne correspond' : 'Aucune mission pour cette période'}</td></tr>}
              </tbody>
              <tfoot><tr style={{ background: 'var(--b0)', fontWeight: 700 }}><td colSpan={5}>TOTAL</td><td>{tot.h.toFixed(1)}h</td><td>{fk(Math.round(tot.vh))} DA</td><td>{fk(Math.round(tot.fuel))} DA</td><td>{fk(Math.round(tot.dr))} DA</td><td>{fk(Math.round(tot.frais))} DA</td><td>{fk(Math.round(tot.couts))} DA</td><td /><td style={{ color: 'var(--b6)' }}>{fk(Math.round(tot.cession))} DA</td></tr></tfoot>
            </table>
          </div></div>
        </div>
      )}

      {tab === 1 && (
        <div className="tpane act">
          <div className="cr" style={{ marginBottom: 12 }}>
            <div className="cc">
              <h3>Prix de Cession par BU</h3><div className="sub">{period.label}</div>
              {byBU.length > 0 && (
                <BarChart labels={byBU.map((b) => b.bu)} unit="K DA"
                  datasets={[{ label: 'Cession', values: byBU.map((b) => Math.round(b.cession / 1000)), colorVar: '--c1' }]} />
              )}
            </div>
          </div>
          <div className="sub" style={{ marginBottom: 6 }}>Chaque BU détaillée par <b>centre de coût</b>.</div>
          <div className="tc"><div className="tw">
            <table>
              <thead><tr><th>Business Unit / Centre de coût</th><th>Nb Missions</th><th>Km Total</th><th>Total Coûts (DA)</th><th>Prix Cession (DA)</th><th>Marge Dégagée (DA)</th></tr></thead>
              <tbody>
                {byBU.map((b) => (
                  <Fragment key={b.bu}>
                    <tr style={{ background: 'var(--s0)' }}>
                      <td style={{ fontWeight: 700 }}>{b.bu} — {buName(b.bu)}</td>
                      <td>{b.nbMi}</td><td>{fk(b.km)} km</td><td>{fk(Math.round(b.couts))} DA</td>
                      <td style={{ fontWeight: 700, color: 'var(--b6)' }}>{fk(Math.round(b.cession))} DA</td>
                      <td style={{ color: 'var(--g6)' }}>{fk(Math.round(b.cession - b.couts))} DA</td>
                    </tr>
                    {b.caRows.map((ca) => (
                      <tr key={b.bu + ca.code} style={{ fontSize: '.76rem', color: 'var(--tm)' }}>
                        <td style={{ paddingLeft: 22 }}>↳ {ca.code === '(sans centre de coût)' ? ca.code : `${ca.code}${caName(b.bu, ca.code) ? ` — ${caName(b.bu, ca.code)}` : ''}`}</td>
                        <td>{ca.nbMi}</td><td>{fk(ca.km)} km</td><td>{fk(Math.round(ca.couts))} DA</td>
                        <td style={{ color: 'var(--b6)' }}>{fk(Math.round(ca.cession))} DA</td>
                        <td>{fk(Math.round(ca.cession - ca.couts))} DA</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {!byBU.length && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--tm)' }}>Aucune mission pour cette période</td></tr>}
              </tbody>
              {byBU.length > 0 && (
                <tfoot><tr style={{ background: 'var(--b0)', fontWeight: 700 }}>
                  <td>TOTAL</td><td /><td>{fk(byBU.reduce((s, b) => s + b.km, 0))} km</td>
                  <td>{fk(Math.round(byBU.reduce((s, b) => s + b.couts, 0)))} DA</td>
                  <td style={{ color: 'var(--b6)' }}>{fk(Math.round(byBU.reduce((s, b) => s + b.cession, 0)))} DA</td>
                  <td style={{ color: 'var(--g6)' }}>{fk(Math.round(byBU.reduce((s, b) => s + b.cession - b.couts, 0)))} DA</td>
                </tr></tfoot>
              )}
            </table>
          </div></div>
        </div>
      )}

      {tab === 2 && (
        <div className="tpane act">
          <div className="cc" style={{ marginBottom: 10 }}>
            <h3>Facturation par Site / Chantier</h3>
            <div className="sub">
              Total site = missions vers le site + location engins (pointage) + <b>coût des véhicules affectés</b> (coût mensuel des
              véhicules non pointés — centre analytique = site) + <b>carburant</b> (dotation pointage + sorties de cuve du chantier).
              Un véhicule pointé au jour n&apos;est pas re-compté à son coût mensuel.
            </div>
          </div>
          {bySite.length > 0 && (
            <div className="cc" style={{ marginBottom: 12 }}>
              <BarChart labels={bySite.map((s) => s.site)} unit="K DA"
                datasets={[{ label: 'Total facturé', values: bySite.map((s) => Math.round(s.total / 1000)), colorVar: '--c1' }]} />
            </div>
          )}
          <div className="tc"><div className="tw">
            <table>
              <thead><tr><th>Site / Chantier</th><th>BU</th><th>Nb Missions</th><th>Cession Missions (DA)</th><th>Location Engins — pointage (DA)</th><th>Véh. affectés (propres / loués)</th><th>Coût véh. affectés (DA)</th><th>Carburant engins — dotation (DA)</th><th>Carburant cuve chantier (DA)</th><th>Total Facturé (DA)</th></tr></thead>
              <tbody>
                {bySite.map((s) => (
                  <tr key={s.site}>
                    <td style={{ fontWeight: 600 }}>{s.site}</td>
                    <td style={{ fontSize: '.72rem' }}>{s.buLabel}</td>
                    <td>{s.nbMi}</td>
                    <td>{fk(Math.round(s.missionCession))} DA</td>
                    <td>{s.enginLoc ? `${fk(Math.round(s.enginLoc))} DA` : '—'}{s.enginDays ? <div style={{ color: 'var(--tm)', fontSize: '.68rem' }}>{Math.round(s.enginDays * 100) / 100} j{s.immoDays ? ` + ${s.immoDays} immo` : ''}</div> : null}</td>
                    <td style={{ fontSize: '.8rem' }}>{(s.vehProps + s.vehLoues) ? `${s.vehProps + s.vehLoues} (${s.vehProps} / ${s.vehLoues})` : '—'}</td>
                    <td>{s.vehCostBillable ? `${fk(Math.round(s.vehCostBillable))} DA` : (s.vehCost ? <span style={{ color: 'var(--tm)', fontSize: '.72rem' }}>0 — pointé au jour</span> : '—')}</td>
                    <td>{s.enginFuel ? `${fk(Math.round(s.enginFuel))} DA` : '—'}</td>
                    <td style={{ color: s.cuveFuel ? 'var(--a6)' : undefined }}>{s.cuveFuel ? `${fk(Math.round(s.cuveFuel))} DA` : '—'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--b6)' }}>{fk(Math.round(s.total))} DA</td>
                  </tr>
                ))}
                {!bySite.length && <tr><td colSpan={10} style={{ textAlign: 'center', padding: 20, color: 'var(--tm)' }}>Aucune activité site pour cette période</td></tr>}
              </tbody>
              {bySite.length > 0 && (
                <tfoot><tr style={{ background: 'var(--b0)', fontWeight: 700 }}>
                  <td colSpan={3}>TOTAL SITES</td>
                  <td>{fk(Math.round(bySite.reduce((a, s) => a + s.missionCession, 0)))} DA</td>
                  <td>{fk(Math.round(bySite.reduce((a, s) => a + s.enginLoc, 0)))} DA</td>
                  <td>{bySite.reduce((a, s) => a + s.vehProps + s.vehLoues, 0) || '—'}</td>
                  <td>{fk(Math.round(bySite.reduce((a, s) => a + s.vehCostBillable, 0)))} DA</td>
                  <td>{fk(Math.round(bySite.reduce((a, s) => a + s.enginFuel, 0)))} DA</td>
                  <td>{fk(Math.round(bySite.reduce((a, s) => a + s.cuveFuel, 0)))} DA</td>
                  <td style={{ color: 'var(--b6)' }}>{fk(Math.round(bySite.reduce((a, s) => a + s.total, 0)))} DA</td>
                </tr></tfoot>
              )}
            </table>
          </div></div>
        </div>
      )}
      {tab === 3 && (
        <div className="tpane act">
          <div className="cc" style={{ marginBottom: 10 }}>
            <h3>Voitures de service — refacturation</h3>
            <div className="sub">
              Véhicules attribués en permanence à une personne (déclarés dans <b>Chauffeurs &amp; Utilisateurs → Voitures de service</b>).
              Coût véhicule mensuel + carburant de la période, ventilés sur la BU / le centre de coût de l&apos;affectation. {period.label}.
            </div>
          </div>
          {serviceCarByBU.length > 0 && (
            <div className="cc" style={{ marginBottom: 12 }}>
              <BarChart labels={serviceCarByBU.map((b) => b.bu)} unit="K DA"
                datasets={[{ label: 'Refacturé', values: serviceCarByBU.map((b) => Math.round(b.total / 1000)), colorVar: '--c1' }]} />
            </div>
          )}
          <div className="tc"><div className="tw">
            <table>
              <thead><tr><th>Véhicule</th><th>Attribuée à / Structure</th><th>BU / Centre de coût</th><th>Coût véhicule (DA)</th><th>Carburant période (DA)</th><th>Total refacturé (DA)</th></tr></thead>
              <tbody>
                {serviceCarRows.map((r) => (
                  <tr key={r.a.id}>
                    <td style={{ fontWeight: 600 }}>{r.label}</td>
                    <td>{r.assignee}<div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>{r.structure}</div></td>
                    <td style={{ fontSize: '.72rem' }}>{buCcLabel(r.a.businessUnit, r.cc)}</td>
                    <td>{fk(r.vehCost)} DA</td>
                    <td>{fk(r.fuelCost)} DA</td>
                    <td style={{ fontWeight: 700, color: 'var(--b6)' }}>{fk(r.total)} DA</td>
                  </tr>
                ))}
                {!serviceCarRows.length && <tr><td colSpan={6} style={{ textAlign: 'center', padding: 22, color: 'var(--tm)' }}>Aucune voiture de service active sur cette période</td></tr>}
              </tbody>
              {serviceCarRows.length > 0 && (
                <tfoot><tr style={{ background: 'var(--b0)', fontWeight: 700 }}>
                  <td colSpan={3}>TOTAL</td>
                  <td>{fk(serviceCarRows.reduce((s, r) => s + r.vehCost, 0))} DA</td>
                  <td>{fk(serviceCarRows.reduce((s, r) => s + r.fuelCost, 0))} DA</td>
                  <td style={{ color: 'var(--b6)' }}>{fk(Math.round(serviceCarTotal))} DA</td>
                </tr></tfoot>
              )}
            </table>
          </div></div>

          {serviceCarByBU.length > 0 && (
            <div className="tc" style={{ marginTop: 12 }}><div className="th"><h3>Synthèse par BU</h3></div><div className="tw">
              <table>
                <thead><tr><th>Business Unit</th><th>Voitures</th><th>Coût véhicule (DA)</th><th>Carburant (DA)</th><th>Total refacturé (DA)</th></tr></thead>
                <tbody>
                  {serviceCarByBU.map((b) => (
                    <tr key={b.bu}>
                      <td style={{ fontWeight: 600 }}>{b.bu} — {buName(b.bu)}</td>
                      <td>{b.cars}</td><td>{fk(Math.round(b.vehCost))} DA</td><td>{fk(Math.round(b.fuelCost))} DA</td>
                      <td style={{ fontWeight: 700, color: 'var(--b6)' }}>{fk(Math.round(b.total))} DA</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div></div>
          )}
        </div>
      )}
      {tab === 4 && <Productivity calcs={calcs} keyFn={(c) => c.vhLabel} label="Véhicule" />}
      {tab === 5 && <Productivity calcs={calcs} keyFn={(c) => c.drLabel} label="Chauffeur" />}
    </div>
  );
}

function MargeConfigModal({ open, onClose, margePct, margeType, vehicles, onSave }: {
  open: boolean; onClose: () => void;
  margePct: number; margeType: MargeType; vehicles: Vehicle[];
  onSave: (glob: number, byType: MargeType, byVh: Record<string, string>) => Promise<void>;
}) {
  const [glob, setGlob] = useState(String(margePct));
  const [byType, setByType] = useState<Record<string, string>>(
    Object.fromEntries(VH_TYPES.map((t) => [t, String(margeType[t] ?? margePct)])),
  );
  const [byVh, setByVh] = useState<Record<string, string>>(
    Object.fromEntries(vehicles.map((v) => [v.code, v.margePct != null ? String(v.margePct) : ''])),
  );
  // Resynchronise quand les données arrivent / la modale se rouvre.
  const [seed, setSeed] = useState('');
  const sig = `${margePct}|${Object.values(margeType).join()}|${vehicles.length}`;
  if (open && seed !== sig) {
    setSeed(sig);
    setGlob(String(margePct));
    setByType(Object.fromEntries(VH_TYPES.map((t) => [t, String(margeType[t] ?? margePct)])));
    setByVh(Object.fromEntries(vehicles.map((v) => [v.code, v.margePct != null ? String(v.margePct) : ''])));
  }
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const g = Number(glob) || 0;
      const bt: MargeType = {};
      for (const t of VH_TYPES) bt[t] = byType[t] === '' ? g : Number(byType[t]) || 0;
      await onSave(g, bt, byVh);
    } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Configuration des Marges (%)" wide
      footer={<><button className="btn btn-o" onClick={onClose}>Annuler</button>
        <button className="btn btn-p" onClick={submit} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button></>}>
      <div style={{ marginBottom: 14, padding: 10, background: 'var(--b0)', borderRadius: 8, border: '1px solid var(--b1)' }}>
        <div style={{ fontWeight: 600, marginBottom: 8, color: 'var(--b6)' }}>Marge globale (défaut)</div>
        <div className="form-g" style={{ marginBottom: 0 }}>
          <label>Marge globale (%)</label>
          <input type="number" value={glob} onChange={(e) => setGlob(e.target.value)} style={{ width: 90 }} />
        </div>
      </div>

      <div style={{ marginBottom: 14, padding: 10, background: 'var(--sc)', borderRadius: 8, border: '1px solid var(--bl)' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Marge par type de véhicule</div>
        {VH_TYPES.map((t) => (
          <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ minWidth: 90, fontSize: '.82rem' }}>{TYPE_LABEL[t]}</span>
            <input type="number" value={byType[t] ?? ''} onChange={(e) => setByType((s) => ({ ...s, [t]: e.target.value }))} style={{ width: 75 }} />
            <span style={{ fontSize: '.75rem', color: 'var(--tm)' }}>%</span>
          </div>
        ))}
      </div>

      <div style={{ padding: 10, background: 'var(--sc)', borderRadius: 8, border: '1px solid var(--bl)', maxHeight: 260, overflowY: 'auto' }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Marge par véhicule (individuel)</div>
        <div style={{ fontSize: '.72rem', color: 'var(--tm)', marginBottom: 8 }}>Laisser vide = utilise la marge par type / globale.</div>
        {vehicles.map((v) => {
          const ph = margeType[v.type] ?? margePct;
          return (
            <div key={v.code} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ minWidth: 190, fontSize: '.74rem' }}>{v.code} {v.brand} {v.model} <span className="bg">{v.type}</span></span>
              <input type="number" value={byVh[v.code] ?? ''} placeholder={String(ph)}
                onChange={(e) => setByVh((s) => ({ ...s, [v.code]: e.target.value }))} style={{ width: 70, fontSize: '.74rem' }} />
              <span style={{ fontSize: '.7rem', color: 'var(--tm)' }}>%</span>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function Productivity({ calcs, keyFn, label }: {
  calcs: { m: Mission; c: import('@/lib/fleet/factbu').MissionCost }[];
  keyFn: (c: import('@/lib/fleet/factbu').MissionCost) => string;
  label: string;
}) {
  const map: Record<string, { name: string; nbMi: number; hours: number; km: number; couts: number; cession: number }> = {};
  calcs.forEach(({ m, c }) => {
    const k = keyFn(c);
    const e = (map[k] ??= { name: k, nbMi: 0, hours: 0, km: 0, couts: 0, cession: 0 });
    e.nbMi++; e.hours += c.hours; e.km += m.distance ?? 0; e.couts += c.totalCouts; e.cession += c.prixCession;
  });
  const rows = Object.values(map).sort((a, b) => b.cession - a.cession);
  return (
    <div className="tpane act">
      <div className="tc"><div className="tw">
        <table>
          <thead><tr><th>{label}</th><th>Missions</th><th>Heures</th><th>Km</th><th>Total Coûts (DA)</th><th>Prix Cession (DA)</th><th>Cession / h (DA)</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td style={{ fontWeight: 600 }}>{r.name}</td><td>{r.nbMi}</td><td>{r.hours.toFixed(1)}h</td><td>{fk(r.km)} km</td>
                <td>{fk(Math.round(r.couts))} DA</td><td style={{ fontWeight: 700, color: 'var(--b6)' }}>{fk(Math.round(r.cession))} DA</td>
                <td>{r.hours > 0 ? `${fk(Math.round(r.cession / r.hours))} DA` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}
