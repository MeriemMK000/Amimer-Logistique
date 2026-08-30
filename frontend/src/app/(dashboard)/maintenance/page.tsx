'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Wrench, ClipboardList } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import Tabs from '@/components/ui/Tabs';
import { mockMaintenanceOrders, mockMaintenancePlans, mockVehicles } from '@/lib/mock-data';
import type { MaintenanceOrder, MaintenancePlan } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function MaintenancePage() {
  const [activeTab, setActiveTab] = useState('ordres');

  const getVehicle = (id: string) => {
    const v = mockVehicles.find((vh) => vh.id === id);
    return v ? `${v.code} - ${v.brand} ${v.model}` : '-';
  };

  const ordersColumns = [
    { key: 'orderNumber', header: 'N Ordre', sortable: true, render: (o: MaintenanceOrder) => (
      <span className="font-medium text-slate-900">{o.orderNumber}</span>
    )},
    { key: 'vehicleId', header: 'Vehicule', render: (o: MaintenanceOrder) => (
      <span className="text-sm">{getVehicle(o.vehicleId)}</span>
    )},
    { key: 'type', header: 'Type', sortable: true, render: (o: MaintenanceOrder) => (
      <span className="text-sm">{o.type}</span>
    )},
    { key: 'description', header: 'Description', render: (o: MaintenanceOrder) => (
      <span className="text-sm text-gray-600 truncate max-w-[200px] block">{o.description}</span>
    )},
    { key: 'priority', header: 'Priorite', sortable: true, render: (o: MaintenanceOrder) => (
      <StatusBadge type="priority" status={o.priority} />
    )},
    { key: 'status', header: 'Statut', sortable: true, render: (o: MaintenanceOrder) => (
      <StatusBadge type="maintenance" status={o.status} />
    )},
    { key: 'scheduledDate', header: 'Date', sortable: true, render: (o: MaintenanceOrder) => (
      <span className="text-sm">{formatDate(o.scheduledDate)}</span>
    )},
    { key: 'estimatedCost', header: 'Cout', sortable: true, render: (o: MaintenanceOrder) => (
      <span className="text-sm font-medium">{formatCurrency(o.actualCost || o.estimatedCost)}</span>
    )},
  ];

  const plansColumns = [
    { key: 'vehicleId', header: 'Vehicule', render: (p: MaintenancePlan) => (
      <span className="text-sm">{getVehicle(p.vehicleId)}</span>
    )},
    { key: 'type', header: 'Type', render: (p: MaintenancePlan) => (
      <span className="text-sm">{p.type}</span>
    )},
    { key: 'description', header: 'Description', render: (p: MaintenancePlan) => (
      <span className="text-sm text-gray-600">{p.description}</span>
    )},
    { key: 'intervalKm', header: 'Intervalle Km', render: (p: MaintenancePlan) => (
      <span className="text-sm">{p.intervalKm.toLocaleString('fr-FR')} km</span>
    )},
    { key: 'intervalMonths', header: 'Intervalle Mois', render: (p: MaintenancePlan) => (
      <span className="text-sm">{p.intervalMonths} mois</span>
    )},
    { key: 'nextDueDate', header: 'Prochaine Echeance', sortable: true, render: (p: MaintenancePlan) => (
      <span className="text-sm">{formatDate(p.nextDueDate)}</span>
    )},
    { key: 'estimatedCost', header: 'Cout Estime', render: (p: MaintenancePlan) => (
      <span className="text-sm font-medium">{formatCurrency(p.estimatedCost)}</span>
    )},
  ];

  const tabs = [
    { id: 'ordres', label: 'Ordres de Travail', icon: <Wrench className="h-4 w-4" />, count: mockMaintenanceOrders.length },
    { id: 'plans', label: 'Plans de Maintenance', icon: <ClipboardList className="h-4 w-4" />, count: mockMaintenancePlans.length },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Maintenance</h2>
          <p className="text-gray-500 mt-1">Gestion des ordres de travail et plans de maintenance</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />}>Nouvel ordre de travail</Button>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <Card className="mt-4">
        {activeTab === 'ordres' && (
          <DataTable<MaintenanceOrder & Record<string, unknown>>
            columns={ordersColumns}
            data={mockMaintenanceOrders as (MaintenanceOrder & Record<string, unknown>)[]}
            pageSize={10}
            searchPlaceholder="Rechercher un ordre de travail..."
          />
        )}
        {activeTab === 'plans' && (
          <DataTable<MaintenancePlan & Record<string, unknown>>
            columns={plansColumns}
            data={mockMaintenancePlans as (MaintenancePlan & Record<string, unknown>)[]}
            pageSize={10}
            searchPlaceholder="Rechercher un plan..."
          />
        )}
      </Card>
    </motion.div>
  );
}
