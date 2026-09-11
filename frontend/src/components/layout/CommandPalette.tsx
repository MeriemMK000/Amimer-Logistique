'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NAV } from '@/lib/nav';
import { useDpcRequests, useDrivers, useMaintenanceOrders, useMissions, useVehicles } from '@/lib/api/hooks';

interface CmdItem { id: string; title: string; sub: string; group: string; href: string }

const searchSvg = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const vehicles = useVehicles();
  const drivers = useDrivers();
  const missions = useMissions();
  const dpc = useDpcRequests();
  const maint = useMaintenanceOrders();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('fleet:open-search', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('fleet:open-search', onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      const t = setTimeout(() => inputRef.current?.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [open]);

  const all: CmdItem[] = useMemo(() => {
    const nav: CmdItem[] = NAV.map((n) => ({ id: `nav-${n.slug}`, title: n.label, sub: 'Ouvrir la page', group: 'Navigation', href: n.href }));
    const v: CmdItem[] = (vehicles.data ?? []).map((x) => ({
      id: `v-${x.code}`, title: `${x.code} — ${x.brand} ${x.model}`,
      sub: [x.plate, x.genre, x.status, x.siteBase].filter(Boolean).join(' · '), group: 'Véhicules', href: '/flotte',
    }));
    const d: CmdItem[] = (drivers.data ?? []).map((x) => ({
      id: `d-${x.code}`, title: x.name, sub: [x.code, x.license, x.status].filter(Boolean).join(' · '), group: 'Chauffeurs', href: '/chauffeurs',
    }));
    const m: CmdItem[] = (missions.data ?? []).map((x) => ({
      id: `m-${x.num}`, title: `${x.num} — ${x.fromLoc} → ${x.toLoc}`,
      sub: [x.status, x.dateStart, x.vehicleCode].filter(Boolean).join(' · '), group: 'Missions', href: '/missions',
    }));
    const p: CmdItem[] = (dpc.data ?? []).map((x) => ({
      id: `p-${x.code}`, title: `${x.code} — ${x.depAller ?? '?'} → ${x.destAller ?? '?'}`,
      sub: [x.statut, x.structure].filter(Boolean).join(' · '), group: 'Demandes PEC', href: '/demandes-pec',
    }));
    const o: CmdItem[] = (maint.data ?? []).map((x) => ({
      id: `o-${x.num}`, title: `${x.num} — ${x.title ?? ''}`,
      sub: [x.vehicleCode, x.status, x.type].filter(Boolean).join(' · '), group: 'Ordres de travail', href: '/maintenance',
    }));
    return [...nav, ...v, ...d, ...m, ...p, ...o];
  }, [vehicles.data, drivers.data, missions.data, dpc.data, maint.data]);

  const results: CmdItem[] = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return all.filter((i) => i.group === 'Navigation');
    const toks = s.split(/\s+/);
    return all
      .map((i) => {
        const hay = `${i.title} ${i.sub} ${i.group}`.toLowerCase();
        if (!toks.every((t) => hay.includes(t))) return null;
        return { i, score: hay.indexOf(toks[0]) + (i.group === 'Navigation' ? 0 : 1) };
      })
      .filter((x): x is { i: CmdItem; score: number } => x !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, 40)
      .map((x) => x.i);
  }, [q, all]);

  useEffect(() => { setIdx(0); }, [q]);

  if (!open) return null;

  const go = (it?: CmdItem) => {
    if (!it) return;
    setOpen(false);
    router.push(it.href);
  };

  const groups: Record<string, CmdItem[]> = {};
  for (const r of results) (groups[r.group] ??= []).push(r);
  let flat = -1;

  return (
    <div className="cmdk-ov" onMouseDown={() => setOpen(false)}>
      <div className="cmdk" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-label="Recherche rapide">
        <div className="cmdk-in">
          <span className="cmdk-ic">{searchSvg}</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un véhicule, chauffeur, mission, OT, page…"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(i + 1, results.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); go(results[idx]); }
            }}
          />
          <kbd className="cmdk-esc">Esc</kbd>
        </div>
        <div className="cmdk-list">
          {results.length === 0 && <div className="cmdk-empty">Aucun résultat pour « {q} »</div>}
          {Object.entries(groups).map(([g, items]) => (
            <div key={g} className="cmdk-sec">
              <div className="cmdk-grp">{g}</div>
              {items.map((it) => {
                flat += 1;
                const my = flat;
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`cmdk-it${my === idx ? ' sel' : ''}`}
                    onMouseEnter={() => setIdx(my)}
                    onClick={() => go(it)}
                  >
                    <span className="cmdk-t">{it.title}</span>
                    {it.sub && <span className="cmdk-s">{it.sub}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="cmdk-ft">
          <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
          <span><kbd>↵</kbd> ouvrir</span>
          <span><kbd>⌘</kbd><kbd>K</kbd> basculer</span>
        </div>
      </div>
    </div>
  );
}
