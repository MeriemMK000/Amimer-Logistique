'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import DatePicker from '@/components/ui/DatePicker';
import {
  maintenanceCostData,
  fuelConsumptionTrendData,
  fleetDistributionData,
  topCostlyVehiclesData,
  mockVehicles,
  mockDrivers,
  mockMissions,
} from '@/lib/mock-data';
import { VehicleStatus } from '@/types';
import { formatCurrency } from '@/lib/utils';

const vehicleStatusData = Object.values(VehicleStatus).map((status) => ({
  name: status,
  value: mockVehicles.filter((v) => v.status === status).length,
}));

const driverMissionCounts = mockDrivers.map((d) => ({
  chauffeur: `${d.firstName[0]}. ${d.lastName}`,
  missions: mockMissions.filter((m) => m.driverId === d.id).length,
})).sort((a, b) => b.missions - a.missions).slice(0, 8);

const statusColors = ['#10B981', '#2563EB', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function RapportsPage() {
  const [activeTab, setActiveTab] = useState('maintenance');

  const tabs = [
    { id: 'maintenance', label: 'Maintenance' },
    { id: 'carburant', label: 'Carburant' },
    { id: 'flotte', label: 'Flotte' },
    { id: 'chauffeurs', label: 'Chauffeurs' },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Rapports et Analyses</h2>
          <p className="text-gray-500 mt-1">Analyses detaillees de votre flotte</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<Download className="h-4 w-4" />}>Exporter PDF</Button>
          <Button variant="outline" icon={<Download className="h-4 w-4" />}>Exporter CSV</Button>
        </div>
      </div>

      {/* Date range */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <DatePicker label="Date de debut" defaultValue="2026-03-01" />
          <DatePicker label="Date de fin" defaultValue="2026-08-26" />
          <Button>Appliquer</Button>
        </div>
      </Card>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-4 space-y-6">
        {activeTab === 'maintenance' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Couts de Maintenance Mensuels</CardTitle>
                </CardHeader>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={maintenanceCostData} barSize={32}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #F1F5F9', borderRadius: '8px' }} formatter={(v) => [formatCurrency(Number(v)), 'Cout']} />
                      <Bar dataKey="cout" fill="#2563EB" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Vehicules les Plus Couteux</CardTitle>
                </CardHeader>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topCostlyVehiclesData} layout="vertical" barSize={20}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                      <YAxis type="category" dataKey="vehicule" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} width={65} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #F1F5F9', borderRadius: '8px' }} formatter={(v) => [formatCurrency(Number(v)), 'Cout']} />
                      <Bar dataKey="cout" fill="#F59E0B" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </>
        )}

        {activeTab === 'carburant' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Consommation Mensuelle</CardTitle>
              </CardHeader>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={fuelConsumptionTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #F1F5F9', borderRadius: '8px' }} />
                    <Legend iconType="circle" iconSize={8} />
                    <Line type="monotone" dataKey="litres" name="Litres" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="cout" name="Cout (EUR)" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Cout Carburant Mensuel</CardTitle>
              </CardHeader>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fuelConsumptionTrendData} barSize={32}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #F1F5F9', borderRadius: '8px' }} formatter={(v) => [formatCurrency(Number(v)), 'Cout']} />
                    <Bar dataKey="cout" fill="#10B981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'flotte' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Repartition par Type</CardTitle>
              </CardHeader>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={fleetDistributionData} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={4} dataKey="value" nameKey="name" stroke="none">
                      {fleetDistributionData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v} vehicules`, String(name)]} contentStyle={{ backgroundColor: '#fff', border: '1px solid #F1F5F9', borderRadius: '8px' }} />
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Repartition par Statut</CardTitle>
              </CardHeader>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={vehicleStatusData.filter((d) => d.value > 0)} cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={4} dataKey="value" nameKey="name" stroke="none">
                      {vehicleStatusData.filter((d) => d.value > 0).map((_, i) => (
                        <Cell key={i} fill={statusColors[i % statusColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, name) => [`${v} vehicules`, String(name)]} contentStyle={{ backgroundColor: '#fff', border: '1px solid #F1F5F9', borderRadius: '8px' }} />
                    <Legend verticalAlign="bottom" iconType="circle" iconSize={8} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        )}

        {activeTab === 'chauffeurs' && (
          <Card>
            <CardHeader>
              <CardTitle>Missions par Chauffeur</CardTitle>
            </CardHeader>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={driverMissionCounts} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="chauffeur" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #F1F5F9', borderRadius: '8px' }} formatter={(v) => [`${v} missions`, 'Missions']} />
                  <Bar dataKey="missions" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>
    </motion.div>
  );
}
