'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import Card, { CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import DatePicker from '@/components/ui/DatePicker';
import { mockVehicles, mockDrivers, mockMissionZones } from '@/lib/mock-data';
import { VehicleStatus, DriverStatus } from '@/types';

interface MissionFormData {
  vehicleId: string;
  driverId: string;
  departureLocation: string;
  arrivalLocation: string;
  departureDate: string;
  description: string;
  estimatedDistance: string;
  zoneId: string;
}

export default function NouvelleMissionPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MissionFormData>();

  const availableVehicles = mockVehicles
    .filter((v) => v.status === VehicleStatus.DISPONIBLE)
    .map((v) => ({ value: v.id, label: `${v.code} - ${v.brand} ${v.model}` }));

  const availableDrivers = mockDrivers
    .filter((d) => d.status === DriverStatus.ACTIF)
    .map((d) => ({ value: d.id, label: `${d.firstName} ${d.lastName} (${d.employeeNumber})` }));

  const zones = mockMissionZones.map((z) => ({ value: z.id, label: `${z.name} (${z.code})` }));

  const onSubmit = async (data: MissionFormData) => {
    console.log('Mission data:', data);
    toast.success('Mission creee avec succes (mode demo)');
    router.push('/missions');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl">
      <Button variant="ghost" onClick={() => router.push('/missions')} icon={<ArrowLeft className="h-4 w-4" />}>
        Retour aux missions
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-slate-900">Nouvelle Mission</h2>
        <p className="text-gray-500 mt-1">Planifier une nouvelle mission</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardTitle>Affectation</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Select
              label="Vehicule"
              options={availableVehicles}
              placeholder="Selectionner un vehicule"
              {...register('vehicleId', { required: 'Vehicule requis' })}
              error={errors.vehicleId?.message}
            />
            <Select
              label="Chauffeur"
              options={availableDrivers}
              placeholder="Selectionner un chauffeur"
              {...register('driverId', { required: 'Chauffeur requis' })}
              error={errors.driverId?.message}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>Trajet</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Input
              label="Lieu de depart"
              placeholder="Paris"
              {...register('departureLocation', { required: 'Lieu de depart requis' })}
              error={errors.departureLocation?.message}
            />
            <Input
              label="Lieu d'arrivee"
              placeholder="Lyon"
              {...register('arrivalLocation', { required: "Lieu d'arrivee requis" })}
              error={errors.arrivalLocation?.message}
            />
            <DatePicker
              label="Date de depart"
              {...register('departureDate', { required: 'Date requise' })}
              error={errors.departureDate?.message}
            />
            <Input
              label="Distance estimee (km)"
              type="number"
              placeholder="460"
              {...register('estimatedDistance')}
            />
            <Select
              label="Zone de mission"
              options={zones}
              placeholder="Selectionner une zone"
              {...register('zoneId')}
            />
          </div>
        </Card>

        <Card>
          <CardTitle>Description</CardTitle>
          <div className="mt-4">
            <Input
              label="Description de la mission"
              placeholder="Livraison client Lyon"
              {...register('description', { required: 'Description requise' })}
              error={errors.description?.message}
            />
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => router.push('/missions')}>
            Annuler
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Creer la mission
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
