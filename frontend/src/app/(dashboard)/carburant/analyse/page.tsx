'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import Card, { CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { mockFuelAnalysis, mockVehicles, mockConstructorNorms } from '@/lib/mock-data';

export default function AnalyseCarburantPage() {
  const router = useRouter();

  const chartData = mockFuelAnalysis.map((a) => {
    const v = mockVehicles.find((vh) => vh.id === a.vehicleId);
    return {
      vehicule: v ? v.code : a.vehicleId,
      reel: a.averageConsumption,
      norme: a.normConsumption,
      deviation: a.deviationPercent,
      isAnomaly: a.isAnomaly,
    };
  });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <Button variant="ghost" onClick={() => router.push('/carburant')} icon={<ArrowLeft className="h-4 w-4" />}>
        Retour au carburant
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-slate-900">Analyse de Consommation</h2>
        <p className="text-gray-500 mt-1">Comparaison consommation reelle vs normes constructeur</p>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Consommation Reelle vs Norme Constructeur</CardTitle>
          <span className="text-xs text-gray-400">L/100km - Periode actuelle</span>
        </CardHeader>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" vertical={false} />
              <XAxis dataKey="vehicule" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748B' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#94A3B8' }} label={{ value: 'L/100km', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#94A3B8' } }} />
              <Tooltip
                contentStyle={{ backgroundColor: '#fff', border: '1px solid #F1F5F9', borderRadius: '8px', fontSize: '13px' }}
                formatter={(value, name) => [`${value} L/100km`, String(name) === 'reel' ? 'Reel' : 'Norme']}
              />
              <Legend iconType="circle" iconSize={8} formatter={(value) => <span className="text-sm text-gray-600 ml-1">{value === 'reel' ? 'Consommation Reelle' : 'Norme Constructeur'}</span>} />
              <Bar dataKey="reel" name="reel" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="norme" name="norme" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Analysis details */}
      <Card>
        <CardHeader>
          <CardTitle>Detail par Vehicule</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {mockFuelAnalysis.map((a) => {
            const v = mockVehicles.find((vh) => vh.id === a.vehicleId);
            return (
              <div key={a.id} className={`flex items-center justify-between p-4 rounded-lg ${a.isAnomaly ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-3">
                  {a.isAnomaly ? (
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                  ) : (
                    <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {v ? `${v.code} - ${v.brand} ${v.model}` : a.vehicleId}
                    </p>
                    <p className="text-xs text-gray-500">
                      {a.totalDistance.toLocaleString('fr-FR')} km parcourus - {a.totalFuel} L consommes
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">{a.averageConsumption} L/100km</p>
                    <p className="text-xs text-gray-400">Norme: {a.normConsumption} L/100km</p>
                  </div>
                  <Badge variant={a.isAnomaly ? 'danger' : 'success'}>
                    {a.deviationPercent > 0 ? '+' : ''}{a.deviationPercent}%
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Constructor norms */}
      <Card>
        <CardHeader>
          <CardTitle>Normes Constructeur Referencees</CardTitle>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </motion.div>
  );
}
