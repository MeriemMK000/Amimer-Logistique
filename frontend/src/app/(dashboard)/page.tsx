'use client';

import React from 'react';
import { motion } from 'framer-motion';
import {
  Truck, Users, MapPin, Bell, TrendingUp,
  ArrowRight, Clock, AlertTriangle,
} from 'lucide-react';
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import StatCard from '@/components/ui/StatCard';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import StatusBadge from '@/components/ui/StatusBadge';
import Badge from '@/components/ui/Badge';
import {
  mockDashboardStats,
  maintenanceCostData,
  fleetDistributionData,
  fuelConsumptionTrendData,
  topCostlyVehiclesData,
  mockMissions,
  mockAlerts,
  mockVehicles,
  mockDrivers,
} from '@/lib/mock-data';
import { MissionStatus, AlertPriority } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

const stats = mockDashboardStats;
const recentMissions = mockMissions
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 5);
const recentAlerts = mockAlerts
  .filter((a) => !a.isDismissed)
  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  .slice(0, 5);

function getDriverName(driverId: string) {
  const d = mockDrivers.find((dr) => dr.id === driverId);
  return d ? `${d.firstName} ${d.lastName}` : '-';
}

function getVehicleLabel(vehicleId: string) {
  const v = mockVehicles.find((vh) => vh.id === vehicleId);
  return v ? `${v.brand} ${v.model}` : '-';
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white rounded-lg border border-gray-100 shadow-lg p-3 text-sm">
        <p className="font-medium text-slate-900 mb-1">{label}</p>
        {payload.map((entry, i) => (
          <p key={i} className="text-gray-600">
            <span className="inline-block w-2 h-2 rounded-full mr-2" style={{ backgroundColor: entry.color }} />
            {entry.name}: {typeof entry.value === 'number' && entry.name?.includes('cout')
              ? formatCurrency(entry.value)
              : entry.value.toLocaleString('fr-FR')}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Bonjour, bienvenue sur FleetPro</h2>
          <p className="text-gray-500 mt-1">
            Voici un apercu de votre flotte au {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Vehicules"
          value={stats.totalVehicles}
          icon={<Truck className="h-6 w-6" />}
          subtitle={`${stats.availableVehicles} dispo. / ${stats.inMissionVehicles} en mission / ${stats.inMaintenanceVehicles} en maint.`}
          color="blue"
          index={0}
        />
        <StatCard
          title="Chauffeurs Actifs"
          value={stats.activeDrivers}
          icon={<Users className="h-6 w-6" />}
          trend={{ value: 5, label: 'vs mois dernier' }}
          color="emerald"
          index={1}
        />
        <StatCard
          title="Missions en Cours"
          value={stats.ongoingMissions}
          icon={<MapPin className="h-6 w-6" />}
          trend={{ value: 12, label: 'vs semaine derniere' }}
          color="amber"
          index={2}
        />
        <StatCard
          title="Alertes Non Lues"
          value={stats.unreadAlerts}
          icon={<Bell className="h-6 w-6" />}
          trend={{ value: -8, label: 'vs hier' }}
          color="red"
          index={3}
        />
      </div>

      {/* Row 2: Charts - Maintenance costs + Fleet distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Couts de Maintenance</CardTitle>
              <span className="text-xs text-gray-400">6 derniers mois</span>
            </CardHeader>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={maintenanceCostData} barSize={32}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cout" name="Cout" fill="#2563EB" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Repartition de la Flotte</CardTitle>
              <span className="text-xs text-gray-400">Par type de vehicule</span>
            </CardHeader>
            <div className="h-72 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={fleetDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    nameKey="name"
                    stroke="none"
                  >
                    {fleetDistributionData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [`${value} vehicules`, String(name)]}
                    contentStyle={{
                      backgroundColor: '#fff',
                      border: '1px solid #F1F5F9',
                      borderRadius: '8px',
                      fontSize: '13px',
                    }}
                  />
                  <Legend
                    verticalAlign="middle"
                    align="right"
                    layout="vertical"
                    iconType="circle"
                    iconSize={8}
                    formatter={(value) => <span className="text-sm text-gray-600 ml-1">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Row 3: Charts - Fuel consumption + Top costly vehicles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Consommation Carburant</CardTitle>
              <span className="text-xs text-gray-400">Tendance mensuelle</span>
            </CardHeader>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fuelConsumptionTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-sm text-gray-600 ml-1">{value}</span>} />
                  <Line yAxisId="left" type="monotone" dataKey="litres" name="Litres" stroke="#2563EB" strokeWidth={2.5} dot={{ r: 4, fill: '#2563EB' }} activeDot={{ r: 6 }} />
                  <Line yAxisId="right" type="monotone" dataKey="cout" name="Cout (EUR)" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Vehicules les Plus Couteux</CardTitle>
              <span className="text-xs text-gray-400">Top 5 - Maintenance</span>
            </CardHeader>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topCostlyVehiclesData} layout="vertical" barSize={20}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} tickFormatter={(v) => `${v / 1000}k EUR`} />
                  <YAxis type="category" dataKey="vehicule" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} width={65} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="cout" name="Cout" fill="#F59E0B" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Row 4: Recent missions + Recent alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
        >
          <Card padding={false}>
            <div className="px-6 pt-6 pb-3">
              <CardHeader>
                <CardTitle>Dernieres Missions</CardTitle>
                <a href="/missions" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  Voir tout <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </CardHeader>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-t border-b border-gray-100 bg-gray-50/50">
                    <th className="px-6 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Mission</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Chauffeur</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Trajet</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentMissions.map((m) => (
                    <tr key={m.id} className="hover:bg-blue-50/30 transition-colors">
                      <td className="px-6 py-3">
                        <span className="font-medium text-slate-900">{m.missionNumber}</span>
                        <br />
                        <span className="text-xs text-gray-400">{getVehicleLabel(m.vehicleId)}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{getDriverName(m.driverId)}</td>
                      <td className="px-4 py-3 text-gray-600">
                        <div className="flex items-center gap-1">
                          <span>{m.departureLocation}</span>
                          <ArrowRight className="h-3 w-3 text-gray-300" />
                          <span>{m.arrivalLocation}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge type="mission" status={m.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <Card>
            <CardHeader>
              <CardTitle>Alertes Recentes</CardTitle>
              <a href="/alertes" className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                Voir tout <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </CardHeader>
            <div className="space-y-3">
              {recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-gray-50/50 hover:bg-gray-50 transition-colors"
                >
                  <div className={`p-2 rounded-lg shrink-0 ${
                    alert.priority === AlertPriority.CRITIQUE
                      ? 'bg-red-50'
                      : alert.priority === AlertPriority.MOYENNE
                      ? 'bg-amber-50'
                      : 'bg-blue-50'
                  }`}>
                    {alert.priority === AlertPriority.CRITIQUE ? (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    ) : alert.priority === AlertPriority.MOYENNE ? (
                      <Bell className="h-4 w-4 text-amber-500" />
                    ) : (
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{alert.title}</p>
                      <StatusBadge type="alertPriority" status={alert.priority} />
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1">{alert.message}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      {formatDate(alert.createdAt)}
                    </div>
                  </div>
                  {!alert.isRead && (
                    <div className="h-2 w-2 bg-blue-500 rounded-full shrink-0 mt-2" />
                  )}
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
