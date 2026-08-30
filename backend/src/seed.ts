import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { UserRole } from './common/enums';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  // Create admin user
  const userRepo = dataSource.getRepository('User');
  const existingAdmin = await userRepo.findOne({ where: { email: 'admin@fleetpro.dz' } });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash('Admin@123', 10);
    await userRepo.save({
      email: 'admin@fleetpro.dz',
      passwordHash: hashedPassword,
      firstName: 'Administrateur',
      lastName: 'Système',
      role: UserRole.ADMIN,
      isActive: true,
    });
    console.log('Admin user created: admin@fleetpro.dz / Admin@123');
  } else {
    console.log('Admin user already exists.');
  }

  // Create mission zones
  const zoneRepo = dataSource.getRepository('MissionZone');
  const zones = [
    { name: 'Zone Locale', code: 'ZL', description: 'Déplacements dans la même wilaya' },
    { name: 'Zone Régionale', code: 'ZR', description: 'Déplacements inter-wilayas (même région)' },
    { name: 'Zone Nationale', code: 'ZN', description: 'Déplacements longue distance' },
    { name: 'Zone Sud', code: 'ZS', description: 'Déplacements vers le Grand Sud' },
  ];

  for (const zone of zones) {
    const existing = await zoneRepo.findOne({ where: { code: zone.code } });
    if (!existing) {
      await zoneRepo.save(zone);
      console.log(`Zone créée: ${zone.name}`);
    }
  }

  // Create sample expense scales
  const scaleRepo = dataSource.getRepository('ExpenseScale');
  const scales = [
    { name: 'Barème Zone Locale', perDiemRate: 1500, mealRate: 500, accommodationRate: 0, kmRate: 8, effectiveDate: new Date('2024-01-01') },
    { name: 'Barème Zone Régionale', perDiemRate: 3000, mealRate: 800, accommodationRate: 3500, kmRate: 10, effectiveDate: new Date('2024-01-01') },
    { name: 'Barème Zone Nationale', perDiemRate: 5000, mealRate: 1200, accommodationRate: 6000, kmRate: 12, effectiveDate: new Date('2024-01-01') },
    { name: 'Barème Zone Sud', perDiemRate: 7000, mealRate: 1500, accommodationRate: 8000, kmRate: 15, effectiveDate: new Date('2024-01-01') },
  ];

  for (const scale of scales) {
    const existing = await scaleRepo.findOne({ where: { name: scale.name } });
    if (!existing) {
      await scaleRepo.save(scale);
      console.log(`Barème créé: ${scale.name}`);
    }
  }

  // Create constructor norms
  const normRepo = dataSource.getRepository('ConstructorNorm');
  const norms = [
    { brand: 'Toyota', model: 'Hilux', year: 2022, vehicleType: 'LOURD', fuelType: 'GASOIL', normConsumption: 8.5 },
    { brand: 'Toyota', model: 'Corolla', year: 2023, vehicleType: 'LEGER', fuelType: 'ESSENCE', normConsumption: 6.0 },
    { brand: 'Hyundai', model: 'Accent', year: 2023, vehicleType: 'LEGER', fuelType: 'ESSENCE', normConsumption: 5.8 },
    { brand: 'Renault', model: 'Kangoo', year: 2022, vehicleType: 'LEGER', fuelType: 'GASOIL', normConsumption: 5.5 },
    { brand: 'Isuzu', model: 'NPR', year: 2021, vehicleType: 'LOURD', fuelType: 'GASOIL', normConsumption: 14.0 },
    { brand: 'Mercedes', model: 'Actros', year: 2022, vehicleType: 'LOURD', fuelType: 'GASOIL', normConsumption: 28.0 },
    { brand: 'Caterpillar', model: '320', year: 2020, vehicleType: 'ENGIN', fuelType: 'GASOIL', normConsumption: 18.0 },
    { brand: 'Komatsu', model: 'PC200', year: 2021, vehicleType: 'ENGIN', fuelType: 'GASOIL', normConsumption: 16.0 },
  ];

  for (const norm of norms) {
    const existing = await normRepo.findOne({
      where: { brand: norm.brand, model: norm.model, year: norm.year },
    });
    if (!existing) {
      await normRepo.save(norm);
      console.log(`Norme constructeur créée: ${norm.brand} ${norm.model}`);
    }
  }

  console.log('\nSeed completed successfully!');
  await app.close();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
