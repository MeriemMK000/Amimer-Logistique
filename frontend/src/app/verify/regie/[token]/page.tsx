'use client';

import { use, useEffect, useState } from 'react';
import { api } from '@/lib/api/client';

interface Purchase {
  ref?: string; vehicleCode?: string; driverCode?: string; fuelType?: string;
  date?: string; validUntil?: string; maxLiters?: number; maxAmount?: number;
  reason?: string; status?: string; expired?: boolean;
}

const ST_LABEL: Record<string, string> = { emis: 'Émis — valable', consomme: 'Déjà consommé', annule: 'Annulé' };

export default function VerifyRegiePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<{ valid: boolean; purchase?: Purchase } | null>(null);

  useEffect(() => {
    api.get(`/regie-purchases/verify/${token}`).then((r) => setState(r.data)).catch(() => setState({ valid: false }));
  }, [token]);

  const p = state?.purchase;
  const usable = state?.valid && p?.status === 'emis' && !p?.expired;

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter,system-ui,sans-serif', background: '#f4f6fb' }}>
      <div style={{ maxWidth: 460, width: '100%', border: '1px solid #dce1ea', borderRadius: 12, padding: 28, textAlign: 'center', background: '#fff' }}>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e40af', marginBottom: 16 }}>FleetPro — Bon d&apos;achat carburant régie</div>
        {state === null && <p>Vérification…</p>}

        {state?.valid === false && (
          <>
            
            <p style={{ color: '#b91c1c', fontWeight: 700 }}>Bon NON authentifié</p>
            <p style={{ fontSize: '.85rem', color: '#8892a8' }}>Ce QR code ne correspond à aucun bon d&apos;achat régie émis par le système. Ne pas servir.</p>
          </>
        )}

        {state?.valid && p && (
          <>
            
            <p style={{ color: usable ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
              {usable ? 'Bon authentique — autorisé' : p.expired ? 'Bon expiré — ne pas servir' : ST_LABEL[p.status ?? ''] ?? 'Non utilisable'}
            </p>
            <table style={{ width: '100%', fontSize: '.82rem', marginTop: 12, borderCollapse: 'collapse' }}>
              <tbody>
                {Object.entries({
                  'N° Bon': p.ref,
                  Véhicule: p.vehicleCode,
                  Chauffeur: p.driverCode,
                  Carburant: p.fuelType,
                  'Plafond litres': p.maxLiters != null ? `${p.maxLiters} L` : '—',
                  'Plafond montant': p.maxAmount != null ? `${p.maxAmount.toLocaleString('fr-FR')} DA` : '—',
                  'Valable jusqu’au': p.validUntil ?? '—',
                  Motif: p.reason,
                }).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: '#4a5578' }}>{k}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{String(v ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {usable && (
              <p style={{ fontSize: '.78rem', color: '#8892a8', marginTop: 12 }}>
                La station peut servir le carburant dans la limite des plafonds ci-dessus. Le montant réel sera saisi dans FleetPro au retour du chauffeur.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
