import {
  VehicleType, VehicleStatus, OwnershipType, FuelType,
  DriverStatus, MissionStatus, MaintenanceType, MaintenancePriority,
  MaintenanceOrderStatus, IncidentSeverity, IncidentType, IncidentStatus,
  AlertType, AlertPriority, DocumentType,
} from '@/types';
import type {
  Vehicle, Driver, Mission, MaintenanceOrder, MaintenancePlan, FuelEntry,
  Incident, Alert, MissionExpense, ExpenseScale, VehicleDocument,
  MissionZone, ConstructorNorm, FuelAnalysis, DashboardStats,
} from '@/types';

// ==================== VEHICLES ====================
export const mockVehicles: Vehicle[] = [
  {
    id: 'v1', code: 'VH-001', brand: 'Renault', model: 'Master', year: 2022,
    type: VehicleType.VU, registrationNumber: 'AB-123-CD', vin: 'VF1MA000X12345678',
    status: VehicleStatus.DISPONIBLE, fuelType: FuelType.DIESEL, ownershipType: OwnershipType.PROPRE,
    currentMileage: 45230, acquisitionDate: '2022-03-15', acquisitionCost: 35000, depreciationRate: 15,
    createdAt: '2022-03-15T10:00:00Z', updatedAt: '2026-08-20T14:30:00Z',
  },
  {
    id: 'v2', code: 'VH-002', brand: 'Peugeot', model: '308', year: 2023,
    type: VehicleType.VP, registrationNumber: 'EF-456-GH', vin: 'VF3PEUGEOT23456789',
    status: VehicleStatus.EN_MISSION, fuelType: FuelType.ESSENCE, ownershipType: OwnershipType.LOCATION,
    currentMileage: 28450, acquisitionDate: '2023-01-10', acquisitionCost: 28000, depreciationRate: 12,
    assignedDriverId: 'd1',
    createdAt: '2023-01-10T10:00:00Z', updatedAt: '2026-08-25T09:00:00Z',
  },
  {
    id: 'v3', code: 'VH-003', brand: 'Mercedes', model: 'Sprinter', year: 2021,
    type: VehicleType.VU, registrationNumber: 'IJ-789-KL', vin: 'WDB9061351N123456',
    status: VehicleStatus.EN_MAINTENANCE, fuelType: FuelType.DIESEL, ownershipType: OwnershipType.CREDIT_BAIL,
    currentMileage: 89200, acquisitionDate: '2021-06-20', acquisitionCost: 42000, depreciationRate: 18,
    createdAt: '2021-06-20T10:00:00Z', updatedAt: '2026-08-24T16:00:00Z',
  },
  {
    id: 'v4', code: 'VH-004', brand: 'Iveco', model: 'Daily', year: 2022,
    type: VehicleType.PL, registrationNumber: 'MN-012-OP', vin: 'ZCFC35A2005123456',
    status: VehicleStatus.DISPONIBLE, fuelType: FuelType.DIESEL, ownershipType: OwnershipType.PROPRE,
    currentMileage: 67800, acquisitionDate: '2022-09-01', acquisitionCost: 55000, depreciationRate: 20,
    createdAt: '2022-09-01T10:00:00Z', updatedAt: '2026-08-22T11:00:00Z',
  },
  {
    id: 'v5', code: 'VH-005', brand: 'Citroen', model: 'C5 Aircross', year: 2024,
    type: VehicleType.VP, registrationNumber: 'QR-345-ST', vin: 'VR7C5AIRCROSS12345',
    status: VehicleStatus.EN_MISSION, fuelType: FuelType.HYBRIDE, ownershipType: OwnershipType.LOCATION,
    currentMileage: 12300, acquisitionDate: '2024-02-15', acquisitionCost: 38000, depreciationRate: 10,
    assignedDriverId: 'd3',
    createdAt: '2024-02-15T10:00:00Z', updatedAt: '2026-08-25T08:00:00Z',
  },
  {
    id: 'v6', code: 'VH-006', brand: 'Renault', model: 'Kangoo E-Tech', year: 2024,
    type: VehicleType.VU, registrationNumber: 'UV-678-WX', vin: 'VF1KANGOO24567890',
    status: VehicleStatus.DISPONIBLE, fuelType: FuelType.ELECTRIQUE, ownershipType: OwnershipType.PROPRE,
    currentMileage: 8900, acquisitionDate: '2024-05-10', acquisitionCost: 32000, depreciationRate: 8,
    createdAt: '2024-05-10T10:00:00Z', updatedAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'v7', code: 'VH-007', brand: 'Volvo', model: 'FH16', year: 2020,
    type: VehicleType.PL, registrationNumber: 'YZ-901-AB', vin: 'YV2RT40A5LA123456',
    status: VehicleStatus.EN_MISSION, fuelType: FuelType.DIESEL, ownershipType: OwnershipType.PROPRE,
    currentMileage: 234500, acquisitionDate: '2020-01-20', acquisitionCost: 120000, depreciationRate: 22,
    assignedDriverId: 'd5',
    createdAt: '2020-01-20T10:00:00Z', updatedAt: '2026-08-25T07:00:00Z',
  },
  {
    id: 'v8', code: 'VH-008', brand: 'Peugeot', model: 'e-208', year: 2025,
    type: VehicleType.VP, registrationNumber: 'CD-234-EF', vin: 'VR3E208EL25678901',
    status: VehicleStatus.DISPONIBLE, fuelType: FuelType.ELECTRIQUE, ownershipType: OwnershipType.LOCATION,
    currentMileage: 3200, acquisitionDate: '2025-03-01', acquisitionCost: 35000, depreciationRate: 8,
    createdAt: '2025-03-01T10:00:00Z', updatedAt: '2026-08-19T10:00:00Z',
  },
  {
    id: 'v9', code: 'VH-009', brand: 'Fiat', model: 'Ducato', year: 2021,
    type: VehicleType.VU, registrationNumber: 'GH-567-IJ', vin: 'ZFA25000002123456',
    status: VehicleStatus.HORS_SERVICE, fuelType: FuelType.DIESEL, ownershipType: OwnershipType.PROPRE,
    currentMileage: 156000, acquisitionDate: '2021-04-12', acquisitionCost: 38000, depreciationRate: 18,
    createdAt: '2021-04-12T10:00:00Z', updatedAt: '2026-08-18T10:00:00Z',
  },
  {
    id: 'v10', code: 'VH-010', brand: 'Toyota', model: 'Hilux', year: 2023,
    type: VehicleType.VU, registrationNumber: 'KL-890-MN', vin: 'JTFDT4CD1DJ123456',
    status: VehicleStatus.EN_MAINTENANCE, fuelType: FuelType.DIESEL, ownershipType: OwnershipType.PROPRE,
    currentMileage: 42100, acquisitionDate: '2023-07-01', acquisitionCost: 45000, depreciationRate: 14,
    createdAt: '2023-07-01T10:00:00Z', updatedAt: '2026-08-23T10:00:00Z',
  },
  {
    id: 'v11', code: 'VH-011', brand: 'Ford', model: 'Transit', year: 2022,
    type: VehicleType.VU, registrationNumber: 'OP-123-QR', vin: 'WF0TRANSIT22456789',
    status: VehicleStatus.DISPONIBLE, fuelType: FuelType.DIESEL, ownershipType: OwnershipType.CREDIT_BAIL,
    currentMileage: 58300, acquisitionDate: '2022-11-15', acquisitionCost: 40000, depreciationRate: 16,
    createdAt: '2022-11-15T10:00:00Z', updatedAt: '2026-08-21T10:00:00Z',
  },
  {
    id: 'v12', code: 'VH-012', brand: 'Renault', model: 'Trafic', year: 2023,
    type: VehicleType.VU, registrationNumber: 'ST-456-UV', vin: 'VF1TRAFIC23567890',
    status: VehicleStatus.EN_MISSION, fuelType: FuelType.DIESEL, ownershipType: OwnershipType.PROPRE,
    currentMileage: 35600, acquisitionDate: '2023-04-20', acquisitionCost: 36000, depreciationRate: 14,
    assignedDriverId: 'd7',
    createdAt: '2023-04-20T10:00:00Z', updatedAt: '2026-08-25T06:00:00Z',
  },
  {
    id: 'v13', code: 'VH-013', brand: 'Caterpillar', model: '320', year: 2019,
    type: VehicleType.ENGIN, registrationNumber: 'N/A', vin: 'CAT0320GC19123456',
    status: VehicleStatus.DISPONIBLE, fuelType: FuelType.DIESEL, ownershipType: OwnershipType.PROPRE,
    currentMileage: 4200, acquisitionDate: '2019-08-10', acquisitionCost: 180000, depreciationRate: 25,
    createdAt: '2019-08-10T10:00:00Z', updatedAt: '2026-08-15T10:00:00Z',
  },
  {
    id: 'v14', code: 'VH-014', brand: 'Dacia', model: 'Duster', year: 2024,
    type: VehicleType.VP, registrationNumber: 'WX-789-YZ', vin: 'UU1DUSTER24678901',
    status: VehicleStatus.EN_ATTENTE, fuelType: FuelType.GPL, ownershipType: OwnershipType.PROPRE,
    currentMileage: 5100, acquisitionDate: '2024-06-01', acquisitionCost: 22000, depreciationRate: 12,
    createdAt: '2024-06-01T10:00:00Z', updatedAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'v15', code: 'VH-015', brand: 'MAN', model: 'TGX', year: 2021,
    type: VehicleType.PL, registrationNumber: 'AB-012-CD', vin: 'WMAN0TGX21234567',
    status: VehicleStatus.DISPONIBLE, fuelType: FuelType.DIESEL, ownershipType: OwnershipType.PROPRE,
    currentMileage: 198700, acquisitionDate: '2021-02-28', acquisitionCost: 135000, depreciationRate: 22,
    createdAt: '2021-02-28T10:00:00Z', updatedAt: '2026-08-22T10:00:00Z',
  },
];

// ==================== DRIVERS ====================
export const mockDrivers: Driver[] = [
  {
    id: 'd1', employeeNumber: 'EMP-001', firstName: 'Jean', lastName: 'Dupont',
    email: 'jean.dupont@fleetpro.fr', phone: '06 12 34 56 78',
    licenseNumber: '12AB34567', licenseType: 'B, C', licenseExpiry: '2027-06-15',
    status: DriverStatus.EN_MISSION, hireDate: '2019-03-01', department: 'Logistique',
    createdAt: '2019-03-01T10:00:00Z', updatedAt: '2026-08-25T09:00:00Z',
  },
  {
    id: 'd2', employeeNumber: 'EMP-002', firstName: 'Marie', lastName: 'Martin',
    email: 'marie.martin@fleetpro.fr', phone: '06 23 45 67 89',
    licenseNumber: '23CD45678', licenseType: 'B', licenseExpiry: '2026-12-01',
    status: DriverStatus.ACTIF, hireDate: '2020-06-15', department: 'Commercial',
    createdAt: '2020-06-15T10:00:00Z', updatedAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'd3', employeeNumber: 'EMP-003', firstName: 'Pierre', lastName: 'Bernard',
    email: 'pierre.bernard@fleetpro.fr', phone: '06 34 56 78 90',
    licenseNumber: '34EF56789', licenseType: 'B, C, CE', licenseExpiry: '2028-03-20',
    status: DriverStatus.EN_MISSION, hireDate: '2018-09-01', department: 'Transport',
    createdAt: '2018-09-01T10:00:00Z', updatedAt: '2026-08-25T08:00:00Z',
  },
  {
    id: 'd4', employeeNumber: 'EMP-004', firstName: 'Sophie', lastName: 'Petit',
    email: 'sophie.petit@fleetpro.fr', phone: '06 45 67 89 01',
    licenseNumber: '45GH67890', licenseType: 'B', licenseExpiry: '2027-09-10',
    status: DriverStatus.ACTIF, hireDate: '2021-01-10', department: 'Commercial',
    createdAt: '2021-01-10T10:00:00Z', updatedAt: '2026-08-18T10:00:00Z',
  },
  {
    id: 'd5', employeeNumber: 'EMP-005', firstName: 'Luc', lastName: 'Moreau',
    email: 'luc.moreau@fleetpro.fr', phone: '06 56 78 90 12',
    licenseNumber: '56IJ78901', licenseType: 'B, C, CE', licenseExpiry: '2026-11-30',
    status: DriverStatus.EN_MISSION, hireDate: '2017-04-15', department: 'Transport',
    createdAt: '2017-04-15T10:00:00Z', updatedAt: '2026-08-25T07:00:00Z',
  },
  {
    id: 'd6', employeeNumber: 'EMP-006', firstName: 'Claire', lastName: 'Leroy',
    email: 'claire.leroy@fleetpro.fr', phone: '06 67 89 01 23',
    licenseNumber: '67KL89012', licenseType: 'B', licenseExpiry: '2028-02-28',
    status: DriverStatus.EN_CONGE, hireDate: '2022-03-20', department: 'Logistique',
    createdAt: '2022-03-20T10:00:00Z', updatedAt: '2026-08-15T10:00:00Z',
  },
  {
    id: 'd7', employeeNumber: 'EMP-007', firstName: 'Thomas', lastName: 'Roux',
    email: 'thomas.roux@fleetpro.fr', phone: '06 78 90 12 34',
    licenseNumber: '78MN90123', licenseType: 'B, C', licenseExpiry: '2027-07-15',
    status: DriverStatus.EN_MISSION, hireDate: '2020-11-01', department: 'Transport',
    createdAt: '2020-11-01T10:00:00Z', updatedAt: '2026-08-25T06:00:00Z',
  },
  {
    id: 'd8', employeeNumber: 'EMP-008', firstName: 'Emma', lastName: 'Fournier',
    email: 'emma.fournier@fleetpro.fr', phone: '06 89 01 23 45',
    licenseNumber: '89OP01234', licenseType: 'B', licenseExpiry: '2029-01-15',
    status: DriverStatus.ACTIF, hireDate: '2023-02-01', department: 'Commercial',
    createdAt: '2023-02-01T10:00:00Z', updatedAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'd9', employeeNumber: 'EMP-009', firstName: 'Antoine', lastName: 'Girard',
    email: 'antoine.girard@fleetpro.fr', phone: '06 90 12 34 56',
    licenseNumber: '90QR12345', licenseType: 'B, C, D', licenseExpiry: '2027-05-20',
    status: DriverStatus.SUSPENDU, hireDate: '2019-07-01', department: 'Transport',
    createdAt: '2019-07-01T10:00:00Z', updatedAt: '2026-08-10T10:00:00Z',
  },
  {
    id: 'd10', employeeNumber: 'EMP-010', firstName: 'Julie', lastName: 'Lambert',
    email: 'julie.lambert@fleetpro.fr', phone: '06 01 23 45 67',
    licenseNumber: '01ST23456', licenseType: 'B', licenseExpiry: '2028-08-31',
    status: DriverStatus.ACTIF, hireDate: '2024-01-15', department: 'Logistique',
    createdAt: '2024-01-15T10:00:00Z', updatedAt: '2026-08-22T10:00:00Z',
  },
];

// ==================== MISSIONS ====================
export const mockMissions: Mission[] = [
  {
    id: 'm1', missionNumber: 'MSN-2026-001', vehicleId: 'v2', driverId: 'd1',
    departureLocation: 'Paris', arrivalLocation: 'Lyon',
    departureDate: '2026-08-25T08:00:00Z', status: MissionStatus.EN_COURS,
    distance: 465, estimatedDistance: 460, description: 'Livraison client Lyon',
    startMileage: 28000, fuelConsumed: 32,
    createdAt: '2026-08-24T10:00:00Z', updatedAt: '2026-08-25T09:00:00Z',
  },
  {
    id: 'm2', missionNumber: 'MSN-2026-002', vehicleId: 'v5', driverId: 'd3',
    departureLocation: 'Marseille', arrivalLocation: 'Nice',
    departureDate: '2026-08-25T07:00:00Z', status: MissionStatus.EN_COURS,
    distance: 200, estimatedDistance: 195, description: 'Reunion commerciale Nice',
    startMileage: 12100,
    createdAt: '2026-08-24T14:00:00Z', updatedAt: '2026-08-25T08:00:00Z',
  },
  {
    id: 'm3', missionNumber: 'MSN-2026-003', vehicleId: 'v7', driverId: 'd5',
    departureLocation: 'Lille', arrivalLocation: 'Bruxelles',
    departureDate: '2026-08-25T06:00:00Z', status: MissionStatus.EN_COURS,
    distance: 300, estimatedDistance: 290, description: 'Transport marchandises Belgique',
    startMileage: 234000, fuelConsumed: 95,
    createdAt: '2026-08-24T16:00:00Z', updatedAt: '2026-08-25T07:00:00Z',
  },
  {
    id: 'm4', missionNumber: 'MSN-2026-004', vehicleId: 'v12', driverId: 'd7',
    departureLocation: 'Bordeaux', arrivalLocation: 'Toulouse',
    departureDate: '2026-08-25T05:00:00Z', status: MissionStatus.EN_COURS,
    distance: 245, estimatedDistance: 240, description: 'Approvisionnement entrepot',
    startMileage: 35200,
    createdAt: '2026-08-24T18:00:00Z', updatedAt: '2026-08-25T06:00:00Z',
  },
  {
    id: 'm5', missionNumber: 'MSN-2026-005', vehicleId: 'v1', driverId: 'd2',
    departureLocation: 'Paris', arrivalLocation: 'Strasbourg',
    departureDate: '2026-08-22T07:00:00Z', arrivalDate: '2026-08-22T15:00:00Z',
    status: MissionStatus.TERMINEE, distance: 490, estimatedDistance: 485,
    description: 'Livraison pieces detachees', startMileage: 44740, endMileage: 45230,
    fuelConsumed: 38,
    createdAt: '2026-08-21T10:00:00Z', updatedAt: '2026-08-22T16:00:00Z',
  },
  {
    id: 'm6', missionNumber: 'MSN-2026-006', vehicleId: 'v4', driverId: 'd4',
    departureLocation: 'Nantes', arrivalLocation: 'Rennes',
    departureDate: '2026-08-21T08:00:00Z', arrivalDate: '2026-08-21T12:00:00Z',
    status: MissionStatus.TERMINEE, distance: 110, estimatedDistance: 108,
    description: 'Collecte materiaux chantier', startMileage: 67690, endMileage: 67800,
    fuelConsumed: 22,
    createdAt: '2026-08-20T10:00:00Z', updatedAt: '2026-08-21T13:00:00Z',
  },
  {
    id: 'm7', missionNumber: 'MSN-2026-007', vehicleId: 'v8', driverId: 'd8',
    departureLocation: 'Lyon', arrivalLocation: 'Grenoble',
    departureDate: '2026-08-20T09:00:00Z', arrivalDate: '2026-08-20T14:00:00Z',
    status: MissionStatus.TERMINEE, distance: 115, estimatedDistance: 112,
    description: 'Visite client Grenoble', startMileage: 3100, endMileage: 3200,
    createdAt: '2026-08-19T10:00:00Z', updatedAt: '2026-08-20T15:00:00Z',
  },
  {
    id: 'm8', missionNumber: 'MSN-2026-008', vehicleId: 'v11', driverId: 'd10',
    departureLocation: 'Toulouse', arrivalLocation: 'Montpellier',
    departureDate: '2026-08-19T07:00:00Z', arrivalDate: '2026-08-19T13:00:00Z',
    status: MissionStatus.TERMINEE, distance: 245, estimatedDistance: 240,
    description: 'Livraison express Montpellier', startMileage: 57800, endMileage: 58050,
    fuelConsumed: 18,
    createdAt: '2026-08-18T10:00:00Z', updatedAt: '2026-08-19T14:00:00Z',
  },
  {
    id: 'm9', missionNumber: 'MSN-2026-009', vehicleId: 'v6', driverId: 'd2',
    departureLocation: 'Paris', arrivalLocation: 'Orleans',
    departureDate: '2026-08-27T08:00:00Z', status: MissionStatus.PLANIFIEE,
    distance: 0, estimatedDistance: 130, description: 'Livraison documents contractuels',
    startMileage: 8900,
    createdAt: '2026-08-25T10:00:00Z', updatedAt: '2026-08-25T10:00:00Z',
  },
  {
    id: 'm10', missionNumber: 'MSN-2026-010', vehicleId: 'v15', driverId: 'd5',
    departureLocation: 'Dijon', arrivalLocation: 'Metz',
    departureDate: '2026-08-28T06:00:00Z', status: MissionStatus.PLANIFIEE,
    distance: 0, estimatedDistance: 380, description: 'Transport longue distance',
    startMileage: 198700,
    createdAt: '2026-08-25T11:00:00Z', updatedAt: '2026-08-25T11:00:00Z',
  },
  {
    id: 'm11', missionNumber: 'MSN-2026-011', vehicleId: 'v1', driverId: 'd4',
    departureLocation: 'Rouen', arrivalLocation: 'Le Havre',
    departureDate: '2026-08-18T07:00:00Z', arrivalDate: '2026-08-18T11:00:00Z',
    status: MissionStatus.TERMINEE, distance: 88, estimatedDistance: 85,
    description: 'Inspection port du Havre', startMileage: 44650, endMileage: 44740,
    fuelConsumed: 8,
    createdAt: '2026-08-17T10:00:00Z', updatedAt: '2026-08-18T12:00:00Z',
  },
  {
    id: 'm12', missionNumber: 'MSN-2026-012', vehicleId: 'v2', driverId: 'd1',
    departureLocation: 'Paris', arrivalLocation: 'Reims',
    departureDate: '2026-08-17T08:00:00Z', arrivalDate: '2026-08-17T16:00:00Z',
    status: MissionStatus.TERMINEE, distance: 290, estimatedDistance: 285,
    description: 'Formation partenaire Reims', startMileage: 27700, endMileage: 28000,
    fuelConsumed: 20,
    createdAt: '2026-08-16T10:00:00Z', updatedAt: '2026-08-17T17:00:00Z',
  },
  {
    id: 'm13', missionNumber: 'MSN-2026-013', vehicleId: 'v5', driverId: 'd3',
    departureLocation: 'Aix-en-Provence', arrivalLocation: 'Avignon',
    departureDate: '2026-08-16T09:00:00Z', arrivalDate: '2026-08-16T13:00:00Z',
    status: MissionStatus.TERMINEE, distance: 80, estimatedDistance: 78,
    description: 'Prospection clientele', startMileage: 12000, endMileage: 12080,
    createdAt: '2026-08-15T10:00:00Z', updatedAt: '2026-08-16T14:00:00Z',
  },
  {
    id: 'm14', missionNumber: 'MSN-2026-014', vehicleId: 'v4', driverId: 'd7',
    departureLocation: 'Clermont-Ferrand', arrivalLocation: 'Saint-Etienne',
    departureDate: '2026-08-15T06:00:00Z', arrivalDate: '2026-08-15T14:00:00Z',
    status: MissionStatus.TERMINEE, distance: 170, estimatedDistance: 165,
    description: 'Approvisionnement usine', startMileage: 67500, endMileage: 67690,
    fuelConsumed: 30,
    createdAt: '2026-08-14T10:00:00Z', updatedAt: '2026-08-15T15:00:00Z',
  },
  {
    id: 'm15', missionNumber: 'MSN-2026-015', vehicleId: 'v7', driverId: 'd5',
    departureLocation: 'Calais', arrivalLocation: 'Paris',
    departureDate: '2026-08-20T04:00:00Z', arrivalDate: '2026-08-20T10:00:00Z',
    status: MissionStatus.TERMINEE, distance: 295, estimatedDistance: 290,
    description: 'Retour chargement international', startMileage: 233700, endMileage: 234000,
    fuelConsumed: 90,
    createdAt: '2026-08-19T10:00:00Z', updatedAt: '2026-08-20T11:00:00Z',
  },
  {
    id: 'm16', missionNumber: 'MSN-2026-016', vehicleId: 'v11', driverId: 'd8',
    departureLocation: 'Angers', arrivalLocation: 'Tours',
    departureDate: '2026-08-14T08:00:00Z', arrivalDate: '2026-08-14T12:00:00Z',
    status: MissionStatus.TERMINEE, distance: 120, estimatedDistance: 115,
    description: 'Livraison equipements', startMileage: 57550, endMileage: 57680,
    fuelConsumed: 10,
    createdAt: '2026-08-13T10:00:00Z', updatedAt: '2026-08-14T13:00:00Z',
  },
  {
    id: 'm17', missionNumber: 'MSN-2026-017', vehicleId: 'v6', driverId: 'd10',
    departureLocation: 'Paris', arrivalLocation: 'Chartres',
    departureDate: '2026-08-13T09:00:00Z', arrivalDate: '2026-08-13T15:00:00Z',
    status: MissionStatus.TERMINEE, distance: 95, estimatedDistance: 90,
    description: 'Visite site client', startMileage: 8800, endMileage: 8900,
    createdAt: '2026-08-12T10:00:00Z', updatedAt: '2026-08-13T16:00:00Z',
  },
  {
    id: 'm18', missionNumber: 'MSN-2026-018', vehicleId: 'v12', driverId: 'd7',
    departureLocation: 'Bayonne', arrivalLocation: 'Pau',
    departureDate: '2026-08-12T07:00:00Z', arrivalDate: '2026-08-12T11:00:00Z',
    status: MissionStatus.TERMINEE, distance: 115, estimatedDistance: 110,
    description: 'Collecte retours clients', startMileage: 35050, endMileage: 35170,
    fuelConsumed: 9,
    createdAt: '2026-08-11T10:00:00Z', updatedAt: '2026-08-12T12:00:00Z',
  },
  {
    id: 'm19', missionNumber: 'MSN-2026-019', vehicleId: 'v15', driverId: 'd9',
    departureLocation: 'Lyon', arrivalLocation: 'Milan',
    departureDate: '2026-08-10T04:00:00Z', arrivalDate: '2026-08-10T14:00:00Z',
    status: MissionStatus.TERMINEE, distance: 520, estimatedDistance: 510,
    description: 'Transport international Italie', startMileage: 198100, endMileage: 198700,
    fuelConsumed: 160,
    createdAt: '2026-08-09T10:00:00Z', updatedAt: '2026-08-10T15:00:00Z',
  },
  {
    id: 'm20', missionNumber: 'MSN-2026-020', vehicleId: 'v14', driverId: 'd4',
    departureLocation: 'Limoges', arrivalLocation: 'Poitiers',
    departureDate: '2026-08-29T08:00:00Z', status: MissionStatus.PLANIFIEE,
    distance: 0, estimatedDistance: 120, description: 'Audit entrepot Poitiers',
    startMileage: 5100,
    createdAt: '2026-08-25T14:00:00Z', updatedAt: '2026-08-25T14:00:00Z',
  },
];

// ==================== MAINTENANCE ORDERS ====================
export const mockMaintenanceOrders: MaintenanceOrder[] = [
  {
    id: 'mo1', orderNumber: 'OT-2026-001', vehicleId: 'v3', type: MaintenanceType.CORRECTIVE,
    priority: MaintenancePriority.HAUTE, status: MaintenanceOrderStatus.EN_COURS,
    description: 'Remplacement embrayage', scheduledDate: '2026-08-24',
    estimatedCost: 1200, provider: 'Garage Central Paris',
    notes: 'Embrayage patine depuis 500 km',
    createdAt: '2026-08-23T10:00:00Z', updatedAt: '2026-08-24T08:00:00Z',
  },
  {
    id: 'mo2', orderNumber: 'OT-2026-002', vehicleId: 'v10', type: MaintenanceType.REVISION,
    priority: MaintenancePriority.NORMALE, status: MaintenanceOrderStatus.EN_COURS,
    description: 'Revision 40 000 km', scheduledDate: '2026-08-23',
    estimatedCost: 450, provider: 'Toyota Service Marseille',
    createdAt: '2026-08-22T10:00:00Z', updatedAt: '2026-08-23T09:00:00Z',
  },
  {
    id: 'mo3', orderNumber: 'OT-2026-003', vehicleId: 'v1', type: MaintenanceType.PREVENTIVE,
    priority: MaintenancePriority.NORMALE, status: MaintenanceOrderStatus.PLANIFIE,
    description: 'Changement pneus avant', scheduledDate: '2026-09-01',
    estimatedCost: 320, provider: 'Euromaster Nanterre',
    createdAt: '2026-08-20T10:00:00Z', updatedAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'mo4', orderNumber: 'OT-2026-004', vehicleId: 'v7', type: MaintenanceType.REVISION,
    priority: MaintenancePriority.HAUTE, status: MaintenanceOrderStatus.PLANIFIE,
    description: 'Grande revision 230 000 km', scheduledDate: '2026-09-05',
    estimatedCost: 2800, provider: 'Volvo Trucks Service',
    createdAt: '2026-08-22T10:00:00Z', updatedAt: '2026-08-22T10:00:00Z',
  },
  {
    id: 'mo5', orderNumber: 'OT-2026-005', vehicleId: 'v9', type: MaintenanceType.CORRECTIVE,
    priority: MaintenancePriority.URGENTE, status: MaintenanceOrderStatus.TERMINE,
    description: 'Remplacement moteur (panne totale)', scheduledDate: '2026-08-10',
    completedDate: '2026-08-18', estimatedCost: 8500, actualCost: 9200,
    provider: 'Fiat Professional Lyon',
    notes: 'Moteur irrecuperable, remplacement complet',
    createdAt: '2026-08-10T10:00:00Z', updatedAt: '2026-08-18T16:00:00Z',
  },
  {
    id: 'mo6', orderNumber: 'OT-2026-006', vehicleId: 'v4', type: MaintenanceType.PREVENTIVE,
    priority: MaintenancePriority.BASSE, status: MaintenanceOrderStatus.TERMINE,
    description: 'Controle freins et plaquettes', scheduledDate: '2026-08-15',
    completedDate: '2026-08-15', estimatedCost: 180, actualCost: 175,
    provider: 'Speedy Auto Bordeaux',
    createdAt: '2026-08-14T10:00:00Z', updatedAt: '2026-08-15T14:00:00Z',
  },
  {
    id: 'mo7', orderNumber: 'OT-2026-007', vehicleId: 'v2', type: MaintenanceType.PREVENTIVE,
    priority: MaintenancePriority.NORMALE, status: MaintenanceOrderStatus.TERMINE,
    description: 'Vidange huile et filtres', scheduledDate: '2026-08-12',
    completedDate: '2026-08-12', estimatedCost: 120, actualCost: 115,
    provider: 'Peugeot Service Paris',
    createdAt: '2026-08-11T10:00:00Z', updatedAt: '2026-08-12T12:00:00Z',
  },
  {
    id: 'mo8', orderNumber: 'OT-2026-008', vehicleId: 'v11', type: MaintenanceType.CORRECTIVE,
    priority: MaintenancePriority.HAUTE, status: MaintenanceOrderStatus.TERMINE,
    description: 'Remplacement alternateur', scheduledDate: '2026-08-08',
    completedDate: '2026-08-09', estimatedCost: 650, actualCost: 680,
    provider: 'Ford Service Nantes',
    createdAt: '2026-08-07T10:00:00Z', updatedAt: '2026-08-09T14:00:00Z',
  },
  {
    id: 'mo9', orderNumber: 'OT-2026-009', vehicleId: 'v6', type: MaintenanceType.REVISION,
    priority: MaintenancePriority.BASSE, status: MaintenanceOrderStatus.PLANIFIE,
    description: 'Controle batterie et systeme electrique', scheduledDate: '2026-09-10',
    estimatedCost: 90, provider: 'Renault ZE Service',
    createdAt: '2026-08-25T10:00:00Z', updatedAt: '2026-08-25T10:00:00Z',
  },
  {
    id: 'mo10', orderNumber: 'OT-2026-010', vehicleId: 'v15', type: MaintenanceType.PREVENTIVE,
    priority: MaintenancePriority.HAUTE, status: MaintenanceOrderStatus.PLANIFIE,
    description: 'Remplacement courroie distribution', scheduledDate: '2026-09-15',
    estimatedCost: 1500, provider: 'MAN Truck Service',
    createdAt: '2026-08-24T10:00:00Z', updatedAt: '2026-08-24T10:00:00Z',
  },
];

// ==================== MAINTENANCE PLANS ====================
export const mockMaintenancePlans: MaintenancePlan[] = [
  {
    id: 'mp1', vehicleId: 'v1', type: MaintenanceType.REVISION,
    description: 'Revision periodique', intervalKm: 15000, intervalMonths: 12,
    lastPerformedDate: '2026-03-15', lastPerformedKm: 40000,
    nextDueDate: '2027-03-15', nextDueKm: 55000, estimatedCost: 350, isActive: true,
    createdAt: '2022-03-15T10:00:00Z',
  },
  {
    id: 'mp2', vehicleId: 'v7', type: MaintenanceType.REVISION,
    description: 'Grande revision poids lourd', intervalKm: 50000, intervalMonths: 6,
    lastPerformedDate: '2026-06-01', lastPerformedKm: 220000,
    nextDueDate: '2026-12-01', nextDueKm: 270000, estimatedCost: 2500, isActive: true,
    createdAt: '2020-01-20T10:00:00Z',
  },
];

// ==================== FUEL ENTRIES ====================
export const mockFuelEntries: FuelEntry[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(2026, 7, 26 - i);
  const vehicles = ['v1', 'v2', 'v3', 'v4', 'v5', 'v7', 'v9', 'v10', 'v11', 'v12', 'v15'];
  const vehicleId = vehicles[i % vehicles.length];
  const stations = ['TotalEnergies Relais A6', 'BP Express Paris Nord', 'Shell Station Peripherique', 'Esso Lyon Gerland', 'Carrefour Market Essence', 'Auchan Drive Fuel'];
  const quantity = Math.round((30 + Math.random() * 50) * 10) / 10;
  const unitPrice = Math.round((1.65 + Math.random() * 0.30) * 1000) / 1000;
  return {
    id: `fe${i + 1}`,
    vehicleId,
    driverId: mockDrivers[i % mockDrivers.length].id,
    date: date.toISOString(),
    quantity,
    unitPrice,
    totalCost: Math.round(quantity * unitPrice * 100) / 100,
    mileage: 40000 + i * 350,
    station: stations[i % stations.length],
    fuelType: FuelType.DIESEL,
    receiptNumber: `REC-${String(2026000 + i).padStart(7, '0')}`,
    createdAt: date.toISOString(),
  };
});

// ==================== INCIDENTS ====================
export const mockIncidents: Incident[] = [
  {
    id: 'inc1', vehicleId: 'v9', driverId: 'd9', date: '2026-08-08T14:30:00Z',
    type: IncidentType.PANNE, severity: IncidentSeverity.CRITIQUE, status: IncidentStatus.RESOLU,
    description: 'Panne moteur sur autoroute A7 - arret complet du vehicule',
    location: 'Autoroute A7, km 342', damageEstimate: 9500,
    notes: 'Vehicule remorque, moteur a remplacer',
    createdAt: '2026-08-08T15:00:00Z', updatedAt: '2026-08-18T16:00:00Z',
  },
  {
    id: 'inc2', vehicleId: 'v2', driverId: 'd1', date: '2026-08-15T09:20:00Z',
    type: IncidentType.ACCIDENT, severity: IncidentSeverity.MINEUR, status: IncidentStatus.EN_COURS,
    description: 'Accrochage parking - retroviseur casse',
    location: 'Parking Centre Commercial Velizy', damageEstimate: 350,
    insuranceClaim: 'SINISTRE-2026-4521',
    createdAt: '2026-08-15T10:00:00Z', updatedAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'inc3', vehicleId: 'v7', driverId: 'd5', date: '2026-08-20T16:45:00Z',
    type: IncidentType.INFRACTION, severity: IncidentSeverity.MODERE, status: IncidentStatus.OUVERT,
    description: 'Exces de vitesse 120 km/h au lieu de 90 km/h - zone travaux',
    location: 'RN7, commune de Valence', damageEstimate: 135,
    policeReport: 'PV-2026-DR26-8452',
    createdAt: '2026-08-20T17:00:00Z', updatedAt: '2026-08-20T17:00:00Z',
  },
  {
    id: 'inc4', vehicleId: 'v11', driverId: 'd8', date: '2026-08-05T11:00:00Z',
    type: IncidentType.PANNE, severity: IncidentSeverity.MAJEUR, status: IncidentStatus.RESOLU,
    description: 'Alternateur defaillant - batterie a plat en mission',
    location: 'Zone Industrielle Nantes Sud', damageEstimate: 680,
    createdAt: '2026-08-05T12:00:00Z', updatedAt: '2026-08-09T14:00:00Z',
  },
  {
    id: 'inc5', vehicleId: 'v4', driverId: 'd7', date: '2026-08-22T08:30:00Z',
    type: IncidentType.ACCIDENT, severity: IncidentSeverity.MINEUR, status: IncidentStatus.OUVERT,
    description: 'Eraflure sur le flanc droit lors de manoeuvre en entrepot',
    location: 'Entrepot logistique Toulouse', damageEstimate: 450,
    createdAt: '2026-08-22T09:00:00Z', updatedAt: '2026-08-22T09:00:00Z',
  },
];

// ==================== ALERTS ====================
export const mockAlerts: Alert[] = [
  {
    id: 'a1', type: AlertType.DOCUMENT_EXPIRY, priority: AlertPriority.CRITIQUE,
    title: "Assurance expiree - VH-009", message: "L'assurance du vehicule Fiat Ducato (VH-009) a expire le 15/08/2026.",
    vehicleId: 'v9', isRead: false, isDismissed: false, dueDate: '2026-08-15',
    createdAt: '2026-08-16T08:00:00Z',
  },
  {
    id: 'a2', type: AlertType.MAINTENANCE_DUE, priority: AlertPriority.MOYENNE,
    title: 'Revision a planifier - VH-007', message: 'Le Volvo FH16 (VH-007) atteindra 240 000 km dans 5 500 km. Revision requise.',
    vehicleId: 'v7', isRead: false, isDismissed: false, dueDate: '2026-09-15',
    createdAt: '2026-08-24T10:00:00Z',
  },
  {
    id: 'a3', type: AlertType.DOCUMENT_EXPIRY, priority: AlertPriority.MOYENNE,
    title: 'Permis bientot expire - Luc Moreau', message: 'Le permis de conduire de Luc Moreau expire le 30/11/2026. Renouvellement a prevoir.',
    driverId: 'd5', isRead: false, isDismissed: false, dueDate: '2026-11-30',
    createdAt: '2026-08-20T08:00:00Z',
  },
  {
    id: 'a4', type: AlertType.FUEL_ANOMALY, priority: AlertPriority.MOYENNE,
    title: 'Surconsommation detectee - VH-003', message: 'Le Mercedes Sprinter (VH-003) affiche une consommation 25% superieure a la norme constructeur.',
    vehicleId: 'v3', isRead: false, isDismissed: false,
    createdAt: '2026-08-23T14:00:00Z',
  },
  {
    id: 'a5', type: AlertType.LEASE_EXPIRY, priority: AlertPriority.BASSE,
    title: 'Fin de location - VH-002', message: 'Le contrat de location de la Peugeot 308 (VH-002) se termine le 10/01/2027.',
    vehicleId: 'v2', isRead: true, isDismissed: false, dueDate: '2027-01-10',
    createdAt: '2026-08-18T08:00:00Z',
  },
  {
    id: 'a6', type: AlertType.DOCUMENT_EXPIRY, priority: AlertPriority.CRITIQUE,
    title: 'Controle technique a faire - VH-004', message: 'Le controle technique du Iveco Daily (VH-004) est du le 01/09/2026.',
    vehicleId: 'v4', isRead: false, isDismissed: false, dueDate: '2026-09-01',
    createdAt: '2026-08-22T08:00:00Z',
  },
  {
    id: 'a7', type: AlertType.DOCUMENT_EXPIRY, priority: AlertPriority.CRITIQUE,
    title: 'Assurance a renouveler - VH-013', message: "L'assurance de la Caterpillar 320 (VH-013) expire le 10/09/2026.",
    vehicleId: 'v13', isRead: false, isDismissed: false, dueDate: '2026-09-10',
    createdAt: '2026-08-25T08:00:00Z',
  },
  {
    id: 'a8', type: AlertType.MAINTENANCE_DUE, priority: AlertPriority.BASSE,
    title: 'Vidange a prevoir - VH-001', message: 'La prochaine vidange du Renault Master (VH-001) est prevue a 50 000 km (actuel: 45 230 km).',
    vehicleId: 'v1', isRead: true, isDismissed: false, dueDate: '2026-10-15',
    createdAt: '2026-08-20T10:00:00Z',
  },
  {
    id: 'a9', type: AlertType.DOCUMENT_EXPIRY, priority: AlertPriority.CRITIQUE,
    title: 'Permis expire - Marie Martin', message: 'Le permis de conduire de Marie Martin expire le 01/12/2026. Action urgente requise.',
    driverId: 'd2', isRead: false, isDismissed: false, dueDate: '2026-12-01',
    createdAt: '2026-08-25T09:00:00Z',
  },
  {
    id: 'a10', type: AlertType.FUEL_ANOMALY, priority: AlertPriority.BASSE,
    title: 'Consommation elevee - VH-015', message: 'Le MAN TGX (VH-015) a consomme 12% de plus que la norme sur le dernier trajet.',
    vehicleId: 'v15', isRead: true, isDismissed: false,
    createdAt: '2026-08-21T14:00:00Z',
  },
  {
    id: 'a11', type: AlertType.DOCUMENT_EXPIRY, priority: AlertPriority.MOYENNE,
    title: 'Carte grise a mettre a jour - VH-011', message: "La carte grise du Ford Transit (VH-011) doit etre mise a jour suite au changement d'adresse.",
    vehicleId: 'v11', isRead: false, isDismissed: false,
    createdAt: '2026-08-19T08:00:00Z',
  },
  {
    id: 'a12', type: AlertType.LEASE_EXPIRY, priority: AlertPriority.MOYENNE,
    title: 'Fin credit-bail - VH-003', message: 'Le credit-bail du Mercedes Sprinter (VH-003) se termine le 20/06/2027.',
    vehicleId: 'v3', isRead: true, isDismissed: false, dueDate: '2027-06-20',
    createdAt: '2026-08-15T08:00:00Z',
  },
  {
    id: 'a13', type: AlertType.MAINTENANCE_DUE, priority: AlertPriority.MOYENNE,
    title: 'Pneus uses - VH-012', message: 'Les pneus arriere du Renault Trafic (VH-012) sont uses a 85%. Remplacement necessaire.',
    vehicleId: 'v12', isRead: false, isDismissed: false,
    createdAt: '2026-08-24T16:00:00Z',
  },
  {
    id: 'a14', type: AlertType.DOCUMENT_EXPIRY, priority: AlertPriority.BASSE,
    title: 'Controle technique OK - VH-008', message: 'Le controle technique de la Peugeot e-208 (VH-008) est a jour jusqu\'au 01/03/2027.',
    vehicleId: 'v8', isRead: true, isDismissed: true, dueDate: '2027-03-01',
    createdAt: '2026-08-10T08:00:00Z',
  },
  {
    id: 'a15', type: AlertType.FUEL_ANOMALY, priority: AlertPriority.MOYENNE,
    title: 'Plein suspect - VH-012', message: 'Un plein de 85L a ete enregistre pour le Renault Trafic (VH-012) dont le reservoir est de 80L.',
    vehicleId: 'v12', isRead: false, isDismissed: false,
    createdAt: '2026-08-25T10:00:00Z',
  },
];

// ==================== MISSION EXPENSES ====================
export const mockMissionExpenses: MissionExpense[] = [
  {
    id: 'me1', missionId: 'm5', driverId: 'd2', date: '2026-08-22', type: 'repas',
    amount: 18.50, description: 'Dejeuner restaurant routier', isReimbursed: true,
    createdAt: '2026-08-22T12:00:00Z',
  },
  {
    id: 'me2', missionId: 'm5', driverId: 'd2', date: '2026-08-22', type: 'peage',
    amount: 42.30, description: 'Peage A6 Paris-Strasbourg', isReimbursed: true,
    createdAt: '2026-08-22T08:00:00Z',
  },
  {
    id: 'me3', missionId: 'm3', driverId: 'd5', date: '2026-08-25', type: 'hotel',
    amount: 85.00, description: 'Hotel Bruxelles nuit du 25/08', isReimbursed: false,
    createdAt: '2026-08-25T20:00:00Z',
  },
  {
    id: 'me4', missionId: 'm1', driverId: 'd1', date: '2026-08-25', type: 'repas',
    amount: 15.80, description: 'Petit-dejeuner aire de repos', isReimbursed: false,
    createdAt: '2026-08-25T07:00:00Z',
  },
  {
    id: 'me5', missionId: 'm1', driverId: 'd1', date: '2026-08-25', type: 'peage',
    amount: 35.60, description: 'Peage A6 Paris-Lyon', isReimbursed: false,
    createdAt: '2026-08-25T08:30:00Z',
  },
];

// ==================== EXPENSE SCALES ====================
export const mockExpenseScales: ExpenseScale[] = [
  {
    id: 'es1', zoneId: 'z1', mealAllowance: 19.10, hotelAllowance: 90,
    kilometerRate: 0.55, dailyAllowance: 50, effectiveDate: '2026-01-01', isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'es2', zoneId: 'z2', mealAllowance: 19.10, hotelAllowance: 120,
    kilometerRate: 0.55, dailyAllowance: 70, effectiveDate: '2026-01-01', isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 'es3', zoneId: 'z3', mealAllowance: 25.00, hotelAllowance: 150,
    kilometerRate: 0.55, dailyAllowance: 90, effectiveDate: '2026-01-01', isActive: true,
    createdAt: '2026-01-01T00:00:00Z',
  },
];

// ==================== VEHICLE DOCUMENTS ====================
export const mockVehicleDocuments: VehicleDocument[] = [
  {
    id: 'vd1', vehicleId: 'v1', type: DocumentType.CARTE_GRISE, name: 'Carte grise',
    number: 'CG-2022-AB123CD', issueDate: '2022-03-15', expiryDate: '2032-03-15',
    createdAt: '2022-03-15T10:00:00Z',
  },
  {
    id: 'vd2', vehicleId: 'v1', type: DocumentType.ASSURANCE, name: 'Assurance tous risques',
    number: 'ASS-2026-001234', issueDate: '2026-01-01', expiryDate: '2027-01-01',
    createdAt: '2026-01-01T10:00:00Z',
  },
  {
    id: 'vd3', vehicleId: 'v1', type: DocumentType.CONTROLE_TECHNIQUE, name: 'Controle technique',
    number: 'CT-2026-45678', issueDate: '2026-06-15', expiryDate: '2028-06-15',
    createdAt: '2026-06-15T10:00:00Z',
  },
];

// ==================== MISSION ZONES ====================
export const mockMissionZones: MissionZone[] = [
  { id: 'z1', name: 'France Metropolitaine', code: 'FR-MET', description: 'Deplacements en France metropolitaine', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'z2', name: 'Ile-de-France', code: 'IDF', description: 'Deplacements en region parisienne', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'z3', name: 'International Europe', code: 'INT-EU', description: 'Deplacements dans les pays europeens', isActive: true, createdAt: '2024-01-01T00:00:00Z' },
];

// ==================== CONSTRUCTOR NORMS ====================
export const mockConstructorNorms: ConstructorNorm[] = [
  { id: 'cn1', brand: 'Renault', model: 'Master', year: 2022, fuelType: FuelType.DIESEL, normConsumption: 8.5, tolerancePercent: 15, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'cn2', brand: 'Peugeot', model: '308', year: 2023, fuelType: FuelType.ESSENCE, normConsumption: 5.8, tolerancePercent: 10, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'cn3', brand: 'Mercedes', model: 'Sprinter', year: 2021, fuelType: FuelType.DIESEL, normConsumption: 9.2, tolerancePercent: 15, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'cn4', brand: 'Volvo', model: 'FH16', year: 2020, fuelType: FuelType.DIESEL, normConsumption: 32.0, tolerancePercent: 12, createdAt: '2024-01-01T00:00:00Z' },
  { id: 'cn5', brand: 'Iveco', model: 'Daily', year: 2022, fuelType: FuelType.DIESEL, normConsumption: 10.5, tolerancePercent: 15, createdAt: '2024-01-01T00:00:00Z' },
];

// ==================== FUEL ANALYSIS ====================
export const mockFuelAnalysis: FuelAnalysis[] = [
  {
    id: 'fa1', vehicleId: 'v1', period: '2026-08',
    averageConsumption: 9.2, normConsumption: 8.5, deviation: 0.7, deviationPercent: 8.2,
    totalDistance: 2500, totalFuel: 230, isAnomaly: false,
    createdAt: '2026-08-25T10:00:00Z',
  },
  {
    id: 'fa2', vehicleId: 'v3', period: '2026-08',
    averageConsumption: 11.5, normConsumption: 9.2, deviation: 2.3, deviationPercent: 25.0,
    totalDistance: 1800, totalFuel: 207, isAnomaly: true,
    createdAt: '2026-08-25T10:00:00Z',
  },
  {
    id: 'fa3', vehicleId: 'v7', period: '2026-08',
    averageConsumption: 33.5, normConsumption: 32.0, deviation: 1.5, deviationPercent: 4.7,
    totalDistance: 3200, totalFuel: 1072, isAnomaly: false,
    createdAt: '2026-08-25T10:00:00Z',
  },
];

// ==================== DASHBOARD STATS ====================
export const mockDashboardStats: DashboardStats = {
  totalVehicles: 15,
  availableVehicles: 7,
  inMissionVehicles: 4,
  inMaintenanceVehicles: 2,
  activeDrivers: 7,
  ongoingMissions: 4,
  unreadAlerts: 9,
};

// ==================== CHART DATA ====================
export const maintenanceCostData = [
  { month: 'Mars', cout: 2450 },
  { month: 'Avr', cout: 1800 },
  { month: 'Mai', cout: 3200 },
  { month: 'Juin', cout: 2100 },
  { month: 'Juil', cout: 4500 },
  { month: 'Aout', cout: 3800 },
];

export const fleetDistributionData = [
  { name: 'VP', value: 4, color: '#2563EB' },
  { name: 'VU', value: 7, color: '#10B981' },
  { name: 'PL', value: 3, color: '#F59E0B' },
  { name: 'Engin', value: 1, color: '#8B5CF6' },
];

export const fuelConsumptionTrendData = [
  { month: 'Mars', litres: 4200, cout: 6930 },
  { month: 'Avr', litres: 3800, cout: 6270 },
  { month: 'Mai', litres: 4500, cout: 7425 },
  { month: 'Juin', litres: 4100, cout: 6765 },
  { month: 'Juil', litres: 4800, cout: 7920 },
  { month: 'Aout', litres: 4350, cout: 7178 },
];

export const topCostlyVehiclesData = [
  { vehicule: 'VH-009', cout: 9200 },
  { vehicule: 'VH-007', cout: 5300 },
  { vehicule: 'VH-003', cout: 3800 },
  { vehicule: 'VH-015', cout: 2900 },
  { vehicule: 'VH-011', cout: 1850 },
];
