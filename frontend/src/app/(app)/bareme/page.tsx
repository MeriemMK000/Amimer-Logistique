'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Le barème frais est désormais un onglet de Paramètres (retour DG). */
export default function BaremeRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace('/parametres?tab=bareme'); }, [router]);
  return (
    <div className="page active">
      <div className="cc" style={{ padding: 24 }}>
        Le barème frais a été déplacé dans <b>Paramètres → onglet « Barème frais »</b>.
        <div style={{ marginTop: 10 }}>
          <a className="btn btn-p btn-sm" href="/parametres?tab=bareme">Ouvrir le barème</a>
        </div>
      </div>
    </div>
  );
}
