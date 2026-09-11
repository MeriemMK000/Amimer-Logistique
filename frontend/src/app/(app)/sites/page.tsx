'use client';

import { Fragment, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import PlateInput from '@/components/ui/PlateInput';
import PeriodPicker from '@/components/ui/PeriodPicker';
import SearchBox from '@/components/ui/SearchBox';
import BuCcSelect, { useBuCcLabel } from '@/components/ui/BuCcSelect';
import DateInput from '@/components/ui/DateInput';
import { useSearch } from '@/lib/useSearch';
import { useSiteNames, withCurrentSite } from '@/lib/reference/sites';
import { useOrgOptions, withCurrentOrg } from '@/lib/reference/org';
import { usePeriod } from '@/lib/period';
import { fd, fk } from '@/lib/fleet/format';
import { printHTML } from '@/lib/export';
import {
  getAssignmentOrdre,
  useConfirmedRemove, useCreate, useCreateFuelStockOp, useDrivers, useExternalVehicles,
  useImportSitePointage, useLeaseContracts, useSiteBilling, useSiteExternalControl, useSiteFuelSummary,
  useSitePointage, useSuppliers, useUpdate, useUpsertSitePointage, useVehicleAssignments, useVehicles,
} from '@/lib/api/hooks';

const TABS = ['Affectations', 'Parc site & externes', 'Pointage (grille)', 'Facturation site', 'Factures externes'];

// Journee = 8 h. Grille de pointage identique au pointage location : pas de 30 min.
const HOURS_PER_DAY = 8;
const FRACTIONS: { v: number; l: string }[] = (() => {
  const list: { v: number; l: string }[] = [{ v: 0, l: '0' }];
  for (let h = 0.5; h <= HOURS_PER_DAY; h += 0.5) {
    const label = h === HOURS_PER_DAY ? '8 h — 1 jour' : Number.isInteger(h) ? `${h} h` : `${Math.floor(h)} h 30`;
    list.push({ v: h / HOURS_PER_DAY, l: label });
  }
  return list;
})();
const IMMO = 'I';
const snap = (f: number) => FRACTIONS.reduce((b, o) => (Math.abs(o.v - f) < Math.abs(b.v - f) ? o : b), FRACTIONS[0]).v;
const fmtDays = (d: number) => (Number.isInteger(d) ? String(d) : d.toFixed(3).replace(/0+$/, '').replace(/\.$/, ''));
const monthOptions = () => {
  const names = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
  const t = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
    return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: `${names[d.getMonth()]} ${d.getFullYear()}` };
  });
};

function G({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="form-g"><label>{label}</label>{children}</div>;
}

export default function SitesPage() {
  const [tab, setTab] = useState(0);
  return (
    <div className="page active">
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 0 && <AffectationsTab />}
      {tab === 1 && <ParcTab />}
      {tab === 2 && <PointageGridTab />}
      {tab === 3 && <PointageTab />}
      {tab === 4 && <FacturesExternesTab />}
    </div>
  );
}

/* ─── Pointage engins site : grille (même modèle que le pointage location) ─── */
function PointageGridTab() {
  const assignments = useVehicleAssignments();
  const vehicles = useVehicles();
  const contracts = useLeaseContracts();
  const externals = useExternalVehicles();
  const pointage = useSitePointage();
  const upsert = useUpsertSitePointage();

  const months = monthOptions();
  const [month, setMonth] = useState(months[0].value);
  const [dayD, setDayD] = useState<any>(null);

  const A = assignments.data ?? [];
  const EX = (externals.data ?? []) as any[];
  const sites = useMemo(() => [...new Set([
    ...A.map((a: any) => a.siteCode),
    ...EX.map((e: any) => e.siteCode),
  ].filter(Boolean))] as string[], [A, EX]);
  const [site, setSite] = useState('');
  const activeSite = site || sites[0] || '';

  const PT = (pointage.data ?? []) as any[];
  const [y, mo] = month.split('-').map(Number);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const dayNames = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

  // Véhicules/engins affectés à ce site (loués + propres affectés) + véhicules externes du site.
  const siteRows = useMemo(() => {
    const fromAssign = A.filter((a: any) => a.siteCode === activeSite).map((a: any) => {
      const v = vehicles.data?.find((x) => x.code === a.vehicleCode);
      const ct = contracts.data?.find((c) => c.vehicleCode === a.vehicleCode);
      const dayPrice = ct?.dailyPrice ?? (a.vehicleMonthlyCost ? Math.round(a.vehicleMonthlyCost / 26) : 0);
      return { code: a.vehicleCode as string, targetType: (v?.type ?? '').toUpperCase() === 'ENGIN' ? 'engin' : 'vehicle', label: v ? `${v.brand} ${v.model}` : a.vehicleCode, type: v?.type ?? '—', owned: v?.ownership !== 'LOCATION', external: false, dayPrice, immoPrice: Math.round(dayPrice * 0.5), bu: a.businessUnit ?? null };
    });
    const fromExt = EX.filter((e: any) => e.siteCode === activeSite).map((e: any) => ({
      code: e.id as string, targetType: 'external', label: `${e.label}${e.supplier ? ` — ${e.supplier}` : ''}`,
      type: e.kind ?? 'EXTERNE', owned: false, external: true,
      dayPrice: e.rateUnit === 'hour' ? Math.round((e.unitRate ?? 0) * 8) : (e.unitRate ?? 0),
      immoPrice: 0, bu: null,
    }));
    return [...fromAssign, ...fromExt];
  }, [A, EX, vehicles.data, contracts.data, activeSite]);

  const setPt = (targetCode: string, targetType: string, date: string, opt: number | typeof IMMO, dayPrice: number, bu: string | null) =>
    upsert.mutate([opt === IMMO
      ? { siteCode: activeSite, targetCode, targetType, date, fraction: 1, immobilized: true, dayPrice, businessUnit: bu ?? undefined }
      : { siteCode: activeSite, targetCode, targetType, date, fraction: opt, immobilized: false, dayPrice, businessUnit: bu ?? undefined }]);

  const fillWorkdays = (targetCode: string, targetType: string, dayPrice: number, bu: string | null) => {
    const rows = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dow = new Date(y, mo - 1, d).getDay();
      if (dow === 5 || dow === 6) continue;
      rows.push({ siteCode: activeSite, targetCode, targetType, date: `${month}-${String(d).padStart(2, '0')}`, fraction: 1, immobilized: false, dayPrice, businessUnit: bu ?? undefined });
    }
    upsert.mutate(rows);
  };
  const clearRow = (targetCode: string, targetType: string) => {
    upsert.mutate(Array.from({ length: daysInMonth }, (_, i) => ({
      siteCode: activeSite, targetCode, targetType, date: `${month}-${String(i + 1).padStart(2, '0')}`, fraction: 0, immobilized: false,
    })));
  };

  return (
    <div className="cc">
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <select value={month} onChange={(e) => setMonth(e.target.value)}>{months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
        <select value={activeSite} onChange={(e) => setSite(e.target.value)}>{sites.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <span style={{ fontSize: '.7rem', color: 'var(--tm)' }}>
          Journée = {HOURS_PER_DAY} h · pas de 30 min · <b>I</b> = immobilisé sur site (prix immo.) · coût = prix jour × fraction · cumul heures → jours
        </span>
      </div>
      <div className="tw" style={{ overflowX: 'auto' }}>
        <table style={{ fontSize: '.7rem', borderCollapse: 'collapse', minWidth: daysInMonth * 42 + 220 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 160, textAlign: 'left', padding: '4px 6px', position: 'sticky', left: 0, background: 'var(--s1)', zIndex: 1 }}>Engin / véhicule</th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const dow = new Date(y, mo - 1, d).getDay();
                const isWe = dow === 5 || dow === 6;
                return <th key={d} style={{ textAlign: 'center', padding: '2px 1px', minWidth: 40, fontSize: '.58rem', background: isWe ? 'var(--b0)' : undefined }}>{d}<br /><span style={{ fontWeight: 400, color: 'var(--tm)' }}>{dayNames[dow]}</span></th>;
              })}
              <th style={{ textAlign: 'center', padding: '4px 6px', minWidth: 130, fontWeight: 700 }}>Cumul mois</th>
            </tr>
          </thead>
          <tbody>
            {siteRows.map((r) => {
              let sumFrac = 0, immoDays = 0, cost = 0;
              const cells = Array.from({ length: daysInMonth }, (_, i) => {
                const d = i + 1;
                const dateStr = `${month}-${String(d).padStart(2, '0')}`;
                const dow = new Date(y, mo - 1, d).getDay();
                const isWe = dow === 5 || dow === 6;
                const p = PT.find((x) => x.siteCode === activeSite && x.targetCode === r.code && x.date === dateStr);
                const isImmo = !!p?.immobilized;
                const f = isImmo ? 1 : snap(p?.fraction ?? 0);
                if (isImmo) { immoDays += 1; cost += r.immoPrice; }
                else { sumFrac += f; cost += f * r.dayPrice; }
                const hasDetails = !!(p && (p.fuelLiters || p.kmStart != null || p.kmEnd != null || p.hoursStart != null || p.hoursEnd != null));
                const bg = isImmo ? 'var(--r1)' : f >= 1 ? 'var(--g1)' : f > 0 ? 'var(--a1)' : isWe ? 'var(--b0)' : 'transparent';
                return (
                  <td key={d} style={{ padding: 1, border: '1px solid var(--bd)', background: bg, position: 'relative' }}>
                    <select value={isImmo ? IMMO : String(f)}
                      onChange={(e) => setPt(r.code, r.targetType, dateStr, e.target.value === IMMO ? IMMO : Number(e.target.value), r.dayPrice, r.bu)}
                      title={isImmo ? 'Immobilisé sur site' : `${(f * HOURS_PER_DAY).toFixed(2)} h`}
                      style={{ width: '100%', border: 0, background: 'transparent', fontSize: '.62rem', textAlign: 'center', color: isImmo ? 'var(--r6)' : f > 0 ? 'var(--tp)' : 'var(--tm)', fontWeight: isImmo || f > 0 ? 700 : 400, cursor: 'pointer', appearance: 'none' }}>
                      {FRACTIONS.map((o) => <option key={o.v} value={String(o.v)}>{o.l}</option>)}
                      <option value={IMMO}>I — Immobilisé</option>
                    </select>
                    <button title="Détails du jour : carburant / km / heures compteur"
                      onClick={() => setDayD({ code: r.code, targetType: r.targetType, label: r.label, type: r.type, dayPrice: r.dayPrice, bu: r.bu, date: dateStr, fraction: f, immobilized: isImmo, fuelLiters: p?.fuelLiters ?? '', kmStart: p?.kmStart ?? '', kmEnd: p?.kmEnd ?? '', hoursStart: p?.hoursStart ?? '', hoursEnd: p?.hoursEnd ?? '' })}
                      style={{ position: 'absolute', top: 0, right: 0, width: 12, height: 12, lineHeight: '10px', fontSize: '.5rem', border: 0, borderRadius: 2, cursor: 'pointer', background: hasDetails ? 'var(--b5)' : 'transparent', color: hasDetails ? '#fff' : 'var(--tm)', padding: 0 }}>
                      {hasDetails ? '•' : '⋯'}
                    </button>
                  </td>
                );
              });
              return (
                <tr key={r.code}>
                  <td style={{ fontWeight: 600, padding: '4px 6px', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: 'var(--s1)', zIndex: 1 }}>
                    <div>{r.external ? '' : r.code + ' '}<span className="bg">{r.type}</span> {r.external
                      ? <span className="bg bg-b" style={{ fontSize: '.5rem' }}>externe</span>
                      : r.owned ? <span className="bg bg-g" style={{ fontSize: '.5rem' }}>propre</span> : <span className="bg bg-a" style={{ fontSize: '.5rem' }}>loué</span>}</div>
                    <div style={{ fontWeight: 400, color: 'var(--tm)', fontSize: '.58rem' }}>{r.label} · {fk(r.dayPrice)} DA/j{r.external ? '' : ` · immo ${fk(r.immoPrice)}`}{r.bu ? ` · BU ${r.bu}` : ''}</div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                      <button className="btn btn-o btn-sm" style={{ fontSize: '.55rem', padding: '1px 5px' }} onClick={() => fillWorkdays(r.code, r.targetType, r.dayPrice, r.bu)}>Ouvrés = 1 j</button>
                      <button className="btn btn-o btn-sm" style={{ fontSize: '.55rem', padding: '1px 5px' }} onClick={() => clearRow(r.code, r.targetType)}>Effacer</button>
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
            {!siteRows.length && <tr><td colSpan={daysInMonth + 2} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun véhicule/engin/externe sur ce site — crée une affectation (onglet « Affectations ») ou un véhicule externe (onglet « Parc site &amp; externes »).</td></tr>}
          </tbody>
        </table>
      </div>

      {dayD && (() => {
        const isEngin = String(dayD.type).toUpperCase() === 'ENGIN';
        const num = (v: any) => (v === '' || v == null ? null : Number(v));
        const save = async () => {
          await upsert.mutateAsync([{
            siteCode: activeSite, targetCode: dayD.code, date: dayD.date,
            fraction: dayD.fraction || 0, immobilized: !!dayD.immobilized,
            dayPrice: dayD.dayPrice, businessUnit: dayD.bu ?? undefined,
            fuelLiters: num(dayD.fuelLiters), kmStart: num(dayD.kmStart), kmEnd: num(dayD.kmEnd),
            hoursStart: num(dayD.hoursStart), hoursEnd: num(dayD.hoursEnd),
          }]);
          toast.success('Détails du jour enregistrés');
          setDayD(null);
        };
        return (
          <Modal open onClose={() => setDayD(null)} title={`Détails du jour — ${dayD.code} · ${fd(dayD.date)}`}
            footer={<><button className="btn btn-o" onClick={() => setDayD(null)}>Annuler</button><button className="btn btn-p" onClick={save} disabled={upsert.isPending}>Enregistrer</button></>}>
            <p style={{ fontSize: '.76rem', color: 'var(--tm)' }}>
              {dayD.label} · pointage {dayD.immobilized ? 'immobilisé' : `${(dayD.fraction * 8).toFixed(1)} h`}.
              Le carburant saisi ici est une <b>dotation site</b> : il entre automatiquement dans le contrôle carburant du véhicule.
            </p>
            <div className="form-r">
              <div className="form-g"><label>Carburant donné ce jour (L)</label><input type="number" value={dayD.fuelLiters} onChange={(e) => setDayD({ ...dayD, fuelLiters: e.target.value })} /></div>
              <div className="form-g" />
            </div>
            {isEngin ? (
              <div className="form-r">
                <div className="form-g"><label>Compteur heures — début</label><input type="number" value={dayD.hoursStart} onChange={(e) => setDayD({ ...dayD, hoursStart: e.target.value })} /></div>
                <div className="form-g"><label>Compteur heures — fin</label><input type="number" value={dayD.hoursEnd} onChange={(e) => setDayD({ ...dayD, hoursEnd: e.target.value })} /></div>
              </div>
            ) : (
              <div className="form-r">
                <div className="form-g"><label>Km compteur — début</label><input type="number" value={dayD.kmStart} onChange={(e) => setDayD({ ...dayD, kmStart: e.target.value })} /></div>
                <div className="form-g"><label>Km compteur — fin</label><input type="number" value={dayD.kmEnd} onChange={(e) => setDayD({ ...dayD, kmEnd: e.target.value })} /></div>
              </div>
            )}
          </Modal>
        );
      })()}
    </div>
  );
}

/* ─── Affectations ─── */
const CT_LBL: Record<string,string> = { mission: 'Par mission', km_difference: 'Par différence km', hours: 'Par heures' };
const CCK_LBL: Record<string, string> = { site: 'Site / Chantier', person: 'Personne / Structure', bu: 'Business Unit' };
const deriveCck = (a: { siteCode?: string | null; assigneeName?: string | null }) =>
  a.siteCode ? 'site' : a.assigneeName ? 'person' : 'bu';

/** Ordre de mission d'une affectation (retour DG : « affectation site = ordre de mission »). */
async function printAffectationOrdre(id: string) {
  try {
    const o = await getAssignmentOrdre(id);
    printHTML(`Ordre de mission — ${o.num}`, `
      <h1>Ordre de Mission — Affectation ${o.num}</h1>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px">
        <table class="info" style="flex:1">
          <tr><td>Objet</td><td><b>${o.purpose ?? '—'}</b></td></tr>
          <tr><td>Type</td><td>${o.kindLabel ?? '—'}</td></tr>
          <tr><td>Chauffeur / conducteur</td><td>${o.withDriver ? (o.driver?.name ?? o.driver?.code ?? 'avec chauffeur') : 'sans chauffeur'} ${o.driver?.phone ? `(${o.driver.phone})` : ''}</td></tr>
          <tr><td>Véhicule</td><td>${o.vehicle?.code ?? '—'} ${o.vehicle?.brand ?? ''} ${o.vehicle?.model ?? ''}${o.vehicle?.plate ? ` — ${o.vehicle.plate}` : ''}</td></tr>
          <tr><td>Site / Chantier</td><td><b>${o.site ?? '—'}</b></td></tr>
          <tr><td>Centre analytique</td><td>${o.costCenterKindLabel ?? '—'} : <b>${o.costCenterLabel ?? '—'}</b></td></tr>
          <tr><td>Business Unit / Centre de coût</td><td>${o.businessUnit ?? '—'} / ${o.costCenter ?? '—'}</td></tr>
          <tr><td>Période</td><td>${fd(o.dateStart)} → ${o.dateEnd ? fd(o.dateEnd) : '…'}</td></tr>
          <tr><td>Contrôle carburant</td><td>${({ mission: 'Par mission', km_difference: 'Par différence de km', hours: 'Par heures' } as Record<string, string>)[o.controlType] ?? 'Auto'}</td></tr>
          <tr><td>Coût véhicule / mois</td><td>${o.vehicleMonthlyCost ? `${o.vehicleMonthlyCost} DA` : '—'}</td></tr>
          <tr><td>Carte carburant / plafond</td><td>${[o.fuelCardNumber, o.monthlyFuelCap ? `${o.monthlyFuelCap} DA/mois` : null].filter(Boolean).join(' · ') || '—'}</td></tr>
          <tr><td>Ordre émis le</td><td>${o.ordreEmisAt ?? '—'}</td></tr>
        </table>
        <div style="text-align:center"><img src="${o.qr}" width="150" height="150" /><div style="font-size:10px;color:#888">Scanner pour vérifier<br/>l'authenticité</div></div>
      </div>
      <p style="margin-top:24px;font-size:12px">Le véhicule est mis à disposition du site ci-dessus pour la période indiquée. Toute consommation de ce véhicule est imputée au centre analytique <b>${o.costCenterLabel ?? '—'}</b>.</p>
      <p style="margin-top:20px;font-size:12px">Signature conducteur : ______________________&nbsp;&nbsp;&nbsp;Signature responsable logistique : ______________________</p>`);
  } catch {
    toast.error('Impossible de générer l’ordre de mission de l’affectation');
  }
}
function AffectationsTab() {
  const router = useRouter();
  const list = useVehicleAssignments();
  const vehicles = useVehicles();
  const drivers = useDrivers();
  const siteNames = useSiteNames();
  const org = useOrgOptions();
  const create = useCreate<any>('vehicle-assignments');
  const remove = useConfirmedRemove('vehicle-assignments', 'cette affectation');
  const buCcLabel = useBuCcLabel();
  const [open, setOpen] = useState(false);
  const [F, setF] = useState<any>({ kind: 'periode', withDriver: false });

  const rows = (list.data ?? []) as any[];
  const vLabel = (c: string) => {
    const v = vehicles.data?.find((x) => x.code === c);
    return v ? `${v.brand ?? ''} ${v.model ?? ''}`.trim() : c;
  };
  const drLabel = (c: string | null | undefined) => {
    if (!c) return 'avec chauffeur';
    const d = drivers.data?.find((x) => x.code === c);
    return d ? `${d.code} — ${d.name}` : c;
  };
  const search = useSearch(rows, (a) => [a.vehicleCode, vLabel(a.vehicleCode), a.assigneeName, a.structure, a.siteCode, a.businessUnit, a.driverCode, a.kind].join(' '));
  const permanentToPerson = search.filtered.filter((a) => a.assigneeName);
  const others = search.filtered.filter((a) => !a.assigneeName);

  const save = async () => {
    const miss = [
      !F.vehicleCode && 'véhicule',
      !F.assigneeName && !F.siteCode && !F.businessUnit && 'responsable ou site/chantier',
      !F.businessUnit && 'Business Unit',
      !F.costCenter && 'centre de coût',
    ].filter(Boolean);
    if (miss.length) { toast.error(`Champs obligatoires : ${miss.join(', ')}`); return; }
    try {
      await create.mutateAsync({
        ...F,
        vehicleMonthlyCost: F.vehicleMonthlyCost ? Number(F.vehicleMonthlyCost) : null,
        dailyHomeKm: F.dailyHomeKm ? Number(F.dailyHomeKm) : null,
        monthlyFuelCap: F.monthlyFuelCap ? Number(F.monthlyFuelCap) : null,
      });
      setOpen(false);
      setF({ kind: 'periode', withDriver: false });
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur');
    }
  };

  const toMission = (a: any) => {
    const p = new URLSearchParams();
    if (a.vehicleCode) p.set('vehicle', a.vehicleCode);
    if (a.driverCode) p.set('driver', a.driverCode);
    if (a.businessUnit) p.set('bu', a.businessUnit);
    if (a.structure || a.siteCode) p.set('site', a.structure || a.siteCode);
    // Affectation site : la mission « aller chercher » amène le véhicule AU chantier.
    if (a.siteCode) p.set('to', a.siteCode);
    else if (a.assigneeName) p.set('note', `Usage ${a.assigneeName}`);
    router.push(`/missions?${p.toString()}`);
  };

  return (
    <div className="cc">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div><h3>Affectations véhicules</h3><div className="sub">Facturation = carburant + coût véhicule. Suivi par business unit &amp; structure.</div></div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <SearchBox value={search.q} onChange={search.setQ} placeholder="Véhicule, personne, structure…" count={search.count} total={rows.length} />
          <button className="btn btn-p" onClick={() => setOpen(true)}>+ Affectation</button>
        </div>
      </div>

      <h3 style={{ marginTop: 14, fontSize: '.85rem' }}>Affectations permanentes à un responsable / structure</h3>
      <div className="tw" style={{ marginTop: 6 }}>
        <table>
          <thead><tr><th>Véhicule</th><th>Attribuée à</th><th>Structure</th><th>BU / Centre de coût</th><th>Chauffeur</th><th>Trajet domicile</th><th>Contrôle carburant</th><th>Carte / Plafond</th><th>Coût véh./mois</th><th /></tr></thead>
          <tbody>
            {permanentToPerson.map((a: any) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.vehicleCode} — {vLabel(a.vehicleCode)}</td>
                <td style={{ fontWeight: 600 }}>{a.assigneeName}</td>
                <td>{a.structure ?? '—'}</td>
                <td style={{ fontSize: '.74rem' }}>{buCcLabel(a.businessUnit, a.costCenter)}</td>
                <td>{a.withDriver ? drLabel(a.driverCode) : 'sans chauffeur'}</td>
                <td>{a.dailyHomeKm ? `${fk(a.dailyHomeKm)} km/j` : '—'}</td>
                <td style={{ fontSize: '.72rem' }}>{a.controlType ? CT_LBL[a.controlType] : <span style={{ color: 'var(--tm)' }}>auto (différence km)</span>}</td>
                <td style={{ fontSize: '.72rem' }}>{[a.fuelCardNumber, a.monthlyFuelCap ? `${fk(a.monthlyFuelCap)} DA/mois` : null].filter(Boolean).join(' · ') || '—'}</td>
                <td>{a.vehicleMonthlyCost ? `${fk(a.vehicleMonthlyCost)} DA` : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-o btn-sm" onClick={() => toMission(a)} title="Créer une mission pour cette voiture / ce responsable">→ Mission</button>{' '}
                  <button className="btn btn-o btn-sm" onClick={() => remove(a.id, a.vehicleCode)}>Suppr.</button>
                </td>
              </tr>
            ))}
            {!permanentToPerson.length && <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--tm)', padding: 14 }}>Aucune affectation permanente à une personne</td></tr>}
          </tbody>
        </table>
      </div>

      <h3 style={{ marginTop: 16, fontSize: '.85rem' }}>Affectations site / chantier</h3>
      <div className="sub" style={{ marginBottom: 6 }}>
        Le véhicule est <b>suivi sur le site</b> : lors d&apos;une sortie de cuve du chantier, il est proposé en premier.
        Chaque affectation vaut <b>ordre de mission</b> (bouton « Ordre de mission »). Centre analytique = le site.
      </div>
      <div className="tw" style={{ marginTop: 6 }}>
        <table>
          <thead><tr><th>Véhicule</th><th>Type</th><th>Chauffeur</th><th>Site</th><th>Centre analytique</th><th>Contrôle carburant</th><th>Période</th><th>Coût véh./mois</th><th /></tr></thead>
          <tbody>
            {others.map((a: any) => {
              const cck = a.costCenterKind ?? deriveCck(a);
              return (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.vehicleCode} — {vLabel(a.vehicleCode)}</td>
                <td>{a.kind === 'permanent' ? 'Permanente' : 'Période'}</td>
                <td>{a.withDriver ? drLabel(a.driverCode) : 'sans chauffeur'}</td>
                <td>{a.siteCode ?? '—'}</td>
                <td style={{ fontSize: '.72rem' }}>
                  <span className={`bg ${cck === 'site' ? 'bg-b' : 'bg-a'}`}>{CCK_LBL[cck]}</span>{' '}
                  {cck === 'site' ? a.siteCode : cck === 'bu' ? [a.businessUnit, a.costCenter].filter(Boolean).join(' / ') : a.assigneeName}
                </td>
                <td style={{ fontSize: '.72rem' }}>{a.controlType ? CT_LBL[a.controlType] : <span style={{ color: 'var(--tm)' }}>auto</span>}</td>
                <td style={{ fontSize: '.72rem' }}>{fd(a.dateStart)}{a.dateEnd ? ` → ${fd(a.dateEnd)}` : ' → …'}</td>
                <td>{a.vehicleMonthlyCost ? `${fk(a.vehicleMonthlyCost)} DA` : '—'}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn btn-o btn-sm" onClick={() => printAffectationOrdre(a.id)} title="Ordre de mission de l'affectation (imprimable + QR)">Ordre de mission</button>{' '}
                  <button className="btn btn-o btn-sm" onClick={() => toMission(a)} title="Créer la mission « aller chercher le véhicule » (trajet daté vers le chantier)">Mission « aller chercher »</button>{' '}
                  <button className="btn btn-o btn-sm" onClick={() => remove(a.id, a.vehicleCode)}>Suppr.</button>
                </td>
              </tr>
              );
            })}
            {!others.length && <tr><td colSpan={9} style={{ textAlign: 'center', color: 'var(--tm)', padding: 14 }}>Aucune affectation site</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <Modal open onClose={() => setOpen(false)} title="Nouvelle affectation" wide
          footer={<><button className="btn btn-o" onClick={() => setOpen(false)}>Annuler</button><button className="btn btn-p" onClick={save} disabled={!F.vehicleCode || !F.businessUnit || !F.costCenter || create.isPending}>Enregistrer</button></>}>
          <div className="form-r">
            <G label="Véhicule">
              <select value={F.vehicleCode ?? ''} onChange={(e) => setF({ ...F, vehicleCode: e.target.value })}>
                <option value="">—</option>
                {vehicles.data?.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.brand} {v.model}</option>)}
              </select>
            </G>
            <G label="Type">
              <select value={F.kind} onChange={(e) => setF({ ...F, kind: e.target.value })}>
                <option value="periode">Période (chantier)</option><option value="permanent">Permanente</option>
              </select>
            </G>
          </div>
          <div className="form-r">
            <G label="Structure — laisser vide si affectation site">
              <select value={F.structure ?? ''} onChange={(e) => {
                const v = e.target.value;
                setF((s: any) => {
                  const cur = String(s.assigneeName ?? '');
                  const auto = !cur || cur === org.managerFor(String(s.structure ?? ''));
                  const code = org.codeFor(v);
                  return {
                    ...s, structure: v,
                    assigneeName: auto ? org.managerFor(v) : s.assigneeName,
                    businessUnit: code || s.businessUnit,
                    costCenter: code && code !== s.businessUnit ? '' : s.costCenter,
                  };
                });
              }}>
                <option value="">— Aucune —</option>
                {withCurrentOrg(org.structures, F.structure).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </G>
            <G label="Attribuée à (responsable) — laisser vide si affectation site">
              <select value={F.assigneeName ?? ''} onChange={(e) => setF({ ...F, assigneeName: e.target.value })}>
                <option value="">— Aucun —</option>
                {withCurrentOrg(org.managers, F.assigneeName).map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </G>
          </div>
          <div className="form-r">
            <G label="Début"><DateInput value={F.dateStart ?? ''} onChange={(e) => setF({ ...F, dateStart: e.target.value })} /></G>
            <G label="Fin"><DateInput value={F.dateEnd ?? ''} onChange={(e) => setF({ ...F, dateEnd: e.target.value })} /></G>
          </div>
          <div className="form-r">
            <G label="Site / Chantier — laisser vide si voiture de service">
              <select value={F.siteCode ?? ''} onChange={(e) => setF({ ...F, siteCode: e.target.value })}>
                <option value="">— Aucun (voiture de service) —</option>
                {withCurrentSite(siteNames, F.siteCode).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </G>
            <G label="Centre analytique (déduit)">
              <div style={{ padding: '7px 10px', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', background: 'var(--s0)', fontSize: '.78rem' }}>
                {F.siteCode
                  ? <><span className="bg bg-b">Site / Chantier</span> {F.siteCode}</>
                  : F.assigneeName
                    ? <><span className="bg bg-a">Personne / Structure</span> {F.assigneeName}</>
                    : <><span className="bg bg-a">Business Unit</span> {F.businessUnit || '— à choisir —'}</>}
              </div>
            </G>
          </div>
          <div className="form-r">
            <G label="Type de contrôle carburant">
              <select value={F.controlType ?? ''} onChange={(e) => setF({ ...F, controlType: e.target.value || null })}>
                <option value="">Auto (selon l&apos;affectation)</option>
                <option value="mission">Par mission — km réels des missions</option>
                <option value="km_difference">Par différence de km — relevé début → fin de mois</option>
                <option value="hours">Par heures de fonctionnement</option>
              </select>
            </G>
          </div>
          <BuCcSelect
            bu={F.businessUnit} cc={F.costCenter}
            onChange={(bu, cc) => setF({ ...F, businessUnit: bu, costCenter: cc })}
            buLabel="Business Unit *" ccLabel="Centre de coût *" noneLabel="— choisir —" />
          {(!F.businessUnit || !F.costCenter) && (
            <div style={{ fontSize: '.72rem', color: 'var(--a6)', background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '6px 10px' }}>
              Business Unit + centre de coût <b>obligatoires</b> : c&apos;est le rattachement analytique qui permet de refacturer le coût du véhicule.
            </div>
          )}
          <div className="form-r">
            <G label="Trajet domicile (km / jour)"><input type="number" value={F.dailyHomeKm ?? ''} onChange={(e) => setF({ ...F, dailyHomeKm: e.target.value })} placeholder="ex. 30" /></G>
            <G label="Coût véhicule / mois (DA)"><input type="number" value={F.vehicleMonthlyCost ?? ''} onChange={(e) => setF({ ...F, vehicleMonthlyCost: e.target.value })} /></G>
          </div>
          <div className="form-r">
            <G label="N° carte carburant"><input value={F.fuelCardNumber ?? ''} onChange={(e) => setF({ ...F, fuelCardNumber: e.target.value })} /></G>
            <G label="Plafond carburant mensuel (DA)"><input type="number" value={F.monthlyFuelCap ?? ''} onChange={(e) => setF({ ...F, monthlyFuelCap: e.target.value })} /></G>
          </div>
          <div className="form-r">
            <G label="Avec chauffeur ?">
              <select value={F.withDriver ? '1' : '0'} onChange={(e) => setF({ ...F, withDriver: e.target.value === '1', driverCode: e.target.value === '1' ? F.driverCode : null })}>
                <option value="0">Sans chauffeur</option><option value="1">Avec chauffeur</option>
              </select>
            </G>
            <G label="Chauffeur">
              <select value={F.driverCode ?? ''} disabled={!F.withDriver} onChange={(e) => setF({ ...F, driverCode: e.target.value || null })}>
                <option value="">— choisir —</option>
                {(drivers.data ?? []).map((d) => <option key={d.code} value={d.code}>{d.code} — {d.name}{d.license ? ` (${d.license})` : ''}</option>)}
              </select>
            </G>
          </div>
          <div style={{ fontSize: '.72rem', color: 'var(--tm)', background: 'var(--s0)', border: '1px solid var(--bd)', borderRadius: 'var(--rs)', padding: '8px 10px' }}>
            Cette affectation = <b>mise à disposition</b> du véhicule sur le site pour la période. Le véhicule est alors <b>suivi sur le chantier</b> :
            lors d&apos;une <b>sortie de cuve</b> du site, il est proposé en premier. Elle alimente la <b>facturation site</b> (carburant + coût véhicule) et le <b>pointage</b>.
            Après enregistrement, imprime son <b>ordre de mission</b> depuis le tableau ci-dessous.
            {F.withDriver && <> Pour <b>aller chercher</b> le véhicule (trajet daté A→chantier), utilise le bouton « Mission&nbsp;“aller chercher” » — c&apos;est un ordre de mission distinct.</>}
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── Parc site & véhicules externes ─── */
function ParcTab() {
  const ext = useExternalVehicles();
  const assignments = useVehicleAssignments();
  const vehicles = useVehicles();
  const siteNames = useSiteNames();
  const suppliers = useSuppliers();
  const create = useCreate<any>('external-vehicles');
  const remove = useConfirmedRemove('external-vehicles', 'ce véhicule externe');
  const giveFuel = useCreateFuelStockOp();
  const [open, setOpen] = useState(false);
  const [F, setF] = useState<any>({ active: true });
  const [fuelFor, setFuelFor] = useState<any>(null);
  const [FG, setFG] = useState<any>({});

  const saveFuel = async () => {
    const miss = [!(Number(FG.liters) > 0) && 'litres', !FG.date && 'date', !FG.businessUnit && 'Business Unit', !FG.costCenter && 'centre de coût'].filter(Boolean);
    if (miss.length) { toast.error(`Champs obligatoires : ${miss.join(', ')}`); return; }
    try {
      await giveFuel.mutateAsync({
        opType: 'sortie', targetKind: 'external',
        targetCode: fuelFor.id, targetLabel: fuelFor.label,
        fuelType: FG.fuelType || fuelFor.fuelType || 'GASOIL',
        liters: Number(FG.liters), date: FG.date,
        siteCode: FG.siteCode || fuelFor.siteCode || null,
        offStock: !(FG.siteCode || fuelFor.siteCode),
        businessUnit: FG.businessUnit, costCenter: FG.costCenter,
        note: FG.note || 'Carburant fourni — véhicule externe',
      });
      toast.success(`Carburant enregistré pour ${fuelFor.label}`);
      setFuelFor(null); setFG({});
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur');
    }
  };

  const siteVehicles = useMemo(() => {
    const codes = new Set((assignments.data ?? []).filter((a: any) => a.siteCode).map((a: any) => a.vehicleCode));
    return (vehicles.data ?? []).filter((v) => codes.has(v.code));
  }, [assignments.data, vehicles.data]);

  return (
    <>
      <div className="cc">
        <h3>Véhicules / engins affectés à un site</h3>
        <div className="tw" style={{ marginTop: 8 }}>
          <table>
            <thead><tr><th>Code</th><th>Désignation</th><th>Facturation au</th><th>Propriété</th></tr></thead>
            <tbody>
              {siteVehicles.map((v) => (
                <tr key={v.code}>
                  <td style={{ fontWeight: 600 }}>{v.code}</td>
                  <td>{v.brand} {v.model}</td>
                  <td>{v.type === 'ENGIN' ? 'à l’heure' : 'au km'}</td>
                  <td>{v.ownership === 'LOCATION' ? 'Loué' : 'Propre'}</td>
                </tr>
              ))}
              {!siteVehicles.length && <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Aucun (créez une affectation avec un site)</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="cc" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div><h3>Véhicules externes (carburant fourni)</h3><div className="sub">Pas à nous, mais on leur donne du carburant sur site.</div></div>
          <button className="btn btn-p" onClick={() => setOpen(true)}>+ Externe</button>
        </div>
        <div className="tw" style={{ marginTop: 8 }}>
          <table>
            <thead><tr><th>Désignation</th><th>Immat.</th><th>Propriétaire</th><th>Contact</th><th>Site</th><th /></tr></thead>
            <tbody>
              {(ext.data ?? []).map((e: any) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 600 }}>{e.label}</td><td>{e.plate}</td><td>{e.owner}</td><td>{e.contact}</td><td>{e.siteCode}</td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button className="btn btn-o btn-sm" onClick={() => { setFuelFor(e); setFG({ date: new Date().toISOString().slice(0, 10), fuelType: e.fuelType || 'GASOIL', siteCode: e.siteCode || '' }); }} title="Donner du carburant à ce véhicule externe">Donner carburant</button>{' '}
                    <button className="btn btn-o btn-sm" onClick={() => remove(e.id, e.label)}>Suppr.</button>
                  </td>
                </tr>
              ))}
              {!(ext.data ?? []).length && <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Aucun</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal open onClose={() => setOpen(false)} title="Véhicule externe"
          footer={<><button className="btn btn-o" onClick={() => setOpen(false)}>Annuler</button><button className="btn btn-p" disabled={!F.label} onClick={async () => { await create.mutateAsync({ ...F, unitRate: F.unitRate ? Number(F.unitRate) : null }); setOpen(false); setF({ active: true, kind: 'ENGIN', rateUnit: 'day' }); }}>Enregistrer</button></>}>
          <div className="form-r">
            <G label="Désignation"><input value={F.label ?? ''} onChange={(e) => setF({ ...F, label: e.target.value })} /></G>
            <G label="Immatriculation"><PlateInput value={F.plate ?? ''} onChange={(v) => setF({ ...F, plate: v })} /></G>
          </div>
          <div className="form-r">
            <G label="Propriétaire"><input value={F.owner ?? ''} onChange={(e) => setF({ ...F, owner: e.target.value })} /></G>
            <G label="Contact"><input value={F.contact ?? ''} onChange={(e) => setF({ ...F, contact: e.target.value })} placeholder="0550 00 00 00" /></G>
          </div>
          <div className="form-r">
            <G label="Site">
              <select value={F.siteCode ?? ''} onChange={(e) => setF({ ...F, siteCode: e.target.value })}>
                <option value="">— Choisir —</option>
                {withCurrentSite(siteNames, F.siteCode).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </G>
            <G label="Carburant">
              <select value={F.fuelType ?? 'GASOIL'} onChange={(e) => setF({ ...F, fuelType: e.target.value })}>
                {['GASOIL', 'ESSENCE', 'GPL'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </G>
          </div>
          <div className="form-r">
            <G label="Nature">
              <select value={F.kind ?? 'ENGIN'} onChange={(e) => setF({ ...F, kind: e.target.value })}>
                <option value="ENGIN">Engin (pointage heures)</option>
                <option value="LEGER">Véhicule léger (km)</option>
                <option value="LOURD">Camion / lourd</option>
              </select>
            </G>
            <G label="Fournisseur">
              <select value={F.supplier ?? ''} onChange={(e) => setF({ ...F, supplier: e.target.value })}>
                <option value="">— Choisir —</option>
                {(() => {
                  const names = (suppliers.data ?? []).map((s) => s.name).filter(Boolean) as string[];
                  const cur = String(F.supplier ?? '').trim();
                  return (cur && !names.some((n) => n.toLowerCase() === cur.toLowerCase()) ? [cur, ...names] : names)
                    .map((s) => <option key={s} value={s}>{s}</option>);
                })()}
              </select>
            </G>
          </div>
          <div className="form-r">
            <G label="Tarif convenu (DA)"><input type="number" value={F.unitRate ?? ''} onChange={(e) => setF({ ...F, unitRate: e.target.value })} /></G>
            <G label="Unité du tarif">
              <select value={F.rateUnit ?? 'day'} onChange={(e) => setF({ ...F, rateUnit: e.target.value })}>
                <option value="day">par jour</option><option value="hour">par heure</option>
              </select>
            </G>
          </div>
          <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>
            Le tarif + le pointage servent à <b>contrôler la facture</b> du fournisseur (onglet « Factures externes »).
          </div>
        </Modal>
      )}

      {fuelFor && (
        <Modal open onClose={() => setFuelFor(null)} title={`Donner du carburant — ${fuelFor.label}`}
          footer={<><button className="btn btn-o" onClick={() => setFuelFor(null)}>Annuler</button><button className="btn btn-p" onClick={saveFuel} disabled={!(Number(FG.liters) > 0) || !FG.businessUnit || !FG.costCenter || giveFuel.isPending}>Enregistrer</button></>}>
          <div style={{ fontSize: '.74rem', color: 'var(--tm)', marginBottom: 8 }}>
            Véhicule ni loué ni propre — carburant fourni en cas de besoin. Cette consommation figure dans le reporting, imputée à la BU / au centre de coût.
          </div>
          <div className="form-r">
            <G label="Type carburant">
              <select value={FG.fuelType ?? 'GASOIL'} onChange={(e) => setFG({ ...FG, fuelType: e.target.value })}>
                {['GASOIL', 'SP', 'SUPER', 'GPL'].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </G>
            <G label="Nombre de litres"><input type="number" value={FG.liters ?? ''} onChange={(e) => setFG({ ...FG, liters: e.target.value })} /></G>
          </div>
          <div className="form-r">
            <G label="Date"><DateInput value={FG.date ?? ''} onChange={(e) => setFG({ ...FG, date: e.target.value })} /></G>
            <G label="Site / chantier (si applicable)">
              <select value={FG.siteCode ?? ''} onChange={(e) => setFG({ ...FG, siteCode: e.target.value })}>
                <option value="">— Aucun (hors cuve) —</option>
                {withCurrentSite(siteNames, FG.siteCode).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </G>
          </div>
          <BuCcSelect bu={FG.businessUnit} cc={FG.costCenter}
            onChange={(bu, cc) => setFG({ ...FG, businessUnit: bu, costCenter: cc })}
            buLabel="Business Unit *" ccLabel="Centre de coût *" noneLabel="— choisir —" />
          {FG.siteCode
            ? <div style={{ fontSize: '.7rem', color: 'var(--tm)' }}>Le carburant sort de la cuve du chantier « {FG.siteCode} » (elle se décrémente).</div>
            : <div style={{ fontSize: '.7rem', color: 'var(--a6)' }}>Sans site : sortie « hors cuve » (cas extrême) — tracée et valorisée au prix carburant courant, sans toucher un stock.</div>}
        </Modal>
      )}
    </>
  );
}

/* ─── Pointage quotidien & facturation horaire ─── */
function PointageTab() {
  const period = usePeriod();
  const pointage = useSitePointage();
  const assignments = useVehicleAssignments();
  const create = useCreate<any>('site-pointage');
  const remove = useConfirmedRemove('site-pointage', 'ce pointage');
  const importCsv = useImportSitePointage();

  const rows = (pointage.data ?? []).filter((p: any) => period.mode === 'cumul' || period.matches(p.date));
  const sites = [...new Set([
    ...(pointage.data ?? []).map((p: any) => p.siteCode),
    ...(assignments.data ?? []).map((a: any) => a.siteCode),
  ].filter(Boolean))] as string[];
  const [site, setSite] = useState('');
  const billing = useSiteBilling(site || undefined, period.mode === 'cumul' ? undefined : period.month);

  const summary = useSiteFuelSummary(site || undefined, period.month);

  const [F, setF] = useState<any>({ targetType: 'engin', unit: 'day', quantity: 1 });
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState('');

  const save = async () => {
    const miss = [!F.siteCode && 'site', !F.targetCode && 'engin / véhicule', !F.date && 'date'].filter(Boolean);
    if (miss.length) { toast.error(`Champs obligatoires : ${miss.join(', ')}`); return; }
    try {
      await create.mutateAsync({
        ...F,
        quantity: Number(F.quantity), fuelLiters: F.fuelLiters ? Number(F.fuelLiters) : null,
        kmStart: F.kmStart ? Number(F.kmStart) : null, kmEnd: F.kmEnd ? Number(F.kmEnd) : null,
        hoursStart: F.hoursStart ? Number(F.hoursStart) : null, hoursEnd: F.hoursEnd ? Number(F.hoursEnd) : null,
        dayPrice: F.dayPrice ? Number(F.dayPrice) : null,
      });
      setOpen(false);
      setF({ targetType: 'engin', unit: 'day', quantity: 1 });
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur');
    }
  };

  return (
    <div className="cc">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div><h3>Pointage quotidien site</h3><div className="sub">Jour ou fraction · prix jour → équivalent horaire (÷ 8 h).</div></div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <PeriodPicker period={period} />
          <button className="btn btn-p" onClick={() => setOpen(true)}>+ Pointage</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, margin: '10px 0', alignItems: 'center' }}>
        <span style={{ fontSize: '.72rem', color: 'var(--tm)' }}>Facturation site (par centre de coût) :</span>
        <select value={site} onChange={(e) => setSite(e.target.value)} style={{ padding: '4px 8px' }}>
          <option value="">Tous les sites</option>
          {sites.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      {(() => {
        const B = (billing.data ?? []) as any[];
        // Regroupement par centre de coût (retour DG « facturer par centre de coût et site »).
        const byCc: Record<string, any[]> = {};
        B.forEach((b) => { (byCc[[b.siteCode, b.ca || '(sans CC)'].join(' · ')] ??= []).push(b); });
        const tLbl = (t: string) => t === 'engin' ? 'engin' : t === 'external' ? 'externe' : 'véhicule';
        return (
          <div className="tw">
            <table>
              <thead><tr><th>Cible</th><th>Type</th><th>Jours</th><th>Heures</th><th>Carburant</th><th>Km</th><th>Montant (DA)</th></tr></thead>
              <tbody>
                {Object.entries(byCc).map(([cc, lines]) => {
                  const sub = lines.reduce((a, l) => ({ d: a.d + l.days, h: a.h + l.hours, f: a.f + l.fuelLiters, km: a.km + l.kmRun, amt: a.amt + l.amount }), { d: 0, h: 0, f: 0, km: 0, amt: 0 });
                  return (
                    <Fragment key={cc}>
                      <tr style={{ background: 'var(--s0)', fontWeight: 700 }}><td colSpan={7}>{cc}</td></tr>
                      {lines.map((b, i) => (
                        <tr key={cc + i}>
                          <td style={{ paddingLeft: 16 }}>{b.targetCode}</td>
                          <td><span className={`bg ${b.targetType === 'external' ? 'bg-a' : b.targetType === 'engin' ? 'bg-b' : 'bg-t'}`}>{tLbl(b.targetType)}</span></td>
                          <td>{b.days ? Math.round(b.days * 100) / 100 : '—'}</td><td>{b.hours || '—'}</td>
                          <td>{b.fuelLiters ? `${fk(b.fuelLiters)} L` : '—'}</td>
                          <td>{b.kmRun ? `${fk(b.kmRun)} km` : '—'}</td>
                          <td style={{ fontWeight: 600 }}>{fk(b.amount)} DA</td>
                        </tr>
                      ))}
                      <tr style={{ fontSize: '.74rem', color: 'var(--tm)' }}>
                        <td colSpan={2} style={{ paddingLeft: 16 }}>sous-total {cc}</td>
                        <td>{Math.round(sub.d * 100) / 100} j</td><td>{Math.round(sub.h)} h</td>
                        <td>{fk(sub.f)} L</td><td>{fk(sub.km)} km</td>
                        <td style={{ fontWeight: 700, color: 'var(--b6)' }}>{fk(Math.round(sub.amt))} DA</td>
                      </tr>
                    </Fragment>
                  );
                })}
                {!B.length && <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Aucune donnée pour la période</td></tr>}
              </tbody>
              {B.length > 0 && (
                <tfoot><tr style={{ background: 'var(--b0)', fontWeight: 700 }}>
                  <td colSpan={6}>TOTAL SITE</td><td style={{ color: 'var(--b6)' }}>{fk(Math.round(B.reduce((s, b) => s + b.amount, 0)))} DA</td>
                </tr></tfoot>
              )}
            </table>
          </div>
        );
      })()}

      <h3 style={{ marginTop: 18 }}>Consommation cumulée — missions + vie sur site ({period.label})</h3>
      <div className="sub" style={{ marginBottom: 6 }}>
        Véhicule léger : gasoil de l&apos;aller + du retour + de la vie sur site, rapporté aux km cumulés
        (km missions + différentiel compteur du pointage) → <b>L/100 km</b>, comparé à la norme.
        Engin : heures de fonctionnement × norme <b>L/h</b>.
      </div>
      {!site
        ? <div style={{ fontSize: '.74rem', color: 'var(--tm)', padding: '8px 0' }}>Choisis un site ci-dessus pour voir la consommation cumulée de ses véhicules / engins.</div>
        : (() => {
          const S = (summary.data?.items ?? []) as any[];
          const T = summary.data?.totals ?? { litres: 0, km: 0, heures: 0, nbAnomalie: 0, nbIncomplet: 0 };
          const vBadge = (v: string) => v === 'anomalie' ? 'bg-r' : v === 'incomplet' ? 'bg-a' : v === 'surveiller' ? 'bg-a' : 'bg-g';
          return (
            <div className="tw">
              <table>
                <thead><tr>
                  <th>Véhicule / engin</th><th>Mode</th><th>Litres cumulés</th>
                  <th>Km missions</th><th>Km site</th><th>Km / Heures cumulés</th>
                  <th>Conso réelle</th><th>Norme</th><th>Écart</th><th>Verdict</th>
                </tr></thead>
                <tbody>
                  {S.map((r) => (
                    <tr key={r.vehicleCode}>
                      <td style={{ fontWeight: 600 }}>{r.vehicleCode}<div style={{ fontSize: '.66rem', color: 'var(--tm)' }}>{r.label}{r.type ? ` · ${r.type}` : ''}</div></td>
                      <td style={{ fontSize: '.72rem' }}>{r.mode === 'heures' ? 'Heures (L/h)' : 'Km de km'}</td>
                      <td style={{ fontWeight: 600 }}>{fk(r.litresCumules)} L</td>
                      <td>{r.mode === 'heures' ? '—' : `${fk(r.kmMissions)} km`}</td>
                      <td>{r.mode === 'heures' ? '—' : `${fk(r.kmSite)} km`}</td>
                      <td style={{ fontWeight: 600 }}>{r.mode === 'heures' ? (r.hoursFait != null ? `${r.hoursFait} h` : '—') : (r.kmCumule != null ? `${fk(r.kmCumule)} km` : '—')}</td>
                      <td style={{ fontWeight: 600 }}>{r.consoCumulee != null ? `${r.consoCumulee} ${r.uniteNorme}` : '—'}</td>
                      <td>{r.norme != null ? `${r.norme} ${r.uniteNorme}` : '—'}</td>
                      <td style={{ fontWeight: 700, color: r.ecartPct == null ? 'var(--tm)' : r.ecartPct > 15 ? 'var(--r6)' : r.ecartPct > 5 ? 'var(--a6)' : 'var(--g6)' }}>
                        {r.ecartPct == null ? '—' : `${r.ecartPct > 0 ? '+' : ''}${r.ecartPct} %`}
                      </td>
                      <td><span className={`bg ${vBadge(r.verdict)}`}>{r.verdict}</span></td>
                    </tr>
                  ))}
                  {!S.length && <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Aucun véhicule / engin suivi sur ce site pour {period.label}</td></tr>}
                </tbody>
                {S.length > 0 && (
                  <tfoot><tr style={{ background: 'var(--b0)', fontWeight: 700 }}>
                    <td colSpan={2}>TOTAL SITE{T.nbAnomalie ? ` · ${T.nbAnomalie} anomalie(s)` : ''}{T.nbIncomplet ? ` · ${T.nbIncomplet} relevé(s) incomplet(s)` : ''}</td>
                    <td>{fk(T.litres)} L</td>
                    <td colSpan={2} />
                    <td>{fk(T.km)} km{T.heures ? ` · ${T.heures} h` : ''}</td>
                    <td colSpan={4} />
                  </tr></tfoot>
                )}
              </table>
            </div>
          );
        })()}

      <h3 style={{ marginTop: 16 }}>Lignes de pointage</h3>
      <div className="tw" style={{ marginTop: 6 }}>
        <table>
          <thead><tr><th>Date</th><th>Site</th><th>Cible</th><th>Unité</th><th>Qté</th><th>Carburant</th><th>Source</th><th /></tr></thead>
          <tbody>
            {rows.map((p: any) => (
              <tr key={p.id}>
                <td>{fd(p.date)}</td><td>{p.siteCode}</td><td>{p.targetType} · {p.targetCode}</td>
                <td>{p.unit === 'hour' ? 'Heure' : 'Jour'}</td><td>{p.quantity}</td>
                <td>{p.fuelLiters ? `${p.fuelLiters} L` : '—'}</td>
                <td><span className="bg">{p.source}</span></td>
                <td><button className="btn btn-o btn-sm" onClick={() => remove(p.id)}>Suppr.</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} style={{ textAlign: 'center', color: 'var(--tm)', padding: 12 }}>Aucun pointage</td></tr>}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 16 }}>
        <h3>Import CSV</h3>
        <div className="sub">Colonnes : siteCode,date,targetType,targetCode,unit,quantity,fuelLiters,kmStart,kmEnd,dayPrice</div>
        <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} style={{ width: '100%', marginTop: 6, fontFamily: 'monospace', fontSize: '.72rem' }} />
        <button className="btn btn-p" style={{ marginTop: 6 }} disabled={!csv.trim() || importCsv.isPending}
          onClick={async () => { const r = await importCsv.mutateAsync(csv); alert(`${r.imported} ligne(s) importée(s)`); setCsv(''); }}>
          Importer
        </button>
      </div>

      {open && (
        <Modal open onClose={() => setOpen(false)} title="Pointage site"
          footer={<><button className="btn btn-o" onClick={() => setOpen(false)}>Annuler</button><button className="btn btn-p" onClick={save} disabled={!F.siteCode || !F.targetCode || !F.date || create.isPending}>Enregistrer</button></>}>
          <div className="form-r">
            <G label="Site"><input value={F.siteCode ?? ''} onChange={(e) => setF({ ...F, siteCode: e.target.value })} /></G>
            <G label="Date"><DateInput value={F.date ?? ''} onChange={(e) => setF({ ...F, date: e.target.value })} /></G>
          </div>
          <div className="form-r">
            <G label="Type de cible">
              <select value={F.targetType} onChange={(e) => setF({ ...F, targetType: e.target.value })}>
                <option value="engin">Engin</option><option value="vehicle">Véhicule</option><option value="external">Externe</option>
              </select>
            </G>
            <G label="Code cible"><input value={F.targetCode ?? ''} onChange={(e) => setF({ ...F, targetCode: e.target.value })} /></G>
          </div>
          <div className="form-r">
            <G label="Unité">
              <select value={F.unit} onChange={(e) => setF({ ...F, unit: e.target.value })}>
                <option value="day">Jour (ou fraction)</option><option value="hour">Heure</option>
              </select>
            </G>
            <G label="Quantité"><input type="number" step="0.25" value={F.quantity} onChange={(e) => setF({ ...F, quantity: e.target.value })} /></G>
          </div>
          <div className="form-r">
            <G label="Prix jour (DZD)"><input type="number" value={F.dayPrice ?? ''} onChange={(e) => setF({ ...F, dayPrice: e.target.value })} /></G>
            <G label="Carburant consommé (L)"><input type="number" value={F.fuelLiters ?? ''} onChange={(e) => setF({ ...F, fuelLiters: e.target.value })} /></G>
          </div>
          <div className="form-r">
            <G label="Compteur h. début"><input type="number" value={F.hoursStart ?? ''} onChange={(e) => setF({ ...F, hoursStart: e.target.value })} /></G>
            <G label="Compteur h. fin"><input type="number" value={F.hoursEnd ?? ''} onChange={(e) => setF({ ...F, hoursEnd: e.target.value })} /></G>
          </div>
          <div className="form-r">
            <G label="Km début"><input type="number" value={F.kmStart ?? ''} onChange={(e) => setF({ ...F, kmStart: e.target.value })} /></G>
            <G label="Km fin"><input type="number" value={F.kmEnd ?? ''} onChange={(e) => setF({ ...F, kmEnd: e.target.value })} /></G>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ─── Contrôle des factures fournisseurs (véhicules / engins externes) ─── */
function FacturesExternesTab() {
  const months = monthOptions();
  const [month, setMonth] = useState(months[0].value);
  const [site, setSite] = useState('');
  const externals = useExternalVehicles();
  const control = useSiteExternalControl(site || undefined, month);
  const createInv = useCreate<any>('external-invoices');
  const updateInv = useUpdate<any>('external-invoices');
  const [edit, setEdit] = useState<any>(null);

  const sites = useMemo(
    () => [...new Set(((externals.data ?? []) as any[]).map((e) => e.siteCode).filter(Boolean))] as string[],
    [externals.data],
  );
  const rows = (control.data ?? []) as any[];

  const saveInvoice = async () => {
    const body = {
      externalCode: edit.externalCode, siteCode: edit.siteCode, month,
      invoicedQty: edit.invoicedQty === '' ? null : Number(edit.invoicedQty),
      invoicedUnit: edit.invoicedUnit || 'day',
      invoicedAmount: edit.invoicedAmount === '' ? null : Number(edit.invoicedAmount),
      invoiceRef: edit.invoiceRef || null, note: edit.note || null,
    };
    try {
      if (edit.invoiceId) await updateInv.mutateAsync({ id: edit.invoiceId, body });
      else await createInv.mutateAsync(body);
      toast.success('Facture fournisseur enregistrée');
      setEdit(null);
    } catch (e) {
      toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erreur');
    }
  };

  const tot = rows.reduce((a, r) => ({ exp: a.exp + (r.expected ?? 0), inv: a.inv + (r.invoicedAmount ?? 0) }), { exp: 0, inv: 0 });

  return (
    <div className="cc">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h3>Contrôle des factures fournisseurs</h3>
          <div className="sub">
            Pour chaque véhicule / engin <b>externe</b> : ce qu&apos;on a <b>pointé</b> × tarif convenu = montant attendu,
            comparé à la <b>facture réellement reçue</b> du fournisseur.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={month} onChange={(e) => setMonth(e.target.value)}>{months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select>
          <select value={site} onChange={(e) => setSite(e.target.value)}>
            <option value="">Tous les sites</option>
            {sites.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="tw" style={{ marginTop: 10 }}>
        <table>
          <thead><tr>
            <th>Externe / Fournisseur</th><th>Site</th><th>Tarif</th>
            <th>Jours pointés</th><th>Heures pointées</th><th>Carburant fourni (L)</th>
            <th>Montant attendu (DA)</th><th>Facturé (DA)</th><th>Écart (DA)</th><th />
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.externalCode + r.siteCode}>
                <td style={{ fontWeight: 600 }}>{r.label}<div style={{ fontSize: '.68rem', color: 'var(--tm)' }}>{r.supplier ?? '—'}</div></td>
                <td>{r.siteCode ?? '—'}</td>
                <td style={{ fontSize: '.74rem' }}>{r.unitRate != null ? `${fk(r.unitRate)} DA/${r.rateUnit === 'hour' ? 'h' : 'j'}` : <span style={{ color: 'var(--a6)' }}>non défini</span>}</td>
                <td>{r.pointedDays || '—'}</td>
                <td>{r.pointedHours || '—'}</td>
                <td>{r.pointedFuelLiters ? `${fk(r.pointedFuelLiters)} L` : '—'}</td>
                <td>{r.expected != null ? `${fk(r.expected)} DA` : '—'}</td>
                <td style={{ fontWeight: 600 }}>{r.invoicedAmount != null ? `${fk(r.invoicedAmount)} DA` : <span style={{ color: 'var(--tm)' }}>à saisir</span>}</td>
                <td style={{ fontWeight: 700, color: r.ecart == null ? 'var(--tm)' : Math.abs(r.ecart) < 1 ? 'var(--g6)' : r.ecart > 0 ? 'var(--r6)' : 'var(--a6)' }}>
                  {r.ecart == null ? '—' : `${r.ecart > 0 ? '+' : ''}${fk(r.ecart)} DA`}
                </td>
                <td><button className="btn btn-o btn-sm" onClick={() => setEdit({
                  externalCode: r.externalCode, siteCode: r.siteCode, label: r.label,
                  invoiceId: r.invoiceId, invoicedQty: r.invoicedQty ?? '', invoicedUnit: r.invoicedUnit ?? (r.rateUnit || 'day'),
                  invoicedAmount: r.invoicedAmount ?? '', invoiceRef: r.invoiceRef ?? '', expected: r.expected,
                })}>{r.invoiceId ? 'Modifier facture' : 'Saisir facture'}</button></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={10} style={{ textAlign: 'center', color: 'var(--tm)', padding: 16 }}>Aucun véhicule externe. Déclare-les dans « Parc site &amp; externes » et pointe-les.</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr style={{ background: 'var(--b0)', fontWeight: 700 }}>
              <td colSpan={6}>TOTAL</td>
              <td>{fk(Math.round(tot.exp))} DA</td>
              <td>{fk(Math.round(tot.inv))} DA</td>
              <td style={{ color: tot.inv - tot.exp > 0 ? 'var(--r6)' : 'var(--g6)' }}>{tot.inv - tot.exp > 0 ? '+' : ''}{fk(Math.round(tot.inv - tot.exp))} DA</td>
              <td />
            </tr></tfoot>
          )}
        </table>
      </div>

      {edit && (
        <Modal open onClose={() => setEdit(null)} title={`Facture fournisseur — ${edit.label} · ${month}`}
          footer={<><button className="btn btn-o" onClick={() => setEdit(null)}>Annuler</button><button className="btn btn-p" onClick={saveInvoice} disabled={createInv.isPending || updateInv.isPending}>Enregistrer</button></>}>
          {edit.expected != null && <div style={{ fontSize: '.74rem', color: 'var(--tm)', marginBottom: 8 }}>Montant attendu d&apos;après le pointage : <b>{fk(edit.expected)} DA</b>.</div>}
          <div className="form-r">
            <G label="Quantité facturée"><input type="number" value={edit.invoicedQty} onChange={(e) => setEdit({ ...edit, invoicedQty: e.target.value })} /></G>
            <G label="Unité">
              <select value={edit.invoicedUnit} onChange={(e) => setEdit({ ...edit, invoicedUnit: e.target.value })}>
                <option value="day">jours</option><option value="hour">heures</option>
              </select>
            </G>
          </div>
          <div className="form-r">
            <G label="Montant facturé (DA)"><input type="number" value={edit.invoicedAmount} onChange={(e) => setEdit({ ...edit, invoicedAmount: e.target.value })} /></G>
            <G label="N° de facture"><input value={edit.invoiceRef} onChange={(e) => setEdit({ ...edit, invoiceRef: e.target.value })} /></G>
          </div>
        </Modal>
      )}
    </div>
  );
}
