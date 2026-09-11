'use client';

import { useBusinessUnits } from '@/lib/api/hooks';

/**
 * Couple de listes déroulantes « Business Unit » + « Centre de coût » alimentées par le
 * référentiel `business_units` (retour DG : tout ce qui sert à la refacturation doit
 * pointer sur ce référentiel, plus de texte libre).
 * Le centre de coût dépend de la BU choisie ; il se réinitialise si on change de BU.
 */
export default function BuCcSelect({
  bu, cc, onChange,
  buLabel = 'Business Unit', ccLabel = 'Centre de coût',
  required = false, noneLabel = '— Aucun —', row = true,
}: {
  bu: string | null | undefined;
  cc: string | null | undefined;
  onChange: (bu: string | null, cc: string | null) => void;
  buLabel?: string;
  ccLabel?: string;
  required?: boolean;
  noneLabel?: string;
  row?: boolean;
}) {
  const bus = useBusinessUnits();
  const list = bus.data ?? [];
  const current = list.find((b) => b.code === (bu ?? ''));
  const cas = current?.ca ?? [];

  const inner = (
    <>
      <div className="form-g">
        <label>{buLabel}{required ? ' *' : ''}</label>
        <select
          value={bu ?? ''}
          onChange={(e) => {
            const nb = e.target.value || null;
            const nbCas = list.find((b) => b.code === nb)?.ca ?? [];
            // Le centre de coût ne survit au changement de BU que s'il en fait partie.
            const keepCc = cc && nbCas.some((c) => c.code === cc) ? cc : null;
            onChange(nb, keepCc);
          }}
        >
          <option value="">{noneLabel}</option>
          {list.map((b) => <option key={b.code} value={b.code}>{b.code} — {b.name}</option>)}
        </select>
      </div>
      <div className="form-g">
        <label>{ccLabel}</label>
        <select value={cc ?? ''} disabled={!bu || !cas.length} onChange={(e) => onChange(bu ?? null, e.target.value || null)}>
          <option value="">{bu ? (cas.length ? '— Aucun —' : 'Aucun centre défini') : 'Choisir une BU'}</option>
          {cas.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.nom}</option>)}
        </select>
      </div>
    </>
  );

  return row ? <div className="form-r">{inner}</div> : inner;
}

/** Résout un code BU / CC vers son libellé lisible (pour l'affichage en fiche). */
export function useBuCcLabel() {
  const bus = useBusinessUnits();
  const list = bus.data ?? [];
  return (buCode: string | null | undefined, ccCode?: string | null): string => {
    const b = list.find((x) => x.code === (buCode ?? ''));
    const buTxt = b ? b.name : (buCode ?? '');
    if (!buCode) return '—';
    const c = (b?.ca ?? []).find((x) => x.code === (ccCode ?? ''));
    return c ? `${buTxt} · ${c.nom}` : buTxt;
  };
}
