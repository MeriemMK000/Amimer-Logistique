'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Scale, Gauge, MapPin, ArrowLeftRight, Plus } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { mockMissionZones, mockConstructorNorms, mockExpenseScales } from '@/lib/mock-data';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function ParametresPage() {
  const [activeTab, setActiveTab] = useState('utilisateurs');

  const tabs = [
    { id: 'utilisateurs', label: 'Utilisateurs', icon: <Users className="h-4 w-4" /> },
    { id: 'baremes', label: 'Baremes', icon: <Scale className="h-4 w-4" /> },
    { id: 'normes', label: 'Normes Constructeur', icon: <Gauge className="h-4 w-4" /> },
    { id: 'zones', label: 'Zones de Mission', icon: <MapPin className="h-4 w-4" /> },
    { id: 'erp', label: 'Integration ERP', icon: <ArrowLeftRight className="h-4 w-4" /> },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Parametres</h2>
        <p className="text-gray-500 mt-1">Configuration du systeme</p>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-4">
        {activeTab === 'utilisateurs' && (
          <Card>
            <CardHeader>
              <CardTitle>Gestion des Utilisateurs</CardTitle>
              <Button size="sm" icon={<Plus className="h-4 w-4" />}>Ajouter</Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Nom</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Email</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Role</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  <tr>
                    <td className="px-4 py-3 font-medium">Admin FleetPro</td>
                    <td className="px-4 py-3 text-gray-600">admin@fleetpro.fr</td>
                    <td className="px-4 py-3"><Badge variant="info">ADMIN</Badge></td>
                    <td className="px-4 py-3"><Button variant="ghost" size="sm">Modifier</Button></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Marie Gestionnaire</td>
                    <td className="px-4 py-3 text-gray-600">marie.g@fleetpro.fr</td>
                    <td className="px-4 py-3"><Badge variant="purple">GESTIONNAIRE</Badge></td>
                    <td className="px-4 py-3"><Button variant="ghost" size="sm">Modifier</Button></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-medium">Pierre Lecteur</td>
                    <td className="px-4 py-3 text-gray-600">pierre.l@fleetpro.fr</td>
                    <td className="px-4 py-3"><Badge variant="default">LECTEUR</Badge></td>
                    <td className="px-4 py-3"><Button variant="ghost" size="sm">Modifier</Button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'baremes' && (
          <Card>
            <CardHeader>
              <CardTitle>Baremes de Frais</CardTitle>
              <Button size="sm" icon={<Plus className="h-4 w-4" />}>Ajouter</Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Zone</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Repas</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Hotel</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Km</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Journaliere</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Effectif</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {mockExpenseScales.map((s) => {
                    const zone = mockMissionZones.find((z) => z.id === s.zoneId);
                    return (
                      <tr key={s.id}>
                        <td className="px-4 py-3 font-medium">{zone?.name || '-'}</td>
                        <td className="px-4 py-3">{formatCurrency(s.mealAllowance)}</td>
                        <td className="px-4 py-3">{formatCurrency(s.hotelAllowance)}</td>
                        <td className="px-4 py-3">{s.kilometerRate.toFixed(2)} EUR</td>
                        <td className="px-4 py-3">{formatCurrency(s.dailyAllowance)}</td>
                        <td className="px-4 py-3">{formatDate(s.effectiveDate)}</td>
                        <td className="px-4 py-3"><Button variant="ghost" size="sm">Modifier</Button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'normes' && (
          <Card>
            <CardHeader>
              <CardTitle>Normes de Consommation Constructeur</CardTitle>
              <Button size="sm" icon={<Plus className="h-4 w-4" />}>Ajouter</Button>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Marque</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Modele</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Annee</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Carburant</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Norme (L/100km)</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Tolerance</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {mockConstructorNorms.map((n) => (
                    <tr key={n.id}>
                      <td className="px-4 py-3 font-medium">{n.brand}</td>
                      <td className="px-4 py-3">{n.model}</td>
                      <td className="px-4 py-3">{n.year}</td>
                      <td className="px-4 py-3">{n.fuelType}</td>
                      <td className="px-4 py-3 font-medium">{n.normConsumption}</td>
                      <td className="px-4 py-3">{n.tolerancePercent}%</td>
                      <td className="px-4 py-3"><Button variant="ghost" size="sm">Modifier</Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {activeTab === 'zones' && (
          <Card>
            <CardHeader>
              <CardTitle>Zones de Mission</CardTitle>
              <Button size="sm" icon={<Plus className="h-4 w-4" />}>Ajouter</Button>
            </CardHeader>
            <div className="space-y-3">
              {mockMissionZones.map((zone) => (
                <div key={zone.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{zone.name}</p>
                    <p className="text-xs text-gray-500">Code: {zone.code} - {zone.description}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={zone.isActive ? 'success' : 'default'}>
                      {zone.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Button variant="ghost" size="sm">Modifier</Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {activeTab === 'erp' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Integration ERP</CardTitle>
              </CardHeader>
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Exports ERP</p>
                      <p className="text-xs text-gray-500">Exporter les donnees vers votre ERP</p>
                    </div>
                    <Button size="sm">Configurer</Button>
                  </div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Imports ERP</p>
                      <p className="text-xs text-gray-500">Importer les donnees depuis votre ERP</p>
                    </div>
                    <Button size="sm">Configurer</Button>
                  </div>
                </div>
              </div>
            </Card>
            <Card>
              <EmptyState
                title="Aucune integration configuree"
                description="Configurez votre connexion ERP pour synchroniser les donnees automatiquement."
                action={{ label: 'Configurer', onClick: () => {} }}
              />
            </Card>
          </div>
        )}
      </div>
    </motion.div>
  );
}
