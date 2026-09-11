'use client';

import { useEffect, useRef } from 'react';

const gc = (p: string) =>
  typeof window === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(p).trim();

interface Props {
  labels: string[];
  values: number[];
  norm: number[];
  height?: number;
}

/** Portage de v8 drawCtrlChart (courbe conso réelle vs norme). */
export default function LineChart({ labels, values, norm, height = 220 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv || !cv.parentElement) return;
    const draw = () => {
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const W = cv.parentElement!.getBoundingClientRect().width;
      const H = height;
      cv.width = W * dpr; cv.height = H * dpr;
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      ctx.scale(dpr, dpr);
      const pad = { top: 14, right: 14, bottom: 32, left: 52 };
      const cW = W - pad.left - pad.right;
      const cH = H - pad.top - pad.bottom;
      const mx = Math.ceil((Math.max(...values, ...norm) * 1.3) / 5) * 5 || 30;
      const tm = gc('--tm');
      const bl = gc('--bl');
      for (let i = 0; i <= 4; i++) {
        const y = pad.top + cH - (i / 4) * cH;
        ctx.strokeStyle = bl; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(W - pad.right, y); ctx.stroke();
        ctx.fillStyle = tm; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'right';
        ctx.fillText(((i / 4) * mx).toFixed(0), pad.left - 6, y + 3);
      }
      const X = (i: number) => pad.left + i * (cW / (labels.length - 1 || 1));
      const Y = (v: number) => pad.top + cH - (v / mx) * cH;

      ctx.strokeStyle = gc('--c3'); ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
      ctx.beginPath();
      norm.forEach((v, i) => (i === 0 ? ctx.moveTo(X(i), Y(v)) : ctx.lineTo(X(i), Y(v))));
      ctx.stroke(); ctx.setLineDash([]);

      ctx.strokeStyle = gc('--c1'); ctx.lineWidth = 2.5;
      ctx.beginPath();
      const pts = values.map((v, i) => ({ x: X(i), y: Y(v) }));
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
      if (pts.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pad.top + cH);
        pts.forEach((p) => ctx.lineTo(p.x, p.y));
        ctx.lineTo(pts[pts.length - 1].x, pad.top + cH);
        ctx.closePath();
        ctx.fillStyle = gc('--c1') + '20';
        ctx.fill();
      }
      pts.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = values[i] > norm[i] * 1.15 ? gc('--r6') : values[i] > norm[i] * 1.05 ? gc('--a6') : gc('--g6');
        ctx.fill();
        ctx.fillStyle = gc('--tp'); ctx.font = '600 9px Inter,sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(values[i].toFixed(1), p.x, p.y - 10);
      });
      ctx.fillStyle = tm; ctx.font = '10px Inter,sans-serif'; ctx.textAlign = 'center';
      labels.forEach((l, i) => ctx.fillText(l, X(i), H - pad.bottom + 16));
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv.parentElement);
    return () => ro.disconnect();
  }, [labels, values, norm, height]);

  return (
    <div className="cw">
      <canvas ref={canvasRef} height={height} />
    </div>
  );
}
