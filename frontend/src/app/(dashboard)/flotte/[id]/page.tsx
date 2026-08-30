'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Truck, Calendar, Gauge, Fuel, FileText,
  Wrench, MapPin, AlertTriangle, Users, Settings,
} from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import { mockVehicles, mockMaintenanceOrders, mockFuelEntries, mockMissions, mockIncidents, mockVehicleDocuments } from '@/lib/mock-data';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';

export default function VehicleDetailPage({ params }: PageProps<'/flotte/[id]'>) {
  const { id } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('info');

  const vehicle = mockVehicles.find((v) => v.id === id);

  if (!vehicle) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <EmptyState title="Vehicule non trouve" description="Ce vehicule n'existe pas ou a ete supprime." />
      </div>
    );
  }

  const vehicleMaintenance = mockMaintenanceOrders.filter((m) => m.vehicleId === id);
  const vehicleFuel = mockFuelEntries.filter((f) => f.vehicleId === id);
  const vehicleMissions = mockMissions.filter((m) => m.vehicleId === id);
  const vehicleIncidents = mockIncidents.filter((i) => i.vehicleId === id);
  const vehicleDocs = mockVehicleDocuments.filter((d) => d.vehicleId === id);

  const tabs = [
    { id: 'info', label: 'Informations', icon: <Settings className="h-4 w-4" /> },
    { id: 'documents', label: 'Documents', icon: <FileText className="h-4 w-4" />, count: vehicleDocs.length },
    { id: 'maintenance', label: 'Maintenance', icon: <Wrench className="h-4 w-4" />, count: vehicleMaintenance.length },
    { id: 'carburant', label: 'Carburant', icon: <Fuel className="h-4 w-4" />, count: vehicleFuel.length },
    { id: 'missions', label: 'Missions', icon: <MapPin className="h-4 w-4" />, count: vehicleMissions.length },
    { id: 'incidents', label: 'Incidents', icon: <AlertTriangle className="h-4 w-4" />, count: vehicleIncidents.length },
    { id: 'affectations', label: 'Affectations', icon: <Users className="h-4 w-4" /> },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push('/flotte')} icon={<ArrowLeft className="h-4 w-4" />}>
        Retour a la flotte
      </Button>

      {/* Vehicle header card */}
      <Card>
        <div className="flex flex-col md:flex-row gap-6">
          {/* Vehicle image placeholder */}
          <div className="w-full md:w-48 h-36 bg-gray-100 rounded-xl flex items-center justify-center shrink-0">
            <Truck className="h-16 w-16 text-gray-300" />
          </div>

          {/* Vehicle info */}
          <div className="flex-1">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">
                  {vehicle.brand} {vehicle.model}
                </h2>
                <p className="text-gray-500">{vehicle.code} - {vehicle.registrationNumber}</p>
              </div>
              <StatusBadge type="vehicle" status={vehicle.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Annee</p>
                  <p className="text-sm font-medium text-slate-900">{vehicle.year}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Gauge className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Kilometrage</p>
                  <p className="text-sm font-medium text-slate-900">{formatNumber(vehicle.currentMileage)} km</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Fuel className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Carburant</p>
                  <p className="text-sm font-medium text-slate-900">{vehicle.fuelType}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-400">Propriete</p>
                  <p className="text-sm font-medium text-slate-900">{vehicle.ownershipType}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {/* Tab content */}
      <div className="mt-4">
        {activeTab === 'info' && (
          <Card>
            <CardTitle>Informations Detaillees</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-3">
                <InfoRow label="VIN" value={vehicle.vin} />
                <InfoRow label="Type" value={vehicle.type} />
                <InfoRow label="Date d'acquisition" value={formatDate(vehicle.acquisitionDate)} />
                <InfoRow label="Cout d'acquisition" value={formatCurrency(vehicle.acquisitionCost)} />
              </div>
              <div className="space-y-3">
                <InfoRow label="Taux d'amortissement" value={`${vehicle.depreciationRate}%`} />
                <InfoRow label="Immatriculation" value={vehicle.registrationNumber} />
                <InfoRow label="Derniere mise a jour" value={formatDate(vehicle.updatedAt)} />
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'documents' && (
          <Card>
            <CardHeader>
              <CardTitle>Documents du Vehicule</CardTitle>
              <Button size="sm">Ajouter un document</Button>
            </CardHeader>
            {vehicleDocs.length === 0 ? (
              <EmptyState title="Aucun document" description="Aucun document n'est associe a ce vehicule." />
            ) : (
              <div className="space-y-3">
                {vehicleDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-blue-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-900">{doc.name}</p>
                        <p className="text-xs text-gray-500">N: {doc.number} - Expire le {formatDate(doc.expiryDate)}</p>
                      </div>
                    </div>
                    <Badge variant={new Date(doc.expiryDate) < new Date() ? 'danger' : 'success'}>
                      {new Date(doc.expiryDate) < new Date() ? 'Expire' : 'Valide'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'maintenance' && (
          <Card>
            <CardHeader>
              <CardTitle>Historique de Maintenance</CardTitle>
            </CardHeader>
            {vehicleMaintenance.length === 0 ? (
              <EmptyState title="Aucune maintenance" description="Aucun ordre de travail pour ce vehicule." />
            ) : (
              <div className="space-y-3">
                {vehicleMaintenance.map((mo) => (
                  <div key={mo.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{mo.description}</p>
                      <p className="text-xs text-gray-500">{mo.orderNumber} - {formatDate(mo.scheduledDate)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge type="maintenance" status={mo.status} />
                      <span className="text-sm text-gray-600">{formatCurrency(mo.actualCost || mo.estimatedCost)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'carburant' && (
          <Card>
            <CardHeader>
              <CardTitle>Consommation de Carburant</CardTitle>
            </CardHeader>
            {vehicleFuel.length === 0 ? (
              <EmptyState title="Aucune entree" description="Aucune consommation de carburant enregistree." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50/50">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Date</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Quantite</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Cout</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Station</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {vehicleFuel.slice(0, 10).map((fe) => (
                      <tr key={fe.id}>
                        <td className="px-4 py-3">{formatDate(fe.date)}</td>
                        <td className="px-4 py-3">{fe.quantity} L</td>
                        <td className="px-4 py-3">{formatCurrency(fe.totalCost)}</td>
                        <td className="px-4 py-3 text-gray-500">{fe.station}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {activeTab === 'missions' && (
          <Card>
            <CardHeader>
              <CardTitle>Missions du Vehicule</CardTitle>
            </CardHeader>
            {vehicleMissions.length === 0 ? (
              <EmptyState title="Aucune mission" description="Aucune mission associee a ce vehicule." />
            ) : (
              <div className="space-y-3">
                {vehicleMissions.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{m.missionNumber}</p>
                      <p className="text-xs text-gray-500">{m.departureLocation} → {m.arrivalLocation} - {formatDate(m.departureDate)}</p>
                    </div>
                    <StatusBadge type="mission" status={m.status} />
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'incidents' && (
          <Card>
            <CardHeader>
              <CardTitle>Incidents</CardTitle>
            </CardHeader>
            {vehicleIncidents.length === 0 ? (
              <EmptyState title="Aucun incident" description="Aucun incident enregistre pour ce vehicule." />
            ) : (
              <div className="space-y-3">
                {vehicleIncidents.map((inc) => (
                  <div key={inc.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{inc.description}</p>
                      <p className="text-xs text-gray-500">{formatDate(inc.date)} - {inc.location}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge type="incidentSeverity" status={inc.severity} />
                      <StatusBadge type="incidentStatus" status={inc.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'affectations' && (
          <Card>
            <EmptyState title="Aucune affectation" description="Les affectations seront disponibles apres connexion a l'API." />
          </Card>
        )}
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
