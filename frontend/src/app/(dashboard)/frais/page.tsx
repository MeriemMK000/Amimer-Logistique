'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Receipt, Download, Settings } from 'lucide-react';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import Tabs from '@/components/ui/Tabs';
import { mockMissionExpenses, mockExpenseScales, mockMissions, mockMissionZones } from '@/lib/mock-data';
import type { MissionExpense, ExpenseScale } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';

export default function FraisPage() {
  const [activeTab, setActiveTab] = useState('depenses');

  const getMission = (id: string) => {
    const m = mockMissions.find((ms) => ms.id === id);
    return m ? m.missionNumber : '-';
  };

  const getZone = (id: string) => {
    const z = mockMissionZones.find((zn) => zn.id === id);
    return z ? z.name : '-';
  };

  const expenseColumns = [
    { key: 'date', header: 'Date', sortable: true, render: (e: MissionExpense) => (
      <span className="text-sm">{formatDate(e.date)}</span>
    )},
    { key: 'missionId', header: 'Mission', render: (e: MissionExpense) => (
      <span className="font-mono text-sm">{getMission(e.missionId)}</span>
    )},
    { key: 'type', header: 'Type', sortable: true, render: (e: MissionExpense) => (
      <span className="capitalize text-sm">{e.type}</span>
    )},
    { key: 'description', header: 'Description', render: (e: MissionExpense) => (
      <span className="text-sm text-gray-600">{e.description}</span>
    )},
    { key: 'amount', header: 'Montant', sortable: true, render: (e: MissionExpense) => (
      <span className="font-medium">{formatCurrency(e.amount)}</span>
    )},
    { key: 'isReimbursed', header: 'Rembourse', render: (e: MissionExpense) => (
      <Badge variant={e.isReimbursed ? 'success' : 'warning'}>
        {e.isReimbursed ? 'Rembourse' : 'En attente'}
      </Badge>
    )},
  ];

  const scaleColumns = [
    { key: 'zoneId', header: 'Zone', render: (s: ExpenseScale) => (
      <span className="font-medium">{getZone(s.zoneId)}</span>
    )},
    { key: 'mealAllowance', header: 'Indemnite Repas', render: (s: ExpenseScale) => (
      <span>{formatCurrency(s.mealAllowance)}</span>
    )},
    { key: 'hotelAllowance', header: 'Indemnite Hotel', render: (s: ExpenseScale) => (
      <span>{formatCurrency(s.hotelAllowance)}</span>
    )},
    { key: 'kilometerRate', header: 'Taux km', render: (s: ExpenseScale) => (
      <span>{s.kilometerRate.toFixed(2)} EUR/km</span>
    )},
    { key: 'dailyAllowance', header: 'Indemnite Journaliere', render: (s: ExpenseScale) => (
      <span>{formatCurrency(s.dailyAllowance)}</span>
    )},
    { key: 'effectiveDate', header: 'Effectif depuis', render: (s: ExpenseScale) => (
      <span className="text-sm">{formatDate(s.effectiveDate)}</span>
    )},
  ];

  const tabs = [
    { id: 'depenses', label: 'Frais de Mission', icon: <Receipt className="h-4 w-4" />, count: mockMissionExpenses.length },
    { id: 'baremes', label: 'Baremes', icon: <Settings className="h-4 w-4" />, count: mockExpenseScales.length },
  ];

  const totalExpenses = mockMissionExpenses.reduce((s, e) => s + e.amount, 0);
  const reimbursed = mockMissionExpenses.filter((e) => e.isReimbursed).reduce((s, e) => s + e.amount, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Frais de Mission</h2>
          <p className="text-gray-500 mt-1">Gestion des frais et baremes</p>
        </div>
        <Button variant="outline" icon={<Download className="h-4 w-4" />}>Exporter</Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-gray-500">Total des Frais</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(totalExpenses)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Rembourse</p>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{formatCurrency(reimbursed)}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">En Attente</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{formatCurrency(totalExpenses - reimbursed)}</p>
        </Card>
      </div>

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <Card className="mt-4">
        {activeTab === 'depenses' && (
          <DataTable<MissionExpense & Record<string, unknown>>
            columns={expenseColumns}
            data={mockMissionExpenses as (MissionExpense & Record<string, unknown>)[]}
            pageSize={10}
            searchPlaceholder="Rechercher un frais..."
          />
        )}
        {activeTab === 'baremes' && (
          <>
            <CardHeader>
              <CardTitle>Baremes en Vigueur</CardTitle>
              <Button size="sm">Modifier</Button>
            </CardHeader>
            <DataTable<ExpenseScale & Record<string, unknown>>
              columns={scaleColumns}
              data={mockExpenseScales as (ExpenseScale & Record<string, unknown>)[]}
              searchable={false}
            />
          </>
        )}
      </Card>
    </motion.div>
  );
}
