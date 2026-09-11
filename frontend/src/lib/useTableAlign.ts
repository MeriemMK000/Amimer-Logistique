'use client';

import { useEffect } from 'react';

/**
 * Aligne à droite les colonnes numériques de tous les tableaux (chiffres, montants,
 * km, %, heures…) et force les chiffres tabulaires — demande DG « là où il y a des
 * chiffres : alignement à droite ». Progressif : ré-appliqué à chaque changement du DOM.
 */
const NUM_RE = /^[\s]*[−–-]?[\d][\d\s.,  ’']*\s*(?:%|DA|DZD|DZ|km|L|h|j|min|pts?|kg|T)?\s*$/i;

function isNumeric(txt: string): boolean {
  const t = txt.trim();
  if (!t || t === '—' || t === '-') return false;
  return NUM_RE.test(t) && /\d/.test(t);
}

function alignTable(table: HTMLTableElement) {
  const bodyRows = Array.from(table.tBodies[0]?.rows ?? []);
  if (bodyRows.length === 0) return;
  const sample = bodyRows.slice(0, 12);
  const colCount = Math.max(...sample.map((r) => r.cells.length), 0);

  for (let c = 0; c < colCount; c++) {
    let num = 0;
    let total = 0;
    for (const r of sample) {
      const cell = r.cells[c];
      if (!cell || cell.colSpan > 1) continue;
      const txt = cell.textContent ?? '';
      if (!txt.trim()) continue;
      total++;
      if (isNumeric(txt)) num++;
    }
    if (total >= 2 && num / total >= 0.6) {
      // colonne numérique -> aligner à droite header + cellules
      for (const r of Array.from(table.rows)) {
        const cell = r.cells[c];
        if (cell && cell.colSpan === 1) {
          cell.style.textAlign = 'right';
          cell.style.fontVariantNumeric = 'tabular-nums';
          cell.style.whiteSpace = 'nowrap';
        }
      }
    }
  }
  table.dataset.aligned = String(bodyRows.length);
}

/**
 * Boutons ‹ › toujours visibles (flottent au-dessus du tableau, hors du flux du scroll)
 * pour défiler un tableau large — certains navigateurs (barre de défilement « overlay »)
 * ne montrent aucun indice qu'il y a plus de colonnes à droite.
 * Demande DG : « je n'ai pas d'affichage pour faire le balayage ».
 */
function ensureScrollControls(tw: HTMLElement) {
  const host = tw.parentElement;
  if (!host) return;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';

  const top = `${tw.offsetTop + tw.offsetHeight / 2}px`;
  let left = host.querySelector<HTMLButtonElement>(':scope > .tw-scroll-btn--l');
  let right = host.querySelector<HTMLButtonElement>(':scope > .tw-scroll-btn--r');

  if (!left || !right) {
    const mk = (dir: -1 | 1, label: string, cls: string) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = label;
      btn.className = `tw-scroll-btn ${cls}`;
      btn.setAttribute('aria-label', dir < 0 ? 'Défiler vers la gauche' : 'Défiler vers la droite');
      btn.style.cssText = `
        position:absolute; transform:translateY(-50%);
        z-index:5; width:24px; height:24px; border-radius:50%; border:1px solid var(--bd);
        background:var(--sc); color:var(--tp); font-size:.78rem; cursor:pointer; opacity:0;
        box-shadow:0 1px 6px rgba(0,0,0,.22); display:grid; place-items:center;
        transition:opacity .15s; pointer-events:none;
      `;
      btn.addEventListener('click', () => tw.scrollBy({ left: dir * 260, behavior: 'smooth' }));
      return btn;
    };
    left = mk(-1, '‹', 'tw-scroll-btn--l');
    right = mk(1, '›', 'tw-scroll-btn--r');
    host.append(left, right);
    // Boutons discrets : visibles seulement au survol du tableau.
    const show = () => { for (const btn of [left!, right!]) if (btn.style.visibility !== 'hidden') { btn.style.opacity = '.85'; btn.style.pointerEvents = 'auto'; } };
    const hide = () => { for (const btn of [left!, right!]) { btn.style.opacity = '0'; btn.style.pointerEvents = 'none'; } };
    tw.addEventListener('mouseenter', show);
    tw.addEventListener('mouseleave', hide);
    left.addEventListener('mouseenter', show); right.addEventListener('mouseenter', show);
  }
  // La colonne d'actions est figée à droite → décaler le bouton › pour ne pas la recouvrir.
  const table = tw.querySelector('table');
  const lastTh = table?.tHead?.rows[0]?.cells;
  const frozenW = lastTh && lastTh.length ? lastTh[lastTh.length - 1].offsetWidth : 0;
  left.style.top = top;
  right.style.top = top;
  left.style.left = '4px';
  right.style.right = `${Math.max(4, frozenW + 6)}px`;
  // On ne montre le › que s'il reste des colonnes cachées à droite de la zone visible.
  const atEnd = tw.scrollLeft + tw.clientWidth >= tw.scrollWidth - frozenW - 4;
  right.style.visibility = atEnd ? 'hidden' : 'visible';
  const atStart = tw.scrollLeft <= 4;
  left.style.visibility = atStart ? 'hidden' : 'visible';
  if (!tw.dataset.scrollBound) {
    tw.dataset.scrollBound = '1';
    tw.addEventListener('scroll', () => {
      const fw = lastTh && lastTh.length ? lastTh[lastTh.length - 1].offsetWidth : 0;
      right!.style.visibility = (tw.scrollLeft + tw.clientWidth >= tw.scrollWidth - fw - 4) ? 'hidden' : 'visible';
      left!.style.visibility = (tw.scrollLeft <= 4) ? 'hidden' : 'visible';
    }, { passive: true });
  }
}

export function useTableAlign() {
  useEffect(() => {
    const root = document.querySelector('.content') ?? document.body;
    let raf = 0;
    let busy = false; // on ignore les mutations déclenchées par nos propres écritures DOM
    let mo: MutationObserver | null = null;

    const apply = () => {
      root.querySelectorAll('table').forEach((t) => {
        const rows = String(t.tBodies[0]?.rows.length ?? 0);
        if (t.dataset.aligned !== rows) alignTable(t as HTMLTableElement);
      });
      // Barre de défilement horizontale visible + boutons pour les tableaux qui débordent.
      root.querySelectorAll<HTMLElement>('.tw').forEach((tw) => {
        const table = tw.querySelector('table');
        // Forte hystérésis : `.tw--scroll` réduit la densité → le tableau rétrécit ; on ne
        // sort du mode scroll que s'il redevient TRÈS nettement plus étroit (évite l'oscillation).
        const already = tw.classList.contains('tw--scroll');
        const need = !!table && table.scrollWidth > tw.clientWidth + (already ? -60 : 6);
        if (need !== already) tw.classList.toggle('tw--scroll', need);
        if (need) ensureScrollControls(tw);
        const host = tw.parentElement;
        host?.querySelectorAll<HTMLElement>(':scope > .tw-scroll-btn').forEach((btn) => { btn.hidden = !need; });
      });
    };

    const run = () => {
      if (busy) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        busy = true;
        mo?.disconnect();
        try { apply(); } finally {
          mo?.observe(root, { childList: true, subtree: true });
          // Laisse le layout se stabiliser avant de ré-écouter les mutations.
          setTimeout(() => { busy = false; }, 60);
        }
      });
    };

    run();
    mo = new MutationObserver(run);
    mo.observe(root, { childList: true, subtree: true });
    window.addEventListener('resize', run);
    return () => { mo?.disconnect(); window.removeEventListener('resize', run); cancelAnimationFrame(raf); };
  }, []);
}
