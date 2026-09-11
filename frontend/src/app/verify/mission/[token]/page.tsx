'use client';

import { use, useEffect, useState } from 'react';
import { fd } from '@/lib/fleet/format';
import { api } from '@/lib/api/client';

export default function VerifyMissionPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [state, setState] = useState<{ valid: boolean; mission?: Record<string, string | number> } | null>(null);

  useEffect(() => {
    api.get(`/missions/verify/${token}`).then((r) => setState(r.data)).catch(() => setState({ valid: false }));
  }, [token]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, fontFamily: 'Inter,system-ui,sans-serif' }}>
      <div style={{ maxWidth: 460, width: '100%', border: '1px solid #dce1ea', borderRadius: 12, padding: 28, textAlign: 'center', background: '#fff' }}>
        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1e40af', marginBottom: 16 }}>FleetPro — Vérification d&apos;ordre de mission</div>
        {state === null && <p>Vérification…</p>}
        {state?.valid === false && (
          <>
            
            <p style={{ color: '#b91c1c', fontWeight: 700 }}>Document NON authentifié</p>
            <p style={{ fontSize: '.85rem', color: '#8892a8' }}>Ce QR code ne correspond à aucun ordre de mission émis par le système.</p>
          </>
        )}
        {state?.valid && state.mission && (
          <>
            
            <p style={{ color: '#15803d', fontWeight: 700 }}>Ordre de mission authentique</p>
            <table style={{ width: '100%', fontSize: '.82rem', marginTop: 12, borderCollapse: 'collapse' }}>
              <tbody>
                {Object.entries({
                  'N° Mission': state.mission.num,
                  Trajet: `${state.mission.fromLoc} → ${state.mission.toLoc}`,
                  Dates: `${fd(state.mission.dateStart)} → ${fd(state.mission.dateEnd)}`,
                  Chauffeur: state.mission.driverCode,
                  Véhicule: state.mission.vehicleCode,
                  Distance: `${state.mission.distance} km`,
                  Statut: state.mission.status,
                }).map(([k, v]) => (
                  <tr key={k} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, color: '#4a5578' }}>{k}</td>
                    <td style={{ textAlign: 'right', padding: '6px 8px' }}>{String(v ?? '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
