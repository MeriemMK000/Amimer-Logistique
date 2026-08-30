// ==================== ENUMS ====================

export enum VehicleType {
  VP = 'VP',
  VU = 'VU',
  PL = 'PL',
  ENGIN = 'ENGIN',
}

export enum VehicleStatus {
  DISPONIBLE = 'DISPONIBLE',
  EN_MISSION = 'EN_MISSION',
  EN_MAINTENANCE = 'EN_MAINTENANCE',
  HORS_SERVICE = 'HORS_SERVICE',
  EN_ATTENTE = 'EN_ATTENTE',
}

export enum OwnershipType {
  PROPRE = 'PROPRE',
  LOCATION = 'LOCATION',
  CREDIT_BAIL = 'CREDIT_BAIL',
}

export enum FuelType {
  DIESEL = 'DIESEL',
  ESSENCE = 'ESSENCE',
  HYBRIDE = 'HYBRIDE',
  ELECTRIQUE = 'ELECTRIQUE',
  GPL = 'GPL',
}

export enum DriverStatus {
  ACTIF = 'ACTIF',
  INACTIF = 'INACTIF',
  EN_MISSION = 'EN_MISSION',
  EN_CONGE = 'EN_CONGE',
  SUSPENDU = 'SUSPENDU',
}

export enum MissionStatus {
  PLANIFIEE = 'PLANIFIEE',
  EN_COURS = 'EN_COURS',
  TERMINEE = 'TERMINEE',
  ANNULEE = 'ANNULEE',
}

export enum MaintenanceType {
  PREVENTIVE = 'PREVENTIVE',
  CORRECTIVE = 'CORRECTIVE',
  REVISION = 'REVISION',
}

export enum MaintenancePriority {
  BASSE = 'BASSE',
  NORMALE = 'NORMALE',
  HAUTE = 'HAUTE',
  URGENTE = 'URGENTE',
}

export enum MaintenanceOrderStatus {
  PLANIFIE = 'PLANIFIE',
  EN_COURS = 'EN_COURS',
  TERMINE = 'TERMINE',
  ANNULE = 'ANNULE',
}

export enum IncidentSeverity {
  MINEUR = 'MINEUR',
  MODERE = 'MODERE',
  MAJEUR = 'MAJEUR',
  CRITIQUE = 'CRITIQUE',
}

export enum IncidentType {
  ACCIDENT = 'ACCIDENT',
  PANNE = 'PANNE',
  VOL = 'VOL',
  INFRACTION = 'INFRACTION',
  AUTRE = 'AUTRE',
}

export enum IncidentStatus {
  OUVERT = 'OUVERT',
  EN_COURS = 'EN_COURS',
  RESOLU = 'RESOLU',
  CLOS = 'CLOS',
}

export enum AlertType {
  DOCUMENT_EXPIRY = 'DOCUMENT_EXPIRY',
  MAINTENANCE_DUE = 'MAINTENANCE_DUE',
  LEASE_EXPIRY = 'LEASE_EXPIRY',
  FUEL_ANOMALY = 'FUEL_ANOMALY',
  DRIVER_HOURS = 'DRIVER_HOURS',
}

export enum AlertPriority {
  BASSE = 'BASSE',
  MOYENNE = 'MOYENNE',
  HAUTE = 'HAUTE',
  CRITIQUE = 'CRITIQUE',
}

export enum DocumentType {
  CARTE_GRISE = 'CARTE_GRISE',
  ASSURANCE = 'ASSURANCE',
  CONTROLE_TECHNIQUE = 'CONTROLE_TECHNIQUE',
  VIGNETTE = 'VIGNETTE',
  AUTRE = 'AUTRE',
}

export enum UserRole {
  ADMIN = 'ADMIN',
  GESTIONNAIRE = 'GESTIONNAIRE',
  CHAUFFEUR = 'CHAUFFEUR',
  LECTEUR = 'LECTEUR',
}

// ==================== INTERFACES ====================

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  code: string;
  brand: string;
  model: string;
  year: number;
  type: VehicleType;
  registrationNumber: string;
  vin: string;
  status: VehicleStatus;
  fuelType: FuelType;
  ownershipType: OwnershipType;
  currentMileage: number;
  acquisitionDate: string;
  acquisitionCost: number;
  depreciationRate: number;
  assignedDriverId?: string;
  assignedDriver?: Driver;
  createdAt: string;
  updatedAt: string;
}

export interface Driver {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseType: string;
  licenseExpiry: string;
  status: DriverStatus;
  hireDate: string;
  department: string;
  createdAt: string;
  updatedAt: string;
}

export interface Mission {
  id: string;
  missionNumber: string;
  vehicleId: string;
  vehicle?: Vehicle;
  driverId: string;
  driver?: Driver;
  departureLocation: string;
  arrivalLocation: string;
  departureDate: string;
  arrivalDate?: string;
  status: MissionStatus;
  distance: number;
  estimatedDistance?: number;
  description: string;
  zoneId?: string;
  zone?: MissionZone;
  startMileage: number;
  endMileage?: number;
  fuelConsumed?: number;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceOrder {
  id: string;
  orderNumber: string;
  vehicleId: string;
  vehicle?: Vehicle;
  type: MaintenanceType;
  priority: MaintenancePriority;
  status: MaintenanceOrderStatus;
  description: string;
  scheduledDate: string;
  completedDate?: string;
  estimatedCost: number;
  actualCost?: number;
  provider: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenancePlan {
  id: string;
  vehicleId: string;
  vehicle?: Vehicle;
  type: MaintenanceType;
  description: string;
  intervalKm: number;
  intervalMonths: number;
  lastPerformedDate?: string;
  lastPerformedKm?: number;
  nextDueDate: string;
  nextDueKm: number;
  estimatedCost: number;
  isActive: boolean;
  createdAt: string;
}

export interface FuelEntry {
  id: string;
  vehicleId: string;
  vehicle?: Vehicle;
  driverId?: string;
  driver?: Driver;
  date: string;
  quantity: number;
  unitPrice: number;
  totalCost: number;
  mileage: number;
  station: string;
  fuelType: FuelType;
  receiptNumber?: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  vehicleId: string;
  vehicle?: Vehicle;
  driverId?: string;
  driver?: Driver;
  date: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  location: string;
  damageEstimate?: number;
  insuranceClaim?: string;
  policeReport?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  type: AlertType;
  priority: AlertPriority;
  title: string;
  message: string;
  vehicleId?: string;
  vehicle?: Vehicle;
  driverId?: string;
  driver?: Driver;
  dueDate?: string;
  isRead: boolean;
  isDismissed: boolean;
  createdAt: string;
}

export interface MissionExpense {
  id: string;
  missionId: string;
  mission?: Mission;
  driverId: string;
  driver?: Driver;
  date: string;
  type: string;
  amount: number;
  description: string;
  receiptUrl?: string;
  isReimbursed: boolean;
  createdAt: string;
}

export interface ExpenseScale {
  id: string;
  zoneId: string;
  zone?: MissionZone;
  mealAllowance: number;
  hotelAllowance: number;
  kilometerRate: number;
  dailyAllowance: number;
  effectiveDate: string;
  isActive: boolean;
  createdAt: string;
}

export interface VehicleDocument {
  id: string;
  vehicleId: string;
  vehicle?: Vehicle;
  type: DocumentType;
  name: string;
  number: string;
  issueDate: string;
  expiryDate: string;
  fileUrl?: string;
  notes?: string;
  createdAt: string;
}

export interface VehicleLease {
  id: string;
  vehicleId: string;
  vehicle?: Vehicle;
  lessor: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  monthlyPayment: number;
  mileageLimit: number;
  excessMileageRate: number;
  isActive: boolean;
  createdAt: string;
}

export interface VehicleAssignment {
  id: string;
  vehicleId: string;
  vehicle?: Vehicle;
  driverId: string;
  driver?: Driver;
  startDate: string;
  endDate?: string;
  isActive: boolean;
  createdAt: string;
}

export interface MissionZone {
  id: string;
  name: string;
  code: string;
  description: string;
  isActive: boolean;
  createdAt: string;
}

export interface ConstructorNorm {
  id: string;
  brand: string;
  model: string;
  year: number;
  fuelType: FuelType;
  normConsumption: number;
  tolerancePercent: number;
  createdAt: string;
}

export interface FuelAnalysis {
  id: string;
  vehicleId: string;
  vehicle?: Vehicle;
  period: string;
  averageConsumption: number;
  normConsumption: number;
  deviation: number;
  deviationPercent: number;
  totalDistance: number;
  totalFuel: number;
  isAnomaly: boolean;
  createdAt: string;
}

export interface ErpExport {
  id: string;
  type: string;
  format: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  fileUrl?: string;
  recordCount: number;
  createdAt: string;
}

export interface ErpImport {
  id: string;
  type: string;
  format: string;
  fileName: string;
  status: string;
  recordCount: number;
  successCount: number;
  errorCount: number;
  errors?: string[];
  createdAt: string;
}

// ==================== API RESPONSE TYPES ====================

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface DashboardStats {
  totalVehicles: number;
  availableVehicles: number;
  inMissionVehicles: number;
  inMaintenanceVehicles: number;
  activeDrivers: number;
  ongoingMissions: number;
  unreadAlerts: number;
}
