import type { EvalConfig } from '../types';

export const DEFAULT_EVAL_CONFIG: EvalConfig = {
  scale: 20,
  criteria: [
    { key: 'conduite', label: 'Conduite', weight: 30 },
    { key: 'accidentologie', label: 'Accidentologie', weight: 25 },
    { key: 'assiduite', label: 'Assiduité', weight: 15 },
    { key: 'materiel', label: 'État du matériel affecté', weight: 15 },
    { key: 'discretion', label: 'Discrétion', weight: 10 },
    { key: 'presentation', label: 'Présentation', weight: 5 },
  ],
};

/** Note finale pondérée à partir des notes par critère (sur `config.scale`). */
export function computeEvalScore(criteria: Record<string, number>, config: EvalConfig): number {
  const list = config.criteria ?? [];
  let sum = 0;
  let wTotal = 0;
  for (const c of list) {
    const v = Number(criteria[c.key]);
    if (Number.isNaN(v)) continue;
    sum += v * (c.weight || 0);
    wTotal += c.weight || 0;
  }
  if (wTotal === 0) return 0;
  return Math.round((sum / wTotal) * 100) / 100;
}

export function evalColor(score: number, scale: number): string {
  const pct = scale > 0 ? score / scale : 0;
  return pct >= 0.7 ? 'var(--g6)' : pct >= 0.5 ? 'var(--a6)' : 'var(--r6)';
}
