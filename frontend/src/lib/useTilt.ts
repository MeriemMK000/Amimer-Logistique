'use client';

import { useEffect } from 'react';

/**
 * Effet 3D léger : les cartes KPI (`.sc`) s'inclinent doucement vers le curseur.
 * Monté une seule fois dans le Shell — écoute globale, pas de wrapper par carte.
 * Respecte `prefers-reduced-motion` et ignore le tactile.
 */
export function useTilt() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mqTouch = window.matchMedia('(hover: none)');
    if (mqReduce.matches || mqTouch.matches) return;

    const MAX = 4; // degrés
    let cur: HTMLElement | null = null;
    let raf = 0;

    const reset = (el: HTMLElement | null) => {
      if (!el) return;
      el.classList.remove('tilting');
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
    };

    const onMove = (e: PointerEvent) => {
      const card = (e.target as HTMLElement | null)?.closest<HTMLElement>('.sc:not(.no-tilt)') ?? null;
      if (card !== cur) { reset(cur); cur = card; }
      if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        card.style.setProperty('--ry', `${(px * MAX * 2).toFixed(2)}deg`);
        card.style.setProperty('--rx', `${(-py * MAX * 2).toFixed(2)}deg`);
        card.classList.add('tilting');
      });
    };
    const onLeaveWindow = () => { reset(cur); cur = null; };

    document.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('blur', onLeaveWindow);
    document.addEventListener('scroll', onLeaveWindow, { passive: true, capture: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      window.removeEventListener('blur', onLeaveWindow);
      document.removeEventListener('scroll', onLeaveWindow, true);
      cancelAnimationFrame(raf);
      reset(cur);
    };
  }, []);
}
