'use client';

import React, { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Search, Menu, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { mockAlerts } from '@/lib/mock-data';

const pageTitles: Record<string, string> = {
  '/': 'Tableau de Bord',
  '/flotte': 'Gestion de la Flotte',
  '/chauffeurs': 'Gestion des Chauffeurs',
  '/missions': 'Gestion des Missions',
  '/maintenance': 'Maintenance',
  '/carburant': 'Gestion du Carburant',
  '/incidents': 'Gestion des Incidents',
  '/frais': 'Frais de Mission',
  '/alertes': 'Centre d\'Alertes',
  '/rapports': 'Rapports et Analyses',
  '/parametres': 'Parametres',
};

interface HeaderProps {
  onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);

  const unreadCount = mockAlerts.filter((a) => !a.isRead).length;

  const getTitle = () => {
    for (const [path, title] of Object.entries(pageTitles)) {
      if (pathname === path || (path !== '/' && pathname.startsWith(path))) {
        return title;
      }
    }
    return 'FleetPro';
  };

  const getBreadcrumbs = () => {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return [];
    const crumbs: { label: string; href: string }[] = [];
    let path = '';
    for (const part of parts) {
      path += `/${part}`;
      const title = pageTitles[path];
      if (title) {
        crumbs.push({ label: title, href: path });
      } else {
        crumbs.push({ label: part, href: path });
      }
    }
    return crumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Menu className="h-5 w-5 text-gray-600" />
        </button>

        <div>
          <h1 className="text-xl font-semibold text-slate-900">{getTitle()}</h1>
          {breadcrumbs.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <span>Accueil</span>
              {breadcrumbs.map((crumb, i) => (
                <React.Fragment key={i}>
                  <ChevronRight className="h-3 w-3" />
                  <span className={i === breadcrumbs.length - 1 ? 'text-gray-600' : ''}>
                    {crumb.label}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          {searchOpen ? (
            <input
              type="text"
              placeholder="Rechercher..."
              className="w-64 pl-10 pr-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              onBlur={() => setSearchOpen(false)}
            />
          ) : null}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Search className="h-5 w-5 text-gray-400" />
          </button>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell className="h-5 w-5 text-gray-400" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-4 w-4 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {/* User avatar */}
        <div className="flex items-center gap-2 pl-3 border-l border-gray-100">
          <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
            {user?.name?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="hidden md:block">
            <p className="text-sm font-medium text-slate-900">{user?.name || 'Utilisateur'}</p>
            <p className="text-xs text-gray-400">{user?.role || 'Admin'}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
