'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Plus, Truck, Filter } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import StatusBadge from '@/components/ui/StatusBadge';
import Select from '@/components/ui/Select';
import { mockVehicles } from '@/lib/mock-data';
import { VehicleType, VehicleStatus, OwnershipType } from '@/types';
import type { Vehicle } from '@/types';
import { formatNumber } from '@/lib/utils';

const typeOptions = [
  { value: '', label: 'Tous les types' },
  ...Object.values(VehicleType).map((t) => ({ value: t, label: t })),
];

const statusOptions = [
  { value: '', label: 'Tous les statuts' },
  { value: VehicleStatus.DISPONIBLE, label: 'Disponible' },
  { value: VehicleStatus.EN_MISSION, label: 'En mission' },
  { value: VehicleStatus.EN_MAINTENANCE, label: 'En maintenance' },
  { value: VehicleStatus.HORS_SERVICE, label: 'Hors service' },
  { value: VehicleStatus.EN_ATTENTE, label: 'En attente' },
];

const ownershipOptions = [
  { value: '', label: 'Toutes les proprietes' },
  { value: OwnershipType.PROPRE, label: 'Propre' },
  { value: OwnershipType.LOCATION, label: 'Location' },
  { value: OwnershipType.CREDIT_BAIL, label: 'Credit-bail' },
];

export default function FlottePage() {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [ownershipFilter, setOwnershipFilter] = useState('');

  const filtered = mockVehicles.filter((v) => {
    if (typeFilter && v.type !== typeFilter) return false;
    if (statusFilter && v.status !== statusFilter) return false;
    if (ownershipFilter && v.ownershipType !== ownershipFilter) return false;
    return true;
  });

  const columns = [
    { key: 'code', header: 'Code', sortable: true, render: (v: Vehicle) => (
      <span className="font-medium text-slate-900">{v.code}</span>
    )},
    { key: 'brand', header: 'Marque / Modele', sortable: true, render: (v: Vehicle) => (
      <div>
        <span className="text-slate-800">{v.brand} {v.model}</span>
        <br />
        <span className="text-xs text-gray-400">{v.year}</span>
      </div>
    )},
    { key: 'type', header: 'Type', sortable: true },
    { key: 'registrationNumber', header: 'Immatriculation', sortable: true, render: (v: Vehicle) => (
      <span className="font-mono text-sm bg-gray-50 px-2 py-0.5 rounded">{v.registrationNumber}</span>
    )},
    { key: 'status', header: 'Statut', sortable: true, render: (v: Vehicle) => (
      <StatusBadge type="vehicle" status={v.status} />
    )},
    { key: 'currentMileage', header: 'Kilometrage', sortable: true, render: (v: Vehicle) => (
      <span>{formatNumber(v.currentMileage)} km</span>
    )},
    { key: 'fuelType', header: 'Carburant', sortable: true },
    { key: 'actions', header: '', render: (v: Vehicle) => (
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => { e.stopPropagation(); router.push(`/flotte/${v.id}`); }}
      >
        Voir
      </Button>
    )},
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Flotte de Vehicules</h2>
          <p className="text-gray-500 mt-1">{mockVehicles.length} vehicules au total</p>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => router.push('/flotte/nouveau')}
        >
          Ajouter un vehicule
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Filtres</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            options={typeOptions}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            placeholder="Type de vehicule"
          />
          <Select
            options={statusOptions}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="Statut"
          />
          <Select
            options={ownershipOptions}
            value={ownershipFilter}
            onChange={(e) => setOwnershipFilter(e.target.value)}
            placeholder="Propriete"
          />
        </div>
      </Card>

      {/* Data table */}
      <Card>
        <DataTable<Vehicle & Record<string, unknown>>
          columns={columns}
          data={filtered as (Vehicle & Record<string, unknown>)[]}
          pageSize={10}
          searchPlaceholder="Rechercher un vehicule..."
          onRowClick={(v) => router.push(`/flotte/${v.id}`)}
          emptyMessage="Aucun vehicule trouve"
        />
      </Card>
    </motion.div>
  );
}
