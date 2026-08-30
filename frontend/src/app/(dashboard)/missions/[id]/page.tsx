'use client';

import React, { use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Truck, Users, Calendar, Gauge, Fuel, ArrowRight } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { mockMissions, mockDrivers, mockVehicles, mockMissionExpenses } from '@/lib/mock-data';
import { formatDate, formatNumber, formatCurrency } from '@/lib/utils';

export default function MissionDetailPage({ params }: PageProps<'/missions/[id]'>) {
  const { id } = use(params);
  const router = useRouter();

  const mission = mockMissions.find((m) => m.id === id);
  if (!mission) {
    return <EmptyState title="Mission non trouvee" />;
  }

  const driver = mockDrivers.find((d) => d.id === mission.driverId);
  const vehicle = mockVehicles.find((v) => v.id === mission.vehicleId);
  const expenses = mockMissionExpenses.filter((e) => e.missionId === id);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Button variant="ghost" onClick={() => router.push('/missions')} icon={<ArrowLeft className="h-4 w-4" />}>
        Retour aux missions
      </Button>

      {/* Mission header */}
      <Card>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">{mission.missionNumber}</h2>
            <p className="text-gray-500">{mission.description}</p>
          </div>
          <StatusBadge type="mission" status={mission.status} />
        </div>

        {/* Route visualization */}
        <div className="flex items-center justify-center gap-4 py-6 bg-gray-50 rounded-xl my-4">
          <div className="text-center">
            <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <MapPin className="h-5 w-5 text-blue-600" />
            </div>
            <p className="text-sm font-medium text-slate-900">{mission.departureLocation}</p>
            <p className="text-xs text-gray-400">Depart</p>
          </div>
          <div className="flex items-center gap-2 text-gray-300">
            <div className="h-px w-16 bg-gray-300" />
            <ArrowRight className="h-4 w-4" />
            <div className="h-px w-16 bg-gray-300" />
          </div>
          <div className="text-center">
            <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
              <MapPin className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-slate-900">{mission.arrivalLocation}</p>
            <p className="text-xs text-gray-400">Arrivee</p>
          </div>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Chauffeur</p>
              <p className="text-sm font-medium text-slate-900">{driver ? `${driver.firstName} ${driver.lastName}` : '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Vehicule</p>
              <p className="text-sm font-medium text-slate-900">{vehicle ? `${vehicle.brand} ${vehicle.model}` : '-'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Date de depart</p>
              <p className="text-sm font-medium text-slate-900">{formatDate(mission.departureDate)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-xs text-gray-400">Distance</p>
              <p className="text-sm font-medium text-slate-900">
                {mission.distance > 0 ? `${formatNumber(mission.distance)} km` : `~${formatNumber(mission.estimatedDistance || 0)} km`}
              </p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mission info */}
        <Card>
          <CardTitle>Details de la Mission</CardTitle>
          <div className="space-y-3 mt-4">
            <InfoRow label="Kilometrage depart" value={`${formatNumber(mission.startMileage)} km`} />
            {mission.endMileage && <InfoRow label="Kilometrage arrivee" value={`${formatNumber(mission.endMileage)} km`} />}
            {mission.fuelConsumed && <InfoRow label="Carburant consomme" value={`${mission.fuelConsumed} L`} />}
            {mission.arrivalDate && <InfoRow label="Date d'arrivee" value={formatDate(mission.arrivalDate)} />}
            <InfoRow label="Distance estimee" value={`${formatNumber(mission.estimatedDistance || 0)} km`} />
          </div>
        </Card>

        {/* Expenses */}
        <Card>
          <CardHeader>
            <CardTitle>Frais de Mission</CardTitle>
          </CardHeader>
          {expenses.length === 0 ? (
            <EmptyState title="Aucun frais enregistre" />
          ) : (
            <div className="space-y-3">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{e.description}</p>
                    <p className="text-xs text-gray-400">{e.type} - {formatDate(e.date)}</p>
                  </div>
                  <span className="font-medium">{formatCurrency(e.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-3 border-t border-gray-100">
                <span className="font-medium text-gray-700">Total</span>
                <span className="font-bold text-slate-900">
                  {formatCurrency(expenses.reduce((sum, e) => sum + e.amount, 0))}
                </span>
              </div>
            </div>
          )}
        </Card>
      </div>
    </motion.div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-50">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}
