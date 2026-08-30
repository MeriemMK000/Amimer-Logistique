'use client';

import React, { useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, Phone, Mail, Calendar, CreditCard, MapPin, Receipt, FileText } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import { mockDrivers, mockMissions, mockMissionExpenses } from '@/lib/mock-data';
import { formatDate } from '@/lib/utils';

export default function DriverDetailPage({ params }: PageProps<'/chauffeurs/[id]'>) {
  const { id } = use(params);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('info');

  const driver = mockDrivers.find((d) => d.id === id);

  if (!driver) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <EmptyState title="Chauffeur non trouve" description="Ce chauffeur n'existe pas." />
      </div>
    );
  }

  const driverMissions = mockMissions.filter((m) => m.driverId === id);
  const driverExpenses = mockMissionExpenses.filter((e) => e.driverId === id);

  const tabs = [
    { id: 'info', label: 'Informations' },
    { id: 'missions', label: 'Missions', count: driverMissions.length },
    { id: 'disponibilite', label: 'Disponibilite' },
    { id: 'frais', label: 'Frais', count: driverExpenses.length },
    { id: 'documents', label: 'Documents' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <Button variant="ghost" onClick={() => router.push('/chauffeurs')} icon={<ArrowLeft className="h-4 w-4" />}>
        Retour aux chauffeurs
      </Button>

      <Card>
        <div className="flex flex-col md:flex-row gap-6">
          <div className="h-24 w-24 bg-blue-100 rounded-2xl flex items-center justify-center text-2xl font-bold text-blue-600 shrink-0">
            {driver.firstName[0]}{driver.lastName[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">{driver.firstName} {driver.lastName}</h2>
                <p className="text-gray-500">{driver.employeeNumber} - {driver.department}</p>
              </div>
              <StatusBadge type="driver" status={driver.status} />
            </div>
            <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-600">
              <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 text-gray-400" />{driver.phone}</span>
              <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-gray-400" />{driver.email}</span>
              <span className="flex items-center gap-1.5"><CreditCard className="h-4 w-4 text-gray-400" />Permis {driver.licenseType}</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4 text-gray-400" />Embauche le {formatDate(driver.hireDate)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-4">
        {activeTab === 'info' && (
          <Card>
            <CardTitle>Informations Detaillees</CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div className="space-y-3">
                <InfoRow label="N Employe" value={driver.employeeNumber} />
                <InfoRow label="Email" value={driver.email} />
                <InfoRow label="Telephone" value={driver.phone} />
                <InfoRow label="Departement" value={driver.department} />
              </div>
              <div className="space-y-3">
                <InfoRow label="N Permis" value={driver.licenseNumber} />
                <InfoRow label="Categories" value={driver.licenseType} />
                <InfoRow label="Expiration Permis" value={formatDate(driver.licenseExpiry)} />
                <InfoRow label="Date d'embauche" value={formatDate(driver.hireDate)} />
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'missions' && (
          <Card>
            <CardHeader>
              <CardTitle>Missions du Chauffeur</CardTitle>
            </CardHeader>
            {driverMissions.length === 0 ? (
              <EmptyState title="Aucune mission" description="Aucune mission pour ce chauffeur." />
            ) : (
              <div className="space-y-3">
                {driverMissions.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors" onClick={() => router.push(`/missions/${m.id}`)}>
                    <div>
                      <p className="text-sm font-medium text-slate-900">{m.missionNumber}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />{m.departureLocation} → {m.arrivalLocation}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{formatDate(m.departureDate)}</span>
                      <StatusBadge type="mission" status={m.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'disponibilite' && (
          <Card>
            <EmptyState title="Calendrier de disponibilite" description="Le calendrier sera disponible apres connexion a l'API." />
          </Card>
        )}

        {activeTab === 'frais' && (
          <Card>
            <CardHeader>
              <CardTitle>Frais de Mission</CardTitle>
            </CardHeader>
            {driverExpenses.length === 0 ? (
              <EmptyState title="Aucun frais" description="Aucun frais de mission pour ce chauffeur." />
            ) : (
              <div className="space-y-3">
                {driverExpenses.map((e) => (
                  <div key={e.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{e.description}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Receipt className="h-3 w-3" />{e.type} - {formatDate(e.date)}
                      </p>
                    </div>
                    <span className="font-medium text-slate-900">{e.amount.toFixed(2)} EUR</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {activeTab === 'documents' && (
          <Card>
            <EmptyState title="Aucun document" description="Les documents du chauffeur seront disponibles apres connexion a l'API." icon={<FileText className="h-10 w-10 text-gray-300" />} />
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
