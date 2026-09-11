'use client';

import { useEffect, useRef } from 'react';

const gc = (p: string) =>
  typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(p).trim();

export interface BarDataset { label: string; values: number[]; colorVar: string }

interface Props {
  labels: string[];
  datasets: BarDataset[];
  unit?: string;
  height?: number;
}

/** Portage verbatim de v8 `drawBar`. */
export default function BarChart({ labels, datasets, unit = '', height = 210 }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);

  const allValues = datasets.flatMap((d) => d.values);
  const isEmpty = labels.length === 0 || allValues.length === 0 || allValues.every((v) => !v || v === 0);

  useEffect(() => {
    if (isEmpty) return;
    const cv = canvasRef.current;
    const tip = tipRef.current;
    if (!cv || !cv.parentElement) return;

    const draw = () => {
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = cv.parentElement!.getBoundingClientRect();
      const W = rect.width;
      const H = height;
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.width = W + 'px';
      cv.style.height = H + 'px';
      ctx.scale(dpr, dpr);
      const pad = { top: 14, right: 14, bottom: 32, left: 52 };
      const cW = W - pad.left - pad.right;
      const cH = H - pad.top - pad.bottom;
      const allV = datasets.flatMap((d) => d.values);
      const mx = Math.ceil((Math.max(...allV) * 1.1) / 10) * 10 || 100;
      const tm = gc('--tm');
      const bl = gc('--bl');
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + cH - (i / 4) * cH;
        ctx.strokeStyle = bl;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad.left, y);
        ctx.lineTo(W - pad.right, y);
        ctx.stroke();
        ctx.fillStyle = tm;
        ctx.font = '10px Inter,sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(Math.round((i / 4) * mx).toLocaleString('fr-FR'), pad.left - 6, y + 3);
      }
      const gW = cW / labels.length;
      const bW = Math.min(20, (gW - 10) / datasets.length);
      const gap = 2;
      const bp: { x: number; y: number; w: number; h: number; label: string; value: number; series: string; color: string }[] = [];
      datasets.forEach((ds, di) => {
        const col = gc(ds.colorVar);
        labels.forEach((l, li) => {
          const x = pad.left + li * gW + (gW - bW * datasets.length - gap * (datasets.length - 1)) / 2 + di * (bW + gap);
          const h = (ds.values[li] / mx) * cH;
          const y = pad.top + cH - h;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.roundRect(x, y, bW, h, [4, 4, 0, 0]);
          ctx.fill();
          bp.push({ x, y, w: bW, h, label: l, value: ds.values[li], series: ds.label, color: col });
          ctx.fillStyle = gc('--tp');
          ctx.font = '600 9px Inter,sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(ds.values[li].toLocaleString('fr-FR'), x + bW / 2, y - 4);
        });
      });
      ctx.fillStyle = tm;
      ctx.font = '10px Inter,sans-serif';
      ctx.textAlign = 'center';
      labels.forEach((l, i) => ctx.fillText(l, pad.left + i * gW + gW / 2, H - pad.bottom + 16));

      cv.onmousemove = (e) => {
        if (!tip) return;
        const r = cv.getBoundingClientRect();
        const mx2 = e.clientX - r.left;
        const my = e.clientY - r.top;
        const hit = bp.find((b) => mx2 >= b.x && mx2 <= b.x + b.w && my >= b.y && my <= b.y + b.h);
        if (hit) {
          tip.innerHTML = `<div class="tip-t">${hit.label}</div><div class="tip-r"><span class="d" style="background:${hit.color}"></span>${hit.series}<span class="tip-v">${hit.value.toLocaleString('fr-FR')}${unit ? ' ' + unit : ''}</span></div>`;
          tip.classList.add('vis');
          tip.style.left = hit.x + hit.w / 2 - 50 + 'px';
          tip.style.top = hit.y - 55 + 'px';
        } else {
          tip.classList.remove('vis');
        }
      };
      cv.onmouseleave = () => tip?.classList.remove('vis');
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv.parentElement);
    return () => ro.disconnect();
  }, [labels, datasets, unit, height, isEmpty]);

  if (isEmpty) {
    return (
      <div style={{ height, display: 'grid', placeItems: 'center', color: 'var(--tm)', fontSize: '.78rem', border: '1px dashed var(--bd)', borderRadius: 8 }}>
        Aucune donnée pour cette période
      </div>
    );
  }

  return (
    <div className="cw" ref={wrapRef}>
      <canvas ref={canvasRef} height={height} />
      <div className="tip" ref={tipRef} />
    </div>
  );
}
