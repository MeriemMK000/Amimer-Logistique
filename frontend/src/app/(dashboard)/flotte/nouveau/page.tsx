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
import { VehicleType, FuelType, OwnershipType } from '@/types';

interface VehicleFormData {
  code: string;
  brand: string;
  model: string;
  year: string;
  type: string;
  registrationNumber: string;
  vin: string;
  fuelType: string;
  ownershipType: string;
  currentMileage: string;
  acquisitionDate: string;
  acquisitionCost: string;
  depreciationRate: string;
}

export default function NouveauVehiculePage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<VehicleFormData>();

  const onSubmit = async (data: VehicleFormData) => {
    console.log('Vehicle data:', data);
    toast.success('Vehicule cree avec succes (mode demo)');
    router.push('/flotte');
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-4xl">
      <Button variant="ghost" onClick={() => router.push('/flotte')} icon={<ArrowLeft className="h-4 w-4" />}>
        Retour a la flotte
      </Button>

      <div>
        <h2 className="text-2xl font-bold text-slate-900">Ajouter un Vehicule</h2>
        <p className="text-gray-500 mt-1">Remplissez les informations du nouveau vehicule</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Identification */}
        <Card>
          <CardTitle>Identification</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Input
              label="Code vehicule"
              placeholder="VH-016"
              {...register('code', { required: 'Code requis' })}
              error={errors.code?.message}
            />
            <Input
              label="Immatriculation"
              placeholder="AB-123-CD"
              {...register('registrationNumber', { required: 'Immatriculation requise' })}
              error={errors.registrationNumber?.message}
            />
            <Input
              label="Marque"
              placeholder="Renault"
              {...register('brand', { required: 'Marque requise' })}
              error={errors.brand?.message}
            />
            <Input
              label="Modele"
              placeholder="Master"
              {...register('model', { required: 'Modele requis' })}
              error={errors.model?.message}
            />
            <Input
              label="Annee"
              type="number"
              placeholder="2024"
              {...register('year', { required: 'Annee requise' })}
              error={errors.year?.message}
            />
            <Input
              label="Numero VIN"
              placeholder="VF1MA000X12345678"
              {...register('vin', { required: 'VIN requis' })}
              error={errors.vin?.message}
            />
          </div>
        </Card>

        {/* Caracteristiques */}
        <Card>
          <CardTitle>Caracteristiques</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Select
              label="Type de vehicule"
              options={Object.values(VehicleType).map((t) => ({ value: t, label: t }))}
              placeholder="Selectionner un type"
              {...register('type', { required: 'Type requis' })}
            />
            <Select
              label="Type de carburant"
              options={Object.values(FuelType).map((t) => ({ value: t, label: t }))}
              placeholder="Selectionner le carburant"
              {...register('fuelType', { required: 'Carburant requis' })}
            />
            <Select
              label="Type de propriete"
              options={Object.values(OwnershipType).map((t) => ({
                value: t,
                label: t === 'PROPRE' ? 'Propre' : t === 'LOCATION' ? 'Location' : 'Credit-bail',
              }))}
              placeholder="Selectionner la propriete"
              {...register('ownershipType', { required: 'Propriete requise' })}
            />
            <Input
              label="Kilometrage actuel"
              type="number"
              placeholder="0"
              {...register('currentMileage')}
            />
          </div>
        </Card>

        {/* Financier */}
        <Card>
          <CardTitle>Informations Financieres</CardTitle>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <DatePicker
              label="Date d'acquisition"
              {...register('acquisitionDate', { required: 'Date requise' })}
              error={errors.acquisitionDate?.message}
            />
            <Input
              label="Cout d'acquisition (EUR)"
              type="number"
              placeholder="35000"
              {...register('acquisitionCost', { required: 'Cout requis' })}
              error={errors.acquisitionCost?.message}
            />
            <Input
              label="Taux d'amortissement (%)"
              type="number"
              placeholder="15"
              {...register('depreciationRate')}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" type="button" onClick={() => router.push('/flotte')}>
            Annuler
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Creer le vehicule
          </Button>
        </div>
      </form>
    </motion.div>
  );
}
