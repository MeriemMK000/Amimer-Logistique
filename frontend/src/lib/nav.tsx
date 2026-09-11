import type { ReactNode } from 'react';

export interface NavItem {
  slug: string;
  href: string;
  label: string;
  section: string;
  icon: ReactNode;
}

const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 } as const;

export const NAV: NavItem[] = [
  {
    slug: 'dashboard', href: '/', label: 'Tableau de Bord', section: 'Principal',
    icon: (<svg viewBox="0 0 24 24" {...s}><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="4" rx="1" /><rect x="14" y="10" width="7" height="11" rx="1" /><rect x="3" y="13" width="7" height="8" rx="1" /></svg>),
  },
  {
    slug: 'flotte', href: '/flotte', label: 'Flotte', section: 'Principal',
    icon: (<svg viewBox="0 0 24 24" {...s}><rect x="1" y="3" width="15" height="13" rx="2" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>),
  },
  {
    // Retour DG : « Menu incidents et contrôle le mettre sous flotte » — sinistres + contrôles
    // périodiques = état des véhicules, donc rattachés à la Flotte.
    slug: 'incidents', href: '/incidents', label: 'Incidents & Contrôles', section: 'Principal',
    icon: (<svg viewBox="0 0 24 24" {...s}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>),
  },
  {
    slug: 'chauffeurs', href: '/chauffeurs', label: 'Chauffeurs & Utilisateurs', section: 'Principal',
    icon: (<svg viewBox="0 0 24 24" {...s}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>),
  },
  {
    slug: 'demandes-pec', href: '/demandes-pec', label: 'Demandes PEC', section: 'Principal',
    icon: (<svg viewBox="0 0 24 24" {...s}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M9 14l2 2 4-4" /></svg>),
  },
  {
    slug: 'missions', href: '/missions', label: 'Missions', section: 'Principal',
    icon: (<svg viewBox="0 0 24 24" {...s}><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" /><line x1="9" y1="3" x2="9" y2="18" /><line x1="15" y1="6" x2="15" y2="21" /></svg>),
  },
  {
    slug: 'planification', href: '/planification', label: 'Planification', section: 'Opérations',
    icon: (<svg viewBox="0 0 24 24" {...s}><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>),
  },
  {
    slug: 'maintenance', href: '/maintenance', label: 'Maintenance', section: 'Opérations',
    icon: (<svg viewBox="0 0 24 24" {...s}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>),
  },
  {
    slug: 'carburant', href: '/carburant', label: 'Carburant', section: 'Opérations',
    icon: (<svg viewBox="0 0 24 24" {...s}><path d="M3 22V5a2 2 0 012-2h8a2 2 0 012 2v17" /><path d="M15 22V10l4-2v14" /><path d="M3 22h18" /></svg>),
  },
  {
    slug: 'controle', href: '/controle', label: 'Contrôle Individuel', section: 'Opérations',
    icon: (<svg viewBox="0 0 24 24" {...s}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>),
  },
  {
    slug: 'location', href: '/location', label: 'Location & Coûts', section: 'Opérations',
    icon: (<svg viewBox="0 0 24 24" {...s}><rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" /></svg>),
  },
  {
    slug: 'facturation-bu', href: '/facturation-bu', label: 'Facturation BU', section: 'Opérations',
    icon: (<svg viewBox="0 0 24 24" {...s}><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>),
  },
  {
    slug: 'sites', href: '/sites', label: 'Sites & Engins', section: 'Opérations',
    icon: (<svg viewBox="0 0 24 24" {...s}><path d="M3 21h18" /><path d="M5 21V7l8-4v18" /><path d="M19 21V11l-6-4" /><line x1="9" y1="9" x2="9" y2="9" /><line x1="9" y1="13" x2="9" y2="13" /></svg>),
  },
  {
    slug: 'carte-gps', href: '/carte-gps', label: 'Carte GPS', section: 'Opérations',
    icon: (<svg viewBox="0 0 24 24" {...s}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>),
  },
  {
    slug: 'alertes', href: '/alertes', label: 'Alertes', section: 'Suivi',
    icon: (<svg viewBox="0 0 24 24" {...s}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>),
  },
  {
    slug: 'parametres', href: '/parametres', label: 'Paramètres', section: 'Suivi',
    icon: (<svg viewBox="0 0 24 24" {...s}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>),
  },
  {
    slug: 'rapports', href: '/rapports', label: 'Rapports', section: 'Suivi',
    icon: (<svg viewBox="0 0 24 24" {...s}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>),
  },
];

export const NAV_SECTIONS = ['Principal', 'Opérations', 'Suivi'];
