'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Fuel, TrendingUp, Upload, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import DataTable from '@/components/ui/DataTable';
import { mockFuelEntries, mockVehicles, fuelConsumptionTrendData } from '@/lib/mock-data';
import type { FuelEntry } from '@/types';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';

export default function CarburantPage() {
  const router = useRouter();

  const totalLitres = mockFuelEntries.reduce((s, e) => s + e.quantity, 0);
  const totalCost = mockFuelEntries.reduce((s, e) => s + e.totalCost, 0);
  const avgConsumption = 8.7;

  const getVehicle = (id: string) => {
    const v = mockVehicles.find((vh) => vh.id === id);
    return v ? v.code : '-';
  };

  const columns = [
    { key: 'date', header: 'Date', sortable: true, render: (f: FuelEntry) => (
      <span className="text-sm">{formatDate(f.date)}</span>
    )},
    { key: 'vehicleId', header: 'Vehicule', sortable: true, render: (f: FuelEntry) => (
      <span className="font-mono text-sm">{getVehicle(f.vehicleId)}</span>
    )},
    { key: 'quantity', header: 'Quantite (L)', sortable: true, render: (f: FuelEntry) => (
      <span>{f.quantity} L</span>
    )},
    { key: 'unitPrice', header: 'Prix/L', render: (f: FuelEntry) => (
      <span>{f.unitPrice.toFixed(3)} EUR</span>
    )},
    { key: 'totalCost', header: 'Cout Total', sortable: true, render: (f: FuelEntry) => (
      <span className="font-medium">{formatCurrency(f.totalCost)}</span>
    )},
    { key: 'mileage', header: 'Kilometrage', sortable: true, render: (f: FuelEntry) => (
      <span>{formatNumber(f.mileage)} km</span>
    )},
    { key: 'station', header: 'Station', render: (f: FuelEntry) => (
      <span className="text-gray-500 text-sm truncate max-w-[150px] block">{f.station}</span>
    )},
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Gestion du Carburant</h2>
          <p className="text-gray-500 mt-1">{mockFuelEntries.length} entrees de carburant</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<Upload className="h-4 w-4" />}>Importer CSV</Button>
          <Button variant="outline" icon={<BarChart3 className="h-4 w-4" />} onClick={() => router.push('/carburant/analyse')}>
            Analyse
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Consommation Totale"
          value={`${formatNumber(Math.round(totalLitres))} L`}
          icon={<Fuel className="h-6 w-6" />}
          color="blue"
          index={0}
        />
        <StatCard
          title="Cout Total"
          value={formatCurrency(totalCost)}
          icon={<TrendingUp className="h-6 w-6" />}
          color="emerald"
          index={1}
        />
        <StatCard
          title="Moyenne L/100km"
          value={`${avgConsumption} L`}
          icon={<Fuel className="h-6 w-6" />}
          color="amber"
          index={2}
        />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Tendance de Consommation</CardTitle>
        </CardHeader>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={fuelConsumptionTrendData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #F1F5F9', borderRadius: '8px', fontSize: '13px' }}
              />
              <Bar dataKey="litres" name="Litres" fill="#2563EB" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Data table */}
      <Card>
        <CardHeader>
          <CardTitle>Historique des Pleins</CardTitle>
        </CardHeader>
        <DataTable<FuelEntry & Record<string, unknown>>
          columns={columns}
          data={mockFuelEntries as (FuelEntry & Record<string, unknown>)[]}
          pageSize={10}
          searchPlaceholder="Rechercher..."
        />
      </Card>
    </motion.div>
  );
}
