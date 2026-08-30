'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Filter, ArrowRight } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import Select from '@/components/ui/Select';
import { mockMissions, mockDrivers, mockVehicles } from '@/lib/mock-data';
import { MissionStatus } from '@/types';
import type { Mission } from '@/types';
import { formatDate, formatNumber } from '@/lib/utils';

const statusOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: MissionStatus.PLANIFIEE, label: 'Planifiee' },
  { value: MissionStatus.EN_COURS, label: 'En cours' },
  { value: MissionStatus.TERMINEE, label: 'Terminee' },
  { value: MissionStatus.ANNULEE, label: 'Annulee' },
];

export default function MissionsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = mockMissions.filter((m) => {
    if (statusFilter && m.status !== statusFilter) return false;
    return true;
  });

  const getDriver = (id: string) => {
    const d = mockDrivers.find((dr) => dr.id === id);
    return d ? `${d.firstName} ${d.lastName}` : '-';
  };

  const getVehicle = (id: string) => {
    const v = mockVehicles.find((vh) => vh.id === id);
    return v ? `${v.code}` : '-';
  };

  const columns = [
    { key: 'missionNumber', header: 'N Mission', sortable: true, render: (m: Mission) => (
      <span className="font-medium text-slate-900">{m.missionNumber}</span>
    )},
    { key: 'driverId', header: 'Chauffeur', sortable: true, render: (m: Mission) => (
      <span className="text-gray-700">{getDriver(m.driverId)}</span>
    )},
    { key: 'vehicleId', header: 'Vehicule', sortable: true, render: (m: Mission) => (
      <span className="font-mono text-sm">{getVehicle(m.vehicleId)}</span>
    )},
    { key: 'departureLocation', header: 'Trajet', render: (m: Mission) => (
      <div className="flex items-center gap-1 text-sm">
        <span>{m.departureLocation}</span>
        <ArrowRight className="h-3 w-3 text-gray-300 shrink-0" />
        <span>{m.arrivalLocation}</span>
      </div>
    )},
    { key: 'departureDate', header: 'Depart', sortable: true, render: (m: Mission) => (
      <span className="text-sm">{formatDate(m.departureDate)}</span>
    )},
    { key: 'status', header: 'Statut', sortable: true, render: (m: Mission) => (
      <StatusBadge type="mission" status={m.status} />
    )},
    { key: 'distance', header: 'Distance', sortable: true, render: (m: Mission) => (
      <span>{m.distance > 0 ? `${formatNumber(m.distance)} km` : `~${formatNumber(m.estimatedDistance || 0)} km`}</span>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Missions</h2>
          <p className="text-gray-500 mt-1">{mockMissions.length} missions au total</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => router.push('/missions/nouvelle')}>
          Nouvelle mission
        </Button>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filtres</span>
        </div>
        <div className="max-w-xs">
          <Select options={statusOptions} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
        </div>
      </Card>

      <Card>
        <DataTable<Mission & Record<string, unknown>>
          columns={columns}
          data={filtered as (Mission & Record<string, unknown>)[]}
          pageSize={10}
          searchPlaceholder="Rechercher une mission..."
          onRowClick={(m) => router.push(`/missions/${m.id}`)}
        />
      </Card>
    </motion.div>
  );
}
