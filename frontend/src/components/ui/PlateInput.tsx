'use client';

/**
 * Saisie d'une plaque d'immatriculation algérienne au format standard
 * `SÉRIE-CATÉGORIE-WILAYA` (ex. `12345-116-16`) :
 *   • série       : 1 à 5 chiffres (numéro d'ordre)
 *   • catégorie   : 3 chiffres (genre + année de 1re mise en circulation)
 *   • wilaya      : 2 chiffres (01 à 58)
 * Le champ n'accepte que des chiffres et place les tirets automatiquement.
 */

const WILAYAS = 58;

/** Ne garde que les chiffres (max 10) et replace les tirets : 5 · 3 · 2. */
export function formatPlate(raw: string): string {
  const d = (raw || '').replace(/\D/g, '').slice(0, 10);
  const parts = [d.slice(0, 5), d.slice(5, 8), d.slice(8, 10)].filter(Boolean);
  return parts.join('-');
}

/** Plaque complète et wilaya plausible ? */
export function isPlateValid(v: string): boolean {
  const m = /^(\d{1,5})-(\d{3})-(\d{2})$/.exec(v.trim());
  if (!m) return false;
  const w = Number(m[3]);
  return w >= 1 && w <= WILAYAS;
}

export default function PlateInput({
  value,
  onChange,
  placeholder = '12345-116-16',
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const v = value ?? '';
  const digits = v.replace(/\D/g, '');
  const wilaya = digits.length >= 10 ? digits.slice(8, 10) : '';
  const wilOk = wilaya === '' || (Number(wilaya) >= 1 && Number(wilaya) <= WILAYAS);
  const complete = isPlateValid(v);

  return (
    <div>
      <input
        value={v}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        aria-invalid={required && v !== '' && !complete ? true : undefined}
        onChange={(e) => onChange(formatPlate(e.target.value))}
        onPaste={(e) => { e.preventDefault(); onChange(formatPlate(e.clipboardData.getData('text'))); }}
        style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}
      />
      <div style={{ fontSize: '.64rem', color: 'var(--tm)', marginTop: 3 }}>
        {v === ''
          ? 'Format : série (5 ch.) – catégorie (3 ch.) – wilaya (2 ch.)'
          : !wilOk
            ? <span style={{ color: 'var(--r6)' }}>Wilaya invalide (01 à {String(WILAYAS).padStart(2, '0')}).</span>
            : complete
              ? <span style={{ color: 'var(--g6)' }}>✓ Plaque complète (wilaya {wilaya}).</span>
              : 'Continue la saisie…'}
      </div>
    </div>
  );
}
