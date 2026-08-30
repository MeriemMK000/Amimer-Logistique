'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Filter } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import Select from '@/components/ui/Select';
import { mockDrivers } from '@/lib/mock-data';
import { DriverStatus } from '@/types';
import type { Driver } from '@/types';
import { formatDate } from '@/lib/utils';

const statusOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: DriverStatus.ACTIF, label: 'Actif' },
  { value: DriverStatus.EN_MISSION, label: 'En mission' },
  { value: DriverStatus.EN_CONGE, label: 'En conge' },
  { value: DriverStatus.SUSPENDU, label: 'Suspendu' },
  { value: DriverStatus.INACTIF, label: 'Inactif' },
];

export default function ChauffeursPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState('');

  const filtered = mockDrivers.filter((d) => {
    if (statusFilter && d.status !== statusFilter) return false;
    return true;
  });

  const columns = [
    { key: 'employeeNumber', header: 'N Employe', sortable: true, render: (d: Driver) => (
      <span className="font-mono text-sm font-medium text-slate-900">{d.employeeNumber}</span>
    )},
    { key: 'lastName', header: 'Nom', sortable: true, render: (d: Driver) => (
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
          {d.firstName[0]}{d.lastName[0]}
        </div>
        <div>
          <span className="font-medium text-slate-900">{d.firstName} {d.lastName}</span>
          <br />
          <span className="text-xs text-gray-400">{d.department}</span>
        </div>
      </div>
    )},
    { key: 'licenseType', header: 'Permis', sortable: true, render: (d: Driver) => (
      <span className="text-sm">{d.licenseType}</span>
    )},
    { key: 'licenseExpiry', header: 'Expiration Permis', sortable: true, render: (d: Driver) => (
      <span className={new Date(d.licenseExpiry) < new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) ? 'text-amber-600 font-medium' : ''}>
        {formatDate(d.licenseExpiry)}
      </span>
    )},
    { key: 'status', header: 'Statut', sortable: true, render: (d: Driver) => (
      <StatusBadge type="driver" status={d.status} />
    )},
    { key: 'phone', header: 'Telephone', render: (d: Driver) => (
      <span className="text-gray-600">{d.phone}</span>
    )},
    { key: 'actions', header: '', render: (d: Driver) => (
      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); router.push(`/chauffeurs/${d.id}`); }}>
        Voir
      </Button>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Chauffeurs</h2>
          <p className="text-gray-500 mt-1">{mockDrivers.length} chauffeurs enregistres</p>
        </div>
        <Button icon={<Plus className="h-4 w-4" />}>Ajouter un chauffeur</Button>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filtres</span>
        </div>
        <div className="max-w-xs">
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <DataTable<Driver & Record<string, unknown>>
          columns={columns}
          data={filtered as (Driver & Record<string, unknown>)[]}
          pageSize={10}
          searchPlaceholder="Rechercher un chauffeur..."
          onRowClick={(d) => router.push(`/chauffeurs/${d.id}`)}
        />
      </Card>
    </motion.div>
  );
}
