'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { NAV, NAV_SECTIONS } from '@/lib/nav';
import { useTableAlign } from '@/lib/useTableAlign';
import { useTilt } from '@/lib/useTilt';
import CommandPalette from '@/components/layout/CommandPalette';

const svg = { fill: 'none', stroke: 'currentColor', strokeWidth: 2 } as const;

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useTableAlign();
  useTilt();

  const current = NAV.find((n) => (n.href === '/' ? pathname === '/' : pathname.startsWith(n.href)));
  const title = current?.label ?? 'Tableau de Bord';

  return (
    <div className="app">
      <div className={`sbo${open ? ' vis' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <div className="sb-hd">
          <div className="sb-logo" aria-hidden>
            <svg viewBox="0 0 24 24" {...svg}>
              <rect x="1" y="3" width="15" height="13" rx="2" />
              <polygon points="16 8 20 8 23 11 23 16 16 16 16 8" />
              <circle className="whl" cx="5.5" cy="18.5" r="2.5" />
              <circle className="whl" cx="18.5" cy="18.5" r="2.5" />
            </svg>
          </div>
          <div className="sb-brand">Fleet<span>Pro</span></div>
        </div>
        <nav className="sb-nav">
          {NAV_SECTIONS.map((section) => (
            <div key={section}>
              <div className="nav-s">{section}</div>
              {NAV.filter((n) => n.section === section).map((n) => {
                const active = n.href === '/' ? pathname === '/' : pathname.startsWith(n.href);
                return (
                  <Link
                    key={n.slug}
                    href={n.href}
                    className={`nav-i${active ? ' active' : ''}`}
                    onClick={() => setOpen(false)}
                  >
                    {n.icon}
                    {n.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sb-ft">
          <div className="av">KA</div>
          <div>
            <div className="u-n">Kamal Azouaou</div>
            <div className="u-r">Administrateur</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="header">
          <div className="h-left">
            <button className="h-btn mt" onClick={() => setOpen((v) => !v)} aria-label="Menu">
              <svg viewBox="0 0 24 24" {...svg}><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
            </button>
            <div>
              <h1>{title}</h1>
              <div className="bc">FleetPro <span>/ <span>{title}</span></span></div>
            </div>
          </div>
          <div className="h-right">
            <button
              className="h-search"
              onClick={() => window.dispatchEvent(new Event('fleet:open-search'))}
              aria-label="Recherche rapide"
            >
              <svg viewBox="0 0 24 24" {...svg}><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <span className="h-search-txt">Rechercher…</span>
              <kbd>⌘K</kbd>
            </button>
            <Link className="h-btn" href="/alertes" aria-label="Alertes">
              <svg viewBox="0 0 24 24" {...svg}><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
              <span className="nd" />
            </Link>
            <Link className="h-btn" href="/parametres" aria-label="Paramètres">
              <svg viewBox="0 0 24 24" {...svg}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4" /></svg>
            </Link>
          </div>
        </header>
        <div className="content">{children}</div>
      </div>

      <CommandPalette />
    </div>
  );
}
