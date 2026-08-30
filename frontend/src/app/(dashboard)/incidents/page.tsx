'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Filter } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import Select from '@/components/ui/Select';
import { mockIncidents, mockVehicles, mockDrivers } from '@/lib/mock-data';
import { IncidentType, IncidentSeverity, IncidentStatus } from '@/types';
import type { Incident } from '@/types';
import { formatDate, formatCurrency } from '@/lib/utils';

const typeOptions = [
  { value: '', label: 'Tous les types' },
  ...Object.values(IncidentType).map((t) => ({ value: t, label: t })),
];

const severityOptions = [
  { value: '', label: 'Toutes severites' },
  ...Object.values(IncidentSeverity).map((s) => ({ value: s, label: s })),
];

const statusOptions = [
  { value: '', label: 'Tous les statuts' },
  ...Object.values(IncidentStatus).map((s) => ({ value: s, label: s })),
];

export default function IncidentsPage() {
  const [typeFilter, setTypeFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = mockIncidents.filter((i) => {
    if (typeFilter && i.type !== typeFilter) return false;
    if (severityFilter && i.severity !== severityFilter) return false;
    if (statusFilter && i.status !== statusFilter) return false;
    return true;
  });

  const getVehicle = (id: string) => {
    const v = mockVehicles.find((vh) => vh.id === id);
    return v ? v.code : '-';
  };

  const getDriver = (id: string | undefined) => {
    if (!id) return '-';
    const d = mockDrivers.find((dr) => dr.id === id);
    return d ? `${d.firstName} ${d.lastName}` : '-';
  };

  const columns = [
    { key: 'date', header: 'Date', sortable: true, render: (i: Incident) => (
      <span className="text-sm">{formatDate(i.date)}</span>
    )},
    { key: 'vehicleId', header: 'Vehicule', render: (i: Incident) => (
      <span className="font-mono text-sm">{getVehicle(i.vehicleId)}</span>
    )},
    { key: 'driverId', header: 'Chauffeur', render: (i: Incident) => (
      <span className="text-sm">{getDriver(i.driverId)}</span>
    )},
    { key: 'type', header: 'Type', sortable: true, render: (i: Incident) => (
      <span className="text-sm">{i.type}</span>
    )},
    { key: 'description', header: 'Description', render: (i: Incident) => (
      <span className="text-sm text-gray-600 truncate max-w-[200px] block">{i.description}</span>
    )},
    { key: 'severity', header: 'Severite', sortable: true, render: (i: Incident) => (
      <StatusBadge type="incidentSeverity" status={i.severity} />
    )},
    { key: 'status', header: 'Statut', sortable: true, render: (i: Incident) => (
      <StatusBadge type="incidentStatus" status={i.status} />
    )},
    { key: 'damageEstimate', header: 'Estimation', sortable: true, render: (i: Incident) => (
      <span className="text-sm font-medium">{i.damageEstimate ? formatCurrency(i.damageEstimate) : '-'}</span>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Incidents</h2>
          <p className="text-gray-500 mt-1">{mockIncidents.length} incidents enregistres</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />}>Declarer un incident</Button>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filtres</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select options={typeOptions} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} />
          <Select options={severityOptions} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} />
          <Select options={statusOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
        </div>
      </Card>

      <Card>
        <DataTable<Incident & Record<string, unknown>>
          columns={columns}
          data={filtered as (Incident & Record<string, unknown>)[]}
          pageSize={10}
          searchPlaceholder="Rechercher un incident..."
        />
      </Card>
    </motion.div>
  );
}
