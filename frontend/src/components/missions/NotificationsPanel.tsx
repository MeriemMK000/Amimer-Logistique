'use client';

import { useMemo, useState } from 'react';
import { fd } from '@/lib/fleet/format';
import { useNotifications, useMarkNotificationRead } from '@/lib/api/hooks';
import SearchBox from '@/components/ui/SearchBox';
import { useSearch } from '@/lib/useSearch';

const KIND_LABEL: Record<string, string> = {
  mission_validee: 'Mission validée',
  mission_modifiee: 'Mission modifiée',
  ordre_emis: 'Ordre de mission émis',
};
const AUD_LABEL: Record<string, string> = { requester: 'Demandeur', driver: 'Chauffeur', office: 'Logistique' };
const EMAIL_LABEL: Record<string, { txt: string; cls: string }> = {
  sent: { txt: 'Email envoyé', cls: 'bg-g' },
  skipped: { txt: 'Sans email', cls: 'bg' },
  failed: { txt: 'Échec email', cls: 'bg-r' },
  pending: { txt: 'En attente', cls: 'bg-a' },
};

/** Historique des notifications envoyées (retour DG : informer le demandeur à la validation). */
export default function NotificationsPanel() {
  const notifs = useNotifications();
  const markRead = useMarkNotificationRead();
  const [aud, setAud] = useState('');
  const N = useMemo(() => (notifs.data ?? []).filter((n) => !aud || n.audience === aud), [notifs.data, aud]);
  const search = useSearch(N, (n) => [n.subject, n.recipientName, n.recipientEmail, n.missionRef, KIND_LABEL[n.kind] ?? n.kind].join(' '));
  const unread = (notifs.data ?? []).filter((n) => !n.read).length;

  return (
    <div className="tpane act">
      <div className="tc">
        <div className="th">
          <h3>Notifications {unread ? <span className="bg bg-r" style={{ marginLeft: 6 }}>{unread} non lues</span> : null}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={aud} onChange={(e) => setAud(e.target.value)}>
              <option value="">Tous les destinataires</option>
              <option value="requester">Demandeurs</option>
              <option value="driver">Chauffeurs</option>
              <option value="office">Logistique</option>
            </select>
            <SearchBox value={search.q} onChange={search.setQ} placeholder="Sujet, demandeur, mission…" count={search.count} total={N.length} />
          </div>
        </div>
        <div style={{ fontSize: '.74rem', color: 'var(--tm)', padding: '0 14px 10px' }}>
          Chaque validation de mission informe le(s) demandeur(s) (chauffeur + itinéraire confirmés) ; tout changement majeur
          après validation ré-informe. L&apos;email part si un SMTP est configuré, sinon la notification reste consultable ici.
        </div>
        <div className="tw">
          <table>
            <thead><tr><th>Date</th><th>Type</th><th>Destinataire</th><th>Mission</th><th>Sujet</th><th>Email</th><th /></tr></thead>
            <tbody>
              {search.filtered.map((n) => (
                <tr key={n.id} style={n.read ? { opacity: 0.6 } : { fontWeight: 500 }}>
                  <td style={{ whiteSpace: 'nowrap', fontSize: '.72rem' }}>{fd(n.createdAt, { withTime: true })}</td>
                  <td><span className="bg bg-t">{KIND_LABEL[n.kind] ?? n.kind}</span></td>
                  <td>
                    <span className="bg" style={{ fontSize: '.6rem' }}>{AUD_LABEL[n.audience] ?? n.audience}</span>{' '}
                    {n.recipientName ?? '—'}
                    {n.recipientEmail && <div style={{ fontSize: '.68rem', color: 'var(--tm)' }}>{n.recipientEmail}</div>}
                  </td>
                  <td style={{ fontWeight: 600 }}>{n.missionRef ?? '—'}</td>
                  <td>
                    {n.subject}
                    <div style={{ fontSize: '.68rem', color: 'var(--tm)', whiteSpace: 'pre-line', marginTop: 2 }}>{n.body}</div>
                  </td>
                  <td>
                    <span className={`bg ${EMAIL_LABEL[n.emailStatus]?.cls ?? 'bg'}`} style={{ fontSize: '.6rem' }}>
                      {EMAIL_LABEL[n.emailStatus]?.txt ?? n.emailStatus}
                    </span>
                  </td>
                  <td>{!n.read && <button className="btn btn-o btn-sm" onClick={() => markRead.mutate(n.id)}>Marquer lu</button>}</td>
                </tr>
              ))}
              {!search.filtered.length && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: 'var(--tm)', padding: 20 }}>
                  {(notifs.data ?? []).length ? 'Aucune notification ne correspond' : 'Aucune notification pour le moment'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
