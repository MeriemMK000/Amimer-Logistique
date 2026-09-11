'use client';

import { useEffect, useRef } from 'react';

const gc = (p: string) =>
  typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(p).trim();

export interface DonutSlice { label: string; value: number; colorVar: string }

interface Props {
  data: DonutSlice[];
  centerUnit?: string;
}

/** Portage de v8 `drawPie` (generalise : les tranches sont passees en props). */
export default function DonutChart({ data, centerUnit = 'véhicules' }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isEmpty = data.length === 0 || data.every((d) => !d.value || d.value === 0);

  useEffect(() => {
    if (isEmpty) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = 180 * dpr;
    cv.height = 180 * dpr;
    ctx.scale(dpr, dpr);
    const slices = data.map((d) => ({ ...d, color: gc(d.colorVar) }));
    const total = slices.reduce((s, d) => s + d.value, 0) || 1;
    const cx = 90;
    const cy = 90;
    const r = 72;
    const ir = 44;
    const sf = gc('--sc');
    let angle = -Math.PI / 2;
    slices.forEach((d) => {
      const sl = (d.value / total) * Math.PI * 2;
      const ga = 0.02;
      ctx.beginPath();
      ctx.arc(cx, cy, r, angle + ga, angle + sl - ga);
      ctx.arc(cx, cy, ir, angle + sl - ga, angle + ga, true);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      if (d.value > 0) {
        const mid = angle + sl / 2;
        const lx = cx + Math.cos(mid) * ((r + ir) / 2);
        const ly = cy + Math.sin(mid) * ((r + ir) / 2);
        ctx.fillStyle = '#fff';
        ctx.font = '700 10px Inter,sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(d.value), lx, ly);
      }
      angle += sl;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, ir - 1, 0, Math.PI * 2);
    ctx.fillStyle = sf;
    ctx.fill();
    ctx.fillStyle = gc('--tp');
    ctx.font = '700 22px "DM Sans",sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(total), cx, cy + 2);
    ctx.fillStyle = gc('--tm');
    ctx.font = '10px Inter,sans-serif';
    ctx.fillText(centerUnit, cx, cy + 16);
  }, [data, centerUnit, isEmpty]);

  const total = data.reduce((s, d) => s + d.value, 0) || 1;

  if (isEmpty) {
    return (
      <div style={{ height: 180, display: 'grid', placeItems: 'center', color: 'var(--tm)', fontSize: '.78rem', border: '1px dashed var(--bd)', borderRadius: 8 }}>
        Aucune donnée pour cette période
      </div>
    );
  }

  return (
    <div className="cw" style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
      <canvas
        ref={canvasRef}
        width={180}
        height={180}
        style={{ width: 180, height: 180, flexShrink: 0 }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.map((d) => (
          <div className="li" key={d.label}>
            <span className="ld" style={{ background: `var(${d.colorVar})` }} />
            <span style={{ minWidth: 60 }}>{d.label}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--tp)' }}>{d.value}</span>
            <span style={{ color: 'var(--tm)', marginLeft: 3 }}>({Math.round((d.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
