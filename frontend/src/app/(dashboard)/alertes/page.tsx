'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Bell, AlertTriangle, FileText, Wrench, Fuel, CreditCard, Shield, CheckCircle, Eye,
} from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { mockAlerts } from '@/lib/mock-data';
import { AlertType, AlertPriority } from '@/types';
import { formatDate } from '@/lib/utils';

const alertTypeIcons: Record<AlertType, React.ReactNode> = {
  [AlertType.DOCUMENT_EXPIRY]: <FileText className="h-5 w-5" />,
  [AlertType.MAINTENANCE_DUE]: <Wrench className="h-5 w-5" />,
  [AlertType.LEASE_EXPIRY]: <CreditCard className="h-5 w-5" />,
  [AlertType.FUEL_ANOMALY]: <Fuel className="h-5 w-5" />,
  [AlertType.DRIVER_HOURS]: <Shield className="h-5 w-5" />,
};

const alertTypeLabels: Record<AlertType, string> = {
  [AlertType.DOCUMENT_EXPIRY]: 'Document',
  [AlertType.MAINTENANCE_DUE]: 'Maintenance',
  [AlertType.LEASE_EXPIRY]: 'Location',
  [AlertType.FUEL_ANOMALY]: 'Carburant',
  [AlertType.DRIVER_HOURS]: 'Heures Chauffeur',
};

const priorityColors: Record<AlertPriority, string> = {
  [AlertPriority.CRITIQUE]: 'bg-red-50 border-red-100 text-red-600',
  [AlertPriority.HAUTE]: 'bg-orange-50 border-orange-100 text-orange-600',
  [AlertPriority.MOYENNE]: 'bg-amber-50 border-amber-100 text-amber-600',
  [AlertPriority.BASSE]: 'bg-blue-50 border-blue-100 text-blue-600',
};

export default function AlertesPage() {
  const [alerts, setAlerts] = useState(mockAlerts.filter((a) => !a.isDismissed));
  const [filter, setFilter] = useState<string>('all');

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  const filtered = alerts.filter((a) => {
    if (filter === 'unread') return !a.isRead;
    if (filter !== 'all') return a.type === filter;
    return true;
  });

  const groupedByType = Object.values(AlertType).reduce((acc, type) => {
    acc[type] = alerts.filter((a) => a.type === type).length;
    return acc;
  }, {} as Record<string, number>);

  const markAsRead = (id: string) => {
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, isRead: true } : a));
  };

  const dismiss = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Centre d&apos;Alertes</h2>
          <p className="text-gray-500 mt-1">
            {unreadCount} alerte{unreadCount > 1 ? 's' : ''} non lue{unreadCount > 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" onClick={() => setAlerts((prev) => prev.map((a) => ({ ...a, isRead: true })))}>
          Tout marquer comme lu
        </Button>
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Toutes ({alerts.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            filter === 'unread' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Non lues ({unreadCount})
        </button>
        {Object.entries(groupedByType)
          .filter(([, count]) => count > 0)
          .map(([type, count]) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === type ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {alertTypeLabels[type as AlertType]} ({count})
            </button>
          ))}
      </div>

      {/* Alerts list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <div className="py-12 text-center">
              <Bell className="h-12 w-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Aucune alerte a afficher</p>
            </div>
          </Card>
        ) : (
          filtered.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`border rounded-xl p-4 transition-all ${
                !alert.isRead ? 'bg-white shadow-sm' : 'bg-gray-50/50'
              } ${priorityColors[alert.priority].split(' ').filter((c) => c.startsWith('border')).join(' ')}`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-2.5 rounded-xl shrink-0 ${priorityColors[alert.priority].split(' ').filter((c) => c.startsWith('bg')).join(' ')}`}>
                  <span className={priorityColors[alert.priority].split(' ').filter((c) => c.startsWith('text')).join(' ')}>
                    {alertTypeIcons[alert.type]}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-slate-900">{alert.title}</h3>
                    <StatusBadge type="alertPriority" status={alert.priority} />
                    {!alert.isRead && <div className="h-2 w-2 bg-blue-500 rounded-full" />}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-400">
                    <span>{formatDate(alert.createdAt)}</span>
                    {alert.dueDate && <span>Echeance: {formatDate(alert.dueDate)}</span>}
                    <Badge variant="default">{alertTypeLabels[alert.type]}</Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!alert.isRead && (
                    <button
                      onClick={() => markAsRead(alert.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
                      title="Marquer comme lu"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => dismiss(alert.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-600 transition-colors"
                    title="Ignorer"
                  >
                    <span className="text-xs">x</span>
                  </button>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
}
