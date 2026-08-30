'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Truck,
  Users,
  MapPin,
  Wrench,
  Fuel,
  AlertTriangle,
  Receipt,
  Bell,
  BarChart3,
  ArrowLeftRight,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';

const navItems = [
  { href: '/', label: 'Tableau de Bord', icon: LayoutDashboard },
  { href: '/flotte', label: 'Flotte', icon: Truck },
  { href: '/chauffeurs', label: 'Chauffeurs', icon: Users },
  { href: '/missions', label: 'Missions', icon: MapPin },
  { href: '/maintenance', label: 'Maintenance', icon: Wrench },
  { href: '/carburant', label: 'Carburant', icon: Fuel },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/frais', label: 'Frais de Mission', icon: Receipt },
  { href: '/alertes', label: 'Alertes', icon: Bell },
  { href: '/rapports', label: 'Rapports', icon: BarChart3 },
  { href: '/parametres', label: 'Parametres', icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="fixed left-0 top-0 bottom-0 z-40 bg-white border-r border-gray-100 flex flex-col shadow-sm"
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-slate-900">FleetPro</span>
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <div className="mx-auto h-8 w-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Truck className="h-5 w-5 text-white" />
          </div>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 h-6 w-6 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm hover:bg-gray-50 transition-colors z-50"
      >
        {collapsed ? (
          <ChevronRight className="h-3.5 w-3.5 text-gray-600" />
        ) : (
          <ChevronLeft className="h-3.5 w-3.5 text-gray-600" />
        )}
      </button>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                active
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-blue-600' : 'text-gray-400')} />
              <AnimatePresence mode="wait">
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="whitespace-nowrap overflow-hidden"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          );
        })}
      </nav>

      {/* User info */}
      <div className="border-t border-gray-100 p-3">
        {!collapsed && user && (
          <div className="flex items-center gap-3 px-2 py-2 mb-2">
            <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
              {user.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
              <Badge variant="info">{user.role}</Badge>
            </div>
          </div>
        )}
        <button
          onClick={logout}
          className={cn(
            'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors',
            collapsed && 'justify-center'
          )}
          title="Deconnexion"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Deconnexion</span>}
        </button>
      </div>
    </motion.aside>
  );
}
