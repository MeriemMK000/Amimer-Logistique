'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { fd } from '@/lib/fleet/format';
import { api } from '@/lib/api/client';
import { DRIVER_DICT, fill, type DriverStrings, type Lang } from '@/lib/driverI18n';

const API = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');

const shell: React.CSSProperties = { minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', fontFamily: 'Inter,system-ui,sans-serif', padding: 16, maxWidth: 520, margin: '0 auto' };
const card: React.CSSProperties = { background: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 12 };
const btn: React.CSSProperties = { padding: '9px 12px', borderRadius: 8, border: 0, fontWeight: 700, fontSize: '.85rem', cursor: 'pointer' };
const input: React.CSSProperties = { width: '100%', padding: 9, borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0', fontSize: '.95rem' };

interface Mission { num: string; fromLoc: string; toLoc: string; status: string; dateStart: string; timeStart?: string; timeEnd?: string; dateEnd?: string; vehicleCode: string | null; distance?: number; driverAccepted?: boolean | null; pecRef?: string | null; ordreEmisAt?: string | null }
interface PlanDay { t: string; h1: string; h2: string }
interface Driver { code: string; name: string; status?: string; plan?: PlanDay[]; hoursWeek?: number; maxWeeklyHours?: number; workLocation?: string; vehicles?: string[] }
interface OtItem { num: string; vehicleCode: string | null; title: string | null; type: string | null; status: string | null; date: string | null; totalCost: number | null }
interface TireItem { id: string; type: string; toVehicle: string | null; fromVehicle: string | null; position: string | null; date: string; km: number | null }
interface Interventions { maintenance: OtItem[]; tires: TireItem[] }
interface KmReq { valeur: number | null; reservoir: number | null; fait: boolean }
interface KmRequest {
  vehicleCode: string; month: string; isEngin: boolean; requestedAt: string | null;
  debut: KmReq; fin: KmReq;
  kmStart?: number | null; hoursStart?: number | null;
}
interface Data { driver: Driver | null; missions: Mission[]; interventions?: Interventions; kmRequests?: KmRequest[] }

const ACT_COLOR: Record<string, string> = { MIS: '#2563eb', MNT: '#d97706', FRM: '#0d9488', TRP: '#7c3aed', REP: '#64748b', DIS: '#16a34a' };

export default function ChauffeurPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [lang, setLang] = useState<Lang>('ar');
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState('');
  const [declOpen, setDeclOpen] = useState<null | Mission>(null);
  const [ordreOpen, setOrdreOpen] = useState<null | Mission>(null);
  const [view, setView] = useState<'missions' | 'interventions' | 'planning'>('missions');

  useEffect(() => {
    try { const s = localStorage.getItem('driver-lang'); if (s === 'fr' || s === 'ar') setLang(s); } catch { /* ignore */ }
  }, []);
  const switchLang = () => setLang((l) => { const n = l === 'ar' ? 'fr' : 'ar'; try { localStorage.setItem('driver-lang', n); } catch { /* ignore */ } return n; });

  const t = DRIVER_DICT[lang];
  const rtl = lang === 'ar';

  const load = useCallback(() => {
    api.get(`/driver/${token}`).then((r) => setData(r.data)).catch((e) => setErr(e?.response?.data?.message || 'x'));
  }, [token]);
  useEffect(load, [load]);

  const phase = async (num: string, p: 'start' | 'finish') => { await api.patch(`/driver/${token}/missions/${num}/${p}`); load(); };
  const accept = async (num: string) => { await api.patch(`/driver/${token}/missions/${num}/accept`); load(); };
  const validateOt = async (num: string) => { await api.patch(`/driver/${token}/ot/${num}/validate`); load(); };
  const validateTire = async (id: string) => { await api.patch(`/driver/${token}/tire-movement/${id}/validate`); load(); };

  const LangBtn = (
    <button onClick={switchLang} style={{ ...btn, background: '#334155', color: '#fff', fontSize: '.78rem', padding: '6px 12px' }}>
      {t.langBtn}
    </button>
  );

  if (err) return (
    <div style={shell} dir={t.dir}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>{LangBtn}</div>
      <div style={{ ...card, textAlign: 'center' }}><div style={{ fontSize: '2.5rem' }}></div><p>{t.invalidLink}</p></div>
    </div>
  );
  if (!data) return <div style={shell} dir={t.dir}><div style={{ display: 'flex', justifyContent: 'flex-end' }}>{LangBtn}</div><p>{t.loading}</p></div>;

  const d = data.driver;
  const toValidate = data.missions.filter((m) => m.status === 'PLANIFIEE' && !m.driverAccepted);
  const iv = data.interventions ?? { maintenance: [], tires: [] };
  const ivCount = iv.maintenance.length + iv.tires.length;
  const kmRequests = data.kmRequests ?? [];

  return (
    <div style={shell} dir={t.dir}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div>
          <h2 style={{ margin: '4px 0 2px' }}>{t.hello} {d?.name ?? t.driver}</h2>
          <p style={{ fontSize: '.78rem', color: '#94a3b8', marginBottom: 10 }}>
            {d?.hoursWeek ?? 0} {fill(t.weekHours, { max: d?.maxWeeklyHours ?? 48 })}
            {d?.vehicles?.length ? ` · ${t.vehicle} ${d.vehicles.join(', ')}` : ''}
          </p>
        </div>
        {LangBtn}
      </div>

      {kmRequests.length > 0 && (
        <KmDeclarationCard token={token} t={t} requests={kmRequests} onDone={load} />
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {([
          ['missions', `${t.tabMissions}${toValidate.length ? ` (${toValidate.length})` : ''}`],
          ['interventions', `${t.tabInterventions}${ivCount ? ` (${ivCount})` : ''}`],
          ['planning', t.tabPlanning],
        ] as const).map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            style={{ ...btn, flex: 1, fontSize: '.72rem', background: view === v ? '#2563eb' : '#334155', color: '#fff' }}>
            {label}
          </button>
        ))}
      </div>

      {view === 'planning' && (
        <div style={card}>
          <b style={{ fontSize: '.9rem' }}>{t.weekPlan}</b>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(d?.plan ?? []).map((p, i) => {
              const label = t.act[p.t] ?? p.t ?? '—';
              const c = ACT_COLOR[p.t] ?? '#475569';
              return (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '.8rem' }}>
                  <span style={{ width: 54, color: '#94a3b8' }}>{t.days[i] ?? `J${i}`}</span>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: c, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>{label}</span>
                  <span style={{ color: '#94a3b8' }}>{p.h1 && p.h2 ? `${p.h1} – ${p.h2}` : ''}</span>
                </div>
              );
            })}
            {!(d?.plan ?? []).length && <p style={{ color: '#94a3b8', fontSize: '.8rem' }}>{t.noPlan}</p>}
          </div>
        </div>
      )}

      {view === 'interventions' && (
        <>
          <p style={{ fontSize: '.75rem', color: '#94a3b8', marginBottom: 8 }}>{t.ivIntro}</p>
          {ivCount === 0 && <div style={card}>{t.ivNone}</div>}
          {iv.maintenance.map((o) => (
            <div key={o.num} style={{ ...card, borderInlineStart: '3px solid #d97706' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>{o.num}</b><span style={{ fontSize: '.7rem', color: '#94a3b8' }}>{fd(o.date)}</span>
              </div>
              <div style={{ margin: '6px 0', fontSize: '.88rem' }}>{o.title}</div>
              <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>{o.vehicleCode} · {o.type} · {o.status}{o.totalCost ? ` · ${o.totalCost.toLocaleString('fr-FR')} DA` : ''}</div>
              <button style={{ ...btn, background: '#16a34a', color: '#fff', marginTop: 10 }} onClick={() => validateOt(o.num)}>{t.ivValidate}</button>
            </div>
          ))}
          {iv.tires.map((tr) => (
            <div key={tr.id} style={{ ...card, borderInlineStart: '3px solid #7c3aed' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>{tr.type === 'transfert' ? t.tireTransfer : t.tireMount}</b><span style={{ fontSize: '.7rem', color: '#94a3b8' }}>{tr.date}</span>
              </div>
              <div style={{ margin: '6px 0', fontSize: '.85rem' }}>
                {fill(t.tirePos, { p: tr.position ?? '—', v: tr.toVehicle ?? '' })}{tr.fromVehicle ? fill(t.tireFrom, { f: tr.fromVehicle }) : ''}
              </div>
              <div style={{ fontSize: '.75rem', color: '#94a3b8' }}>{tr.km ? `${tr.km.toLocaleString('fr-FR')} ${t.km}` : ''}</div>
              <button style={{ ...btn, background: '#16a34a', color: '#fff', marginTop: 10 }} onClick={() => validateTire(tr.id)}>{t.tireValidate}</button>
            </div>
          ))}
        </>
      )}

      {view === 'missions' && (
        <>
          {toValidate.length > 0 && (
            <div style={{ ...card, borderInlineStart: '3px solid #f59e0b' }}>
              <b style={{ fontSize: '.85rem' }}>{t.toValidateTitle}</b>
              <p style={{ fontSize: '.75rem', color: '#94a3b8', margin: '4px 0 8px' }}>{t.toValidateSub}</p>
              {toValidate.map((m) => (
                <div key={m.num} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: '.8rem' }}>{m.num} · {m.fromLoc} → {m.toLoc} · {fd(m.dateStart)}</span>
                  <button style={{ ...btn, background: '#16a34a', color: '#fff', fontSize: '.72rem', padding: '6px 10px' }} onClick={() => accept(m.num)}>{t.iValidate}</button>
                </div>
              ))}
            </div>
          )}

          {data.missions.length === 0 && <div style={card}>{t.noMission}</div>}
          {data.missions.map((m) => (
            <div key={m.num} style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>{m.num}{m.pecRef ? ` · ${m.pecRef}` : ''}</b>
                <span style={{ fontSize: '.72rem', padding: '2px 8px', borderRadius: 20, background: m.status === 'EN_COURS' ? '#166534' : m.status === 'TERMINEE' ? '#92400e' : '#1d4ed8' }}>{t.status[m.status] ?? m.status}</span>
              </div>
              <div style={{ margin: '6px 0', fontSize: '.9rem' }}>{m.fromLoc} → {m.toLoc}</div>
              <div style={{ fontSize: '.78rem', color: '#94a3b8' }}>{fd(m.dateStart)} {m.timeStart ?? ''} · {m.vehicleCode ?? '—'} · {m.distance ?? '?'} {t.km}</div>
              {m.driverAccepted && <div style={{ fontSize: '.7rem', color: '#22c55e', marginTop: 3 }}>{t.validatedByYou}</div>}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                {m.status === 'PLANIFIEE' && !m.driverAccepted && <button style={{ ...btn, background: '#16a34a', color: '#fff' }} onClick={() => accept(m.num)}>{t.iValidate}</button>}
                {m.status === 'PLANIFIEE' && m.driverAccepted && <button style={{ ...btn, background: '#16a34a', color: '#fff' }} onClick={() => phase(m.num, 'start')}>{t.start}</button>}
                {m.status === 'EN_COURS' && <button style={{ ...btn, background: '#d97706', color: '#fff' }} onClick={() => phase(m.num, 'finish')}>{t.finish}</button>}
                {(m.ordreEmisAt || m.status === 'EN_COURS' || m.status === 'TERMINEE') && (
                  <button style={{ ...btn, background: '#334155', color: '#fff' }} onClick={() => setOrdreOpen(m)}>{t.ordreBtn}</button>
                )}
                <button style={{ ...btn, background: '#7f1d1d', color: '#fff' }} onClick={() => setDeclOpen(m)}>{t.declare}</button>
              </div>
            </div>
          ))}
        </>
      )}

      {declOpen && (
        <DeclarationSheet token={token} mission={declOpen} t={t} onClose={() => setDeclOpen(null)} onDone={() => { setDeclOpen(null); load(); }} />
      )}
      {ordreOpen && (
        <OrdreSheet token={token} mission={ordreOpen} t={t} onClose={() => setOrdreOpen(null)} />
      )}
    </div>
  );
}

/* ─── Ordre de mission (retour DG : émis au démarrage, reçu systématiquement par le chauffeur) ─── */
function OrdreSheet({ token, mission, t, onClose }: { token: string; mission: Mission; t: DriverStrings; onClose: () => void }) {
  const [o, setO] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    api.get(`/driver/${token}/missions/${mission.num}/ordre`)
      .then((r) => setO(r.data?.ok === false ? null : r.data))
      .catch(() => setErr(true));
  }, [token, mission.num]);

  const row = (k: string, v: React.ReactNode) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '5px 0', borderBottom: '1px solid #334155', fontSize: '.82rem' }}>
      <span style={{ color: '#94a3b8' }}>{k}</span><span style={{ textAlign: 'end', fontWeight: 600 }}>{v}</span>
    </div>
  );
  const g = (o ?? {}) as Record<string, any>;
  const wp = (g.waypoints ?? []) as string[];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center', padding: 12, zIndex: 100 }} onClick={onClose}>
      <div style={{ ...card, maxWidth: 460, width: '100%', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <b style={{ fontSize: '1rem' }}>{t.ordreTitle} {mission.num}</b>
          <button style={{ ...btn, background: '#334155', color: '#fff', padding: '4px 10px' }} onClick={onClose}>{t.close}</button>
        </div>
        {err || !o ? (
          <p style={{ color: '#94a3b8', fontSize: '.85rem' }}>{t.ordreNotYet}</p>
        ) : (
          <>
            {row(t.ordreRoute, `${g.fromLoc}${wp.length ? ` → ${wp.join(' → ')}` : ''} → ${g.toLoc}`)}
            {row(t.ordreDates, `${fd(g.dateStart)} ${g.timeStart ?? ''} → ${fd(g.dateEnd)} ${g.timeEnd ?? ''}`)}
            {row(t.ordreDuration, `${g.dureeH ?? '—'} h`)}
            {row(t.ordreDriver, `${g.driver?.name ?? g.driver?.code ?? '—'}${g.driver?.phone ? ` (${g.driver.phone})` : ''}`)}
            {row(t.ordreVehicle, `${g.vehicle?.code ?? '—'} ${g.vehicle?.brand ?? ''} ${g.vehicle?.model ?? ''} ${g.vehicle?.plate ? `— ${g.vehicle.plate}` : ''}`)}
            {row(t.ordreDistance, `${g.distance ?? '—'} ${t.km}`)}
            {row(t.ordreFrais, g.fraisApplicable ? 'oui' : '—')}
            {g.qr && (
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={g.qr as string} alt="QR" width={150} height={150} style={{ background: '#fff', borderRadius: 8, padding: 4 }} />
                <div style={{ fontSize: '.68rem', color: '#94a3b8', marginTop: 4 }}>{t.ordreScan}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

type T = DriverStrings;

/* ─── Relevé km demandé par le bureau (retour DG : automatique + rouge tant que non renseigné) ─── */
function KmDeclarationCard({ token, t, requests, onDone }: { token: string; t: T; requests: KmRequest[]; onDone: () => void }) {
  return (
    <div style={{ ...card, border: '2px solid #ef4444', background: '#3f1d1d' }}>
      <b style={{ fontSize: '.92rem' }}>{t.kmRequestTitle}</b>
      <p style={{ fontSize: '.76rem', color: '#fecaca', margin: '6px 0 10px' }}>{t.kmRequestSub}</p>
      {requests.map((r) => <KmRequestRow key={`${r.vehicleCode}-${r.month}`} token={token} t={t} r={r} onDone={onDone} />)}
    </div>
  );
}

/** Une des deux étapes du relevé (début OU fin) — compteur + réservoir. */
function KmPhaseForm({ token, t, r, phase, onDone }: { token: string; t: T; r: KmRequest; phase: 'debut' | 'fin'; onDone: () => void }) {
  const p = r[phase];
  const [val, setVal] = useState(p.valeur != null ? String(p.valeur) : '');
  const [res, setRes] = useState(p.reservoir != null ? String(p.reservoir) : '');
  const [photoId, setPhotoId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const onPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const fd = new FormData();
    fd.append('file', f, f.name);
    fd.append('entityType', 'km-reading');
    fd.append('entityId', `${r.vehicleCode}-${r.month}-${phase}`);
    fd.append('kind', 'odometer');
    const rr = await fetch(`${API}/attachments`, { method: 'POST', body: fd });
    const j = await rr.json();
    setPhotoId(j?.data?.id ?? j?.id ?? null);
  };

  const send = async () => {
    const n = Number(val); const rv = Number(res);
    if (!n || !rv) { setErr(t.kmRequired); return; }
    setErr(''); setBusy(true);
    try {
      await api.patch(`/driver/${token}/km-declaration`, {
        vehicleCode: r.vehicleCode, month: r.month, phase,
        [r.isEngin ? 'hours' : 'km']: n, tank: rv,
        photoId: photoId ?? undefined,
      });
      onDone();
    } catch (e) {
      setErr((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'x');
    } finally { setBusy(false); }
  };

  return (
    <div style={{ border: `1px solid ${p.fait ? '#166534' : '#475569'}`, borderRadius: 8, padding: 10, marginTop: 8 }}>
      <div style={{ fontSize: '.78rem', fontWeight: 700, color: p.fait ? '#22c55e' : '#fbbf24', marginBottom: 6 }}>
        {phase === 'debut' ? t.kmReleveDebut : t.kmReleveFin} {p.fait && `· ${t.kmDejaFait}`}
      </div>
      <label style={{ fontSize: '.72rem', color: '#cbd5e1' }}>{r.isEngin ? t.kmCurrentHours : t.kmCurrentReading}</label>
      <input type="number" inputMode="numeric" value={val} onChange={(e) => setVal(e.target.value)} style={{ ...input, marginTop: 3 }} />
      <label style={{ fontSize: '.72rem', color: '#cbd5e1', marginTop: 6, display: 'block' }}>{t.kmReservoir}</label>
      <input type="number" inputMode="numeric" value={res} onChange={(e) => setRes(e.target.value)} style={{ ...input, marginTop: 3 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ ...btn, background: '#334155', color: '#fff', fontSize: '.74rem' }}>
          {t.kmPhotoOpt}
          <input type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
        </label>
        {photoId && <span style={{ fontSize: '.72rem', color: '#22c55e' }}>✓</span>}
      </div>
      {err && <div style={{ fontSize: '.74rem', color: '#fca5a5', marginTop: 6 }}>{err}</div>}
      <button style={{ ...btn, background: p.fait ? '#334155' : '#16a34a', color: '#fff', marginTop: 8, width: '100%' }} disabled={busy || !val || !res} onClick={send}>
        {busy ? t.sending : t.kmSend}
      </button>
    </div>
  );
}

function KmRequestRow({ token, t, r, onDone }: { token: string; t: T; r: KmRequest; onDone: () => void }) {
  return (
    <div style={{ background: '#1e293b', borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '.82rem' }}>
        <b>{r.vehicleCode}{r.isEngin ? ` · ${t.engin}` : ''}</b>
        <span style={{ color: '#94a3b8' }}>{t.kmMonthLabel} {r.month}</span>
      </div>
      <KmPhaseForm token={token} t={t} r={r} phase="debut" onDone={onDone} />
      <KmPhaseForm token={token} t={t} r={r} phase="fin" onDone={onDone} />
    </div>
  );
}

function DeclarationSheet({ token, mission, t, onClose, onDone }: { token: string; mission: Mission; t: T; onClose: () => void; onDone: () => void }) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<'panne' | 'anomalie'>('panne');
  const [files, setFiles] = useState<{ id: string; label: string }[]>([]);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const upload = async (blob: Blob, filename: string, kindTag: string) => {
    const fd = new FormData();
    fd.append('file', blob, filename);
    fd.append('entityType', 'driver-report');
    fd.append('entityId', token.slice(0, 12));
    fd.append('kind', kindTag);
    const res = await fetch(`${API}/attachments`, { method: 'POST', body: fd });
    const j = await res.json();
    const id = j?.data?.id ?? j?.id;
    if (id) setFiles((f) => [...f, { id, label: filename }]);
  };

  const startRec = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunks.current = [];
    mr.ondataavailable = (e) => chunks.current.push(e.data);
    mr.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm' });
      upload(blob, `memo-${Date.now()}.webm`, 'voice');
      stream.getTracks().forEach((tr) => tr.stop());
    };
    mr.start();
    recRef.current = mr;
    setRecording(true);
  };
  const stopRec = () => { recRef.current?.stop(); setRecording(false); };

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) upload(f, f.name, 'photo');
  };

  const send = async () => {
    setBusy(true);
    try {
      await api.post(`/driver/${token}/declaration`, {
        missionNum: mission.num, vehicleCode: mission.vehicleCode, kind, text,
        attachmentIds: files.map((f) => f.id),
      });
      onDone();
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'end center', zIndex: 50 }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#1e293b', width: '100%', maxWidth: 520, borderRadius: '16px 16px 0 0', padding: 18 }} dir={t.dir}>
        <h3 style={{ marginTop: 0 }}>{t.declTitle} — {mission.num}</h3>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {(['panne', 'anomalie'] as const).map((k) => (
            <button key={k} style={{ ...btn, background: kind === k ? '#2563eb' : '#334155', color: '#fff' }} onClick={() => setKind(k)}>{k === 'panne' ? t.breakdown : t.anomaly}</button>
          ))}
        </div>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder={t.declDescribe}
          style={{ width: '100%', padding: 8, borderRadius: 8, border: '1px solid #475569', background: '#0f172a', color: '#e2e8f0' }} />

        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {!recording
            ? <button style={{ ...btn, background: '#0ea5e9', color: '#fff' }} onClick={startRec}>{t.voiceMemo}</button>
            : <button style={{ ...btn, background: '#dc2626', color: '#fff' }} onClick={stopRec}>{t.stopRec}</button>}
          <label style={{ ...btn, background: '#334155', color: '#fff' }}>
            {t.photo}
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} style={{ display: 'none' }} />
          </label>
        </div>
        {files.length > 0 && (
          <ul style={{ fontSize: '.75rem', color: '#94a3b8', marginTop: 8 }}>
            {files.map((f) => <li key={f.id}>{f.label}</li>)}
          </ul>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button style={{ ...btn, background: '#334155', color: '#fff', flex: 1 }} onClick={onClose}>{t.cancel}</button>
          <button style={{ ...btn, background: '#16a34a', color: '#fff', flex: 2 }} disabled={busy || (!text && !files.length)} onClick={send}>
            {busy ? t.sending : t.sendOt}
          </button>
        </div>
      </div>
    </div>
  );
}
